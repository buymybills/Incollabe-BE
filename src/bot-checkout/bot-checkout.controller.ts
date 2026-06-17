import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotCheckoutService, cartTotalInr } from './bot-checkout.service';
import { CheckoutLinkService } from './checkout-link.service';
import { BotCouponService } from './bot-coupon.service';
import { verifyCheckoutToken, hashUserKey, getCheckoutSecret } from './checkout-token.util';

/**
 * Checkout API for the Instagram shopping bot's hosted checkout page.
 *
 * The browser (checkout page) calls these directly. Auth is the SIGNED TOKEN in
 * each request (minted by the bot, HMAC'd with the shared CHECKOUT_SECRET): it
 * carries the IG sender id + product + price, so the link itself is the identity
 * and nothing — price, shopper — can be tampered with. No x-bot-key needed.
 */
@Controller('bot-checkout')
export class BotCheckoutController {
  constructor(
    private readonly checkout: BotCheckoutService,
    private readonly checkoutLink: CheckoutLinkService,
    private readonly coupon: BotCouponService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Mint a short id for a full signed checkout token. The bot calls this so the
   * DM'd link is `/api/checkout/<id>` instead of the long embedded-token URL.
   */
  @Post('shorten')
  async shorten(@Body('token') token: string) {
    const p = verifyCheckoutToken(token, getCheckoutSecret(this.config));
    if (!p) throw new UnauthorizedException('invalid_token');
    const id = await this.checkoutLink.shorten(token);
    return { id };
  }

  // Customer + saved addresses for the checkout page
  @Get('customer')
  async customer(@Query('token') token: string) {
    const p = verifyCheckoutToken(token, getCheckoutSecret(this.config));
    if (!p) throw new UnauthorizedException('invalid_token');
    const data = await this.checkout.getCustomerWithAddresses(p.igsid);
    return {
      customer: data.customer
        ? {
            id: data.customer.id,
            name: data.customer.name,
            email: data.customer.email,
            mobile: data.customer.mobile,
            username: data.customer.username,
          }
        : null,
      addresses: data.addresses,
    };
  }

  // Add a new address (also captures contact on first use)
  @Post('address')
  async addAddress(
    @Body()
    body: {
      token: string;
      contact?: { name?: string; email?: string; mobile?: string };
      address: {
        label?: string; name?: string; mobile?: string;
        line1: string; line2?: string; city: string; state: string; pincode: string; country?: string; isDefault?: boolean;
      };
    },
  ) {
    const p = verifyCheckoutToken(body.token, getCheckoutSecret(this.config));
    if (!p) throw new UnauthorizedException('invalid_token');
    if (!body.address?.line1 || !body.address?.city || !body.address?.state || !body.address?.pincode) {
      throw new BadRequestException('missing_address_fields');
    }
    const addr = await this.checkout.addAddress(
      {
        igsid: p.igsid,
        username: p.username,
        userKey: hashUserKey(p.igsid),
        name: body.contact?.name,
        email: body.contact?.email,
        mobile: body.contact?.mobile,
      },
      body.address,
    );
    return { address: addr };
  }

  // Delete (soft) a saved address belonging to this shopper
  @Delete('address/:id')
  async deleteAddress(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { token: string },
  ) {
    const p = verifyCheckoutToken(body?.token, getCheckoutSecret(this.config));
    if (!p) throw new UnauthorizedException('invalid_token');
    const ok = await this.checkout.deleteAddress(p.igsid, id);
    return { deleted: ok };
  }

  // Validate a coupon against the order amount (display only — the real discount
  // is recomputed server-side at /order and /verify).
  @Post('apply-coupon')
  async applyCoupon(@Body() body: { token: string; code: string }) {
    const p = verifyCheckoutToken(body.token, getCheckoutSecret(this.config));
    if (!p) throw new UnauthorizedException('invalid_token');
    const base = cartTotalInr(p);
    return this.coupon.validate(body.code, base);
  }

  // Create a Razorpay order (amount comes from the signed token, never the client)
  @Post('order')
  async createOrder(@Body() body: { token: string; code?: string }) {
    const p = verifyCheckoutToken(body.token, getCheckoutSecret(this.config));
    if (!p) throw new UnauthorizedException('invalid_token');
    const order = await this.checkout.createRazorpayOrder(p, body.code);
    if (!order) throw new BadRequestException('order_failed');
    return order;
  }

  // Verify the payment, save the order (+address+txn), record sale, DM the buyer
  @Post('verify')
  async verify(
    @Body()
    body: {
      token: string;
      addressId?: number;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      method?: string;
      code?: string;
    },
  ) {
    const p = verifyCheckoutToken(body.token, getCheckoutSecret(this.config));
    if (!p) throw new UnauthorizedException('invalid_token');
    if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
      throw new BadRequestException('missing_fields');
    }
    return this.checkout.completePayment(p, body);
  }
}
