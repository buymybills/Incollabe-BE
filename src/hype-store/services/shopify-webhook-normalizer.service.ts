import { Injectable, Logger } from '@nestjs/common';
import { UnifiedWebhookDto, WebhookEventType } from '../../wallet/dto/hype-store-webhook.dto';

/**
 * Shopify webhook topics we handle
 * Brands must subscribe to these topics in their Shopify Partner/Admin dashboard
 */
export enum ShopifyTopic {
  ORDERS_PAID = 'orders/paid',
  ORDERS_FULFILLED = 'orders/fulfilled',
  ORDERS_CANCELLED = 'orders/cancelled',
  REFUNDS_CREATE = 'refunds/create',
}

@Injectable()
export class ShopifyWebhookNormalizerService {
  private readonly logger = new Logger(ShopifyWebhookNormalizerService.name);

  /**
   * Normalizes a raw Shopify webhook payload into our UnifiedWebhookDto.
   *
   * Shopify field → our field mapping:
   *   order.name                        → externalOrderId
   *   order.discount_codes[0].code      → couponCode
   *   order.note_attributes[referral_code] → referralCode
   *   line_items[0].title               → orderTitle
   *   line_items[0].sku                 → productSKU
   *   line_items[0].variant_title       → productVariant
   *   line_items[0].image.src           → productImageUrl
   *   line_items[0].quantity            → productQuantity
   *   order.total_price                 → orderAmount
   *   order.currency                    → orderCurrency
   *   order.created_at                  → orderDate
   *   customer.first_name + last_name   → customerName
   *   customer.email                    → customerEmail
   *   customer.phone                    → customerPhone
   *
   * For referralCode: brands must capture the influencer ref param from the
   * landing URL and pass it as a note_attribute with key "referral_code".
   * e.g. note_attributes: [{ name: "referral_code", value: "INFL123" }]
   */
  normalize(rawPayload: any, topic: string): UnifiedWebhookDto | null {
    this.logger.log(`Normalizing Shopify payload for topic: ${topic}`);

    switch (topic) {
      case ShopifyTopic.ORDERS_PAID:
      case ShopifyTopic.ORDERS_FULFILLED:
        return this.normalizePurchase(rawPayload);

      case ShopifyTopic.ORDERS_CANCELLED:
        return this.normalizeOrderCancellation(rawPayload);

      case ShopifyTopic.REFUNDS_CREATE:
        return this.normalizeRefund(rawPayload);

      default:
        this.logger.warn(`Unhandled Shopify topic: ${topic} — skipping`);
        return null;
    }
  }

  private normalizePurchase(order: any): UnifiedWebhookDto {
    const lineItem = order.line_items?.[0];
    const couponCode = order.discount_codes?.[0]?.code ?? undefined;
    const referralCode = this.extractNoteAttribute(order.note_attributes, 'referral_code') ?? undefined;
    const customerName = this.buildCustomerName(order.customer) ?? undefined;

    return {
      eventType: WebhookEventType.PURCHASE,
      externalOrderId: order.name,                      // e.g. "#1001"
      couponCode,
      referralCode,
      orderTitle: lineItem?.title ?? order.name,
      productSKU: lineItem?.sku ?? undefined,
      productVariant: lineItem?.variant_title ?? undefined,
      productImageUrl: lineItem?.image?.src ?? undefined,
      productQuantity: lineItem?.quantity ?? 1,
      orderAmount: parseFloat(order.total_price ?? '0'),
      orderCurrency: order.currency ?? 'INR',
      orderDate: order.created_at,
      customerName,
      customerEmail: order.customer?.email ?? undefined,
      customerPhone: order.customer?.phone ?? undefined,
      metadata: {
        shopifyOrderId: order.id,
        shopifyOrderNumber: order.order_number,
        lineItemsCount: order.line_items?.length ?? 0,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
      },
    };
  }

  private normalizeRefund(payload: any): UnifiedWebhookDto {
    // Shopify sends refund object nested; order_id links back to original order
    const refund = payload;
    const transaction = refund.transactions?.[0];

    return {
      eventType: WebhookEventType.RETURN,
      externalOrderId: `#${refund.order_id}`,          // Shopify order_id (numeric)
      returnAmount: parseFloat(transaction?.amount ?? '0'),
      returnDate: refund.created_at ?? new Date().toISOString(),
      returnReason: refund.note ?? undefined,
      metadata: {
        shopifyRefundId: refund.id,
        shopifyOrderId: refund.order_id,
        refundLineItems: refund.refund_line_items,
      },
    };
  }

  private normalizeOrderCancellation(order: any): UnifiedWebhookDto {
    return {
      eventType: WebhookEventType.RETURN,
      externalOrderId: order.name,
      returnAmount: parseFloat(order.total_price ?? '0'),
      returnDate: order.cancelled_at ?? new Date().toISOString(),
      returnReason: order.cancel_reason ?? 'Order cancelled',
      metadata: {
        shopifyOrderId: order.id,
        cancelReason: order.cancel_reason,
      },
    };
  }

  private extractNoteAttribute(noteAttributes: any[], key: string): string | null {
    if (!Array.isArray(noteAttributes)) return null;
    return noteAttributes.find((attr) => attr.name === key)?.value ?? null;
  }

  private buildCustomerName(customer: any): string | null {
    if (!customer) return null;
    const parts = [customer.first_name, customer.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  }
}
