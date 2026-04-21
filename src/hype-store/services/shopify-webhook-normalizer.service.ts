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
    const rawReferralCode =
      this.extractNoteAttribute(order.note_attributes, 'referralCode') ??
      this.extractNoteAttribute(order.note_attributes, 'referral_code') ??
      this.extractFromLandingSite(order.landing_site, 'referralCode') ??
      this.extractFromLandingSite(order.landing_site, 'referral_code') ??
      this.extractFromLandingSite(order.landing_site, 'ref') ??        // Shopify also sends landing_site_ref as "ref" param
      order.landing_site_ref ??                                         // Shopify populates this directly from ?ref= param
      undefined;
    // Sanitize: brand frontends sometimes pass "INFL7?referralCode=INFL7" instead of just "INFL7"
    const referralCode = rawReferralCode ? this.sanitizeReferralCode(rawReferralCode) : undefined;
    const customerName = this.buildCustomerName(order.customer) ?? undefined;

    // Extract return period days from note_attributes if brand provides it
    // e.g. note_attributes: [{ name: "returnPeriodDays", value: "15" }]
    const rawReturnPeriodDays =
      this.extractNoteAttribute(order.note_attributes, 'returnPeriodDays') ??
      this.extractNoteAttribute(order.note_attributes, 'return_period_days');
    const returnPeriodDays = rawReturnPeriodDays ? parseInt(rawReturnPeriodDays, 10) : undefined;

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
      returnPeriodDays,
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

    // Shopify refund transactions carry payment_id in the format "{order_name}.{n}"
    // e.g. "NN1024SO.2" → order name is "NN1024SO" (everything before the last dot).
    // This matches the externalOrderId stored during the purchase webhook.
    const paymentId: string = transaction?.payment_id ?? '';
    const lastDot = paymentId.lastIndexOf('.');
    const orderNameFromPayment = lastDot > 0 ? paymentId.substring(0, lastDot) : undefined;

    return {
      eventType: WebhookEventType.RETURN,
      // Prefer the order name extracted from payment_id (avoids JSONB lookup).
      // Fall back to numeric order_id form when payment_id is absent or unexpected.
      externalOrderId: orderNameFromPayment ?? `#${refund.order_id}`,
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

  /**
   * Sanitizes referral codes that may have been polluted with URL query params.
   * e.g. "INFL7?referralCode=INFL7" → "INFL7"
   *      "INFL7&returnUrl=..." → "INFL7"
   */
  private sanitizeReferralCode(value: string): string {
    return value.split(/[?&]/)[0].trim();
  }

  private extractNoteAttribute(noteAttributes: any[], key: string): string | null {
    if (!Array.isArray(noteAttributes)) return null;
    return noteAttributes.find((attr) => attr.name === key)?.value ?? null;
  }

  private extractFromLandingSite(landingSite: string | null, param: string): string | null {
    if (!landingSite) return null;
    try {
      const url = new URL(landingSite, 'https://placeholder.com');
      return url.searchParams.get(param);
    } catch {
      return null;
    }
  }

  private buildCustomerName(customer: any): string | null {
    if (!customer) return null;
    const parts = [customer.first_name, customer.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  }
}
