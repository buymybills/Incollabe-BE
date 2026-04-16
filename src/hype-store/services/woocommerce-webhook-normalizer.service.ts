import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { UnifiedWebhookDto, WebhookEventType } from '../../wallet/dto/hype-store-webhook.dto';

/**
 * WooCommerce webhook topics we handle
 * Brands must subscribe to these topics in WooCommerce → Settings → Advanced → Webhooks
 *
 * Unlike Shopify which has granular topics, WooCommerce fires order.updated for all
 * order status changes. We differentiate by order status in the payload.
 */
export enum WooCommerceTopic {
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
}

/**
 * WooCommerce order statuses that we care about
 * https://woo.com/document/managing-orders/
 */
export enum WooCommerceOrderStatus {
  PENDING    = 'pending',      // Awaiting payment
  PROCESSING = 'processing',   // Payment received, being fulfilled → PURCHASE
  COMPLETED  = 'completed',    // Order fulfilled → PURCHASE (idempotent)
  REFUNDED   = 'refunded',     // Full refund issued → RETURN
  CANCELLED  = 'cancelled',    // Order cancelled → RETURN
  ON_HOLD    = 'on-hold',      // Awaiting manual action
  FAILED     = 'failed',       // Payment failed
}

@Injectable()
export class WooCommerceWebhookNormalizerService {
  private readonly logger = new Logger(WooCommerceWebhookNormalizerService.name);

  /**
   * Verifies WooCommerce HMAC-SHA256 webhook signature.
   * WooCommerce signs the raw body with the webhook secret and sends it
   * in the x-wc-webhook-signature header (Base64 encoded).
   *
   * @param rawBody   Raw request body as Buffer
   * @param signature Value of x-wc-webhook-signature header
   * @param secret    Webhook secret stored in hype_store_webhook_secrets
   */
  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const computed = createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');
    return computed === signature;
  }

  /**
   * Normalizes a raw WooCommerce webhook payload into our UnifiedWebhookDto.
   *
   * WooCommerce field → our field mapping:
   *   order.id                          → externalOrderId
   *   order.coupon_lines[0].code        → couponCode
   *   order.meta_data[referral_code]    → referralCode
   *   order.line_items[0].name          → orderTitle
   *   order.line_items[0].sku           → productSKU
   *   order.line_items[0].quantity      → productQuantity
   *   order.total                       → orderAmount
   *   order.currency                    → orderCurrency
   *   order.date_created                → orderDate
   *   order.billing.first_name + last   → customerName
   *   order.billing.email               → customerEmail
   *   order.billing.phone               → customerPhone
   *
   * For referralCode: brands must capture the influencer ref param from the
   * landing URL and store it as order meta with key "referral_code".
   */
  normalize(rawPayload: any, topic: string): UnifiedWebhookDto | null {
    this.logger.log(`Normalizing WooCommerce payload for topic: ${topic}, status: ${rawPayload?.status}`);

    if (topic !== WooCommerceTopic.ORDER_CREATED && topic !== WooCommerceTopic.ORDER_UPDATED) {
      this.logger.warn(`Unhandled WooCommerce topic: ${topic} — skipping`);
      return null;
    }

    const status = rawPayload?.status as WooCommerceOrderStatus;

    switch (status) {
      case WooCommerceOrderStatus.PROCESSING:
      case WooCommerceOrderStatus.COMPLETED:
        return this.normalizePurchase(rawPayload);

      case WooCommerceOrderStatus.REFUNDED:
      case WooCommerceOrderStatus.CANCELLED:
        return this.normalizeReturn(rawPayload);

      default:
        this.logger.warn(`WooCommerce order status "${status}" is not handled — skipping`);
        return null;
    }
  }

  private normalizePurchase(order: any): UnifiedWebhookDto {
    const lineItem = order.line_items?.[0];
    const couponCode = order.coupon_lines?.[0]?.code ?? undefined;
    const referralCode = this.extractMetaData(order.meta_data, 'referral_code') ?? undefined;
    const customerName = this.buildCustomerName(order.billing) ?? undefined;

    return {
      eventType: WebhookEventType.PURCHASE,
      externalOrderId: String(order.number ?? order.id),   // e.g. "1234"
      couponCode,
      referralCode,
      orderTitle: lineItem?.name ?? `Order #${order.number ?? order.id}`,
      productSKU: lineItem?.sku ?? undefined,
      productVariant: lineItem?.variation_id ? String(lineItem.variation_id) : undefined,
      productImageUrl: undefined,                           // WooCommerce doesn't send image in webhook
      productQuantity: lineItem?.quantity ?? 1,
      orderAmount: parseFloat(order.total ?? '0'),
      orderCurrency: order.currency ?? 'INR',
      orderDate: order.date_created ?? new Date().toISOString(),
      customerName,
      customerEmail: order.billing?.email ?? undefined,
      customerPhone: order.billing?.phone ?? undefined,
      metadata: {
        wooOrderId: order.id,
        wooOrderNumber: order.number,
        orderStatus: order.status,
        lineItemsCount: order.line_items?.length ?? 0,
        paymentMethod: order.payment_method,
        paymentMethodTitle: order.payment_method_title,
      },
    };
  }

  private normalizeReturn(order: any): UnifiedWebhookDto {
    // For refunded orders, WooCommerce populates order.refunds array
    const refund = order.refunds?.[0];
    const returnAmount = refund
      ? Math.abs(parseFloat(refund.total ?? '0'))
      : parseFloat(order.total ?? '0');

    return {
      eventType: WebhookEventType.RETURN,
      externalOrderId: String(order.number ?? order.id),
      returnAmount,
      returnDate: order.date_modified ?? new Date().toISOString(),
      returnReason: order.status === WooCommerceOrderStatus.CANCELLED
        ? 'Order cancelled'
        : (this.extractMetaData(order.meta_data, 'return_reason') ?? 'Order refunded'),
      metadata: {
        wooOrderId: order.id,
        wooOrderNumber: order.number,
        orderStatus: order.status,
        refunds: order.refunds,
      },
    };
  }

  private extractMetaData(metaData: any[], key: string): string | null {
    if (!Array.isArray(metaData)) return null;
    return metaData.find((m) => m.key === key)?.value ?? null;
  }

  private buildCustomerName(billing: any): string | null {
    if (!billing) return null;
    const parts = [billing.first_name, billing.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  }
}
