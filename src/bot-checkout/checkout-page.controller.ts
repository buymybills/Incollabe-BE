import { Controller, Get, Header, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyCheckoutToken } from './checkout-token.util';
import { renderCheckoutPage, renderInvalidPage } from './checkout-page.html';

/**
 * Serves the hosted checkout PAGE itself (self-contained HTML) so the whole
 * checkout — page + APIs — lives in the backend. The link points straight at
 * this public backend (no bot/ngrok needed) and the page is same-origin with
 * the /api/bot-checkout/* APIs, so there are no CORS hops.
 *
 * URL (global prefix 'api' applies): GET /api/checkout/:token
 */
@Controller('checkout')
export class CheckoutPageController {
  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return (
      this.config.get<string>('CHECKOUT_SECRET') ||
      this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ||
      'dev_checkout_secret'
    );
  }

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(@Param('token') token: string): string {
    const payload = verifyCheckoutToken(token, this.secret());
    if (!payload) return renderInvalidPage();
    return renderCheckoutPage(token, {
      title: payload.title ?? 'Your order',
      size: payload.size ?? '',
      priceInr: payload.priceInr,
    });
  }
}
