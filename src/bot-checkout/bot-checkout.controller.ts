import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotCheckoutService } from './bot-checkout.service';
import { verifyCheckoutToken, hashUserKey } from './checkout-token.util';

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
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    return (
      this.config.get<string>('CHECKOUT_SECRET') ||
      this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ||
      'dev_checkout_secret'
    );
  }

  // Customer + saved addresses for the checkout page
  @Get('customer')
  async customer(@Query('token') token: string) {
    const p = verifyCheckoutToken(token, this.secret());
    if (!p) return { error: 'invalid_token' };
    const data = await this.checkout.getCustomerWithAddresses('thesouledstore', p.igsid);
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
    const p = verifyCheckoutToken(body.token, this.secret());
    if (!p) return { error: 'invalid_token' };
    if (!body.address?.line1 || !body.address?.city || !body.address?.pincode) {
      return { error: 'missing_address_fields' };
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
  async deleteAddress(@Param('id') id: string, @Body() body: { token: string }) {
    const p = verifyCheckoutToken(body?.token, this.secret());
    if (!p) return { error: 'invalid_token' };
    const ok = await this.checkout.deleteAddress('thesouledstore', p.igsid, parseInt(id, 10));
    return { deleted: ok };
  }

  // Create a Razorpay order (amount comes from the signed token, never the client)
  @Post('order')
  async createOrder(@Body() body: { token: string }) {
    const p = verifyCheckoutToken(body.token, this.secret());
    if (!p) return { error: 'invalid_token' };
    const order = await this.checkout.createRazorpayOrder(p);
    if (!order) return { error: 'order_failed' };
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
    },
  ) {
    const p = verifyCheckoutToken(body.token, this.secret());
    if (!p) return { error: 'invalid_token' };
    if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
      return { error: 'missing_fields' };
    }
    return this.checkout.completePayment(p, body);
  }
}
