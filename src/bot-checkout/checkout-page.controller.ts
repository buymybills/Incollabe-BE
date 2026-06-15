import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { verifyCheckoutToken, getCheckoutSecret } from './checkout-token.util';
import { CheckoutLinkService } from './checkout-link.service';
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
  constructor(
    private readonly config: ConfigService,
    private readonly checkoutLink: CheckoutLinkService,
  ) {}

  @Get(':token')
  async page(@Param('token') token: string, @Res() res: Response): Promise<void> {
    // A short id (no '.') resolves to the full signed token; a token that
    // already contains '.' is used as-is (backwards compatible with old links).
    let fullToken = token;
    if (!token.includes('.')) {
      const resolved = await this.checkoutLink.resolve(token);
      if (resolved) fullToken = resolved;
    }

    const payload = verifyCheckoutToken(fullToken, getCheckoutSecret(this.config));
    const html = payload
      ? renderCheckoutPage(fullToken, {
          title: payload.title ?? 'Your order',
          size: payload.size ?? '',
          priceInr: payload.priceInr,
          items: payload.items?.map((i) => ({
            title: i.title,
            size: i.size ?? '',
            priceInr: i.priceInr,
            qty: i.qty ?? 1,
          })),
        })
      : renderInvalidPage();
    // Send raw HTML directly through Express so the global ResponseInterceptor
    // (which JSON-wraps every return value) does not mangle this page.
    res
      .status(payload ? 200 : 400)
      .type('text/html; charset=utf-8')
      .send(html);
  }
}
