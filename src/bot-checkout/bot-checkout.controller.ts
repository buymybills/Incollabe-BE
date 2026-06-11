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
import { BotCheckoutService } from './bot-checkout.service';
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
    private readonly config: ConfigService,
  ) {}

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

  // Create a Razorpay order (amount comes from the signed token, never the client)
  @Post('order')
  async createOrder(@Body() body: { token: string }) {
    const p = verifyCheckoutToken(body.token, getCheckoutSecret(this.config));
    if (!p) throw new UnauthorizedException('invalid_token');
    const order = await this.checkout.createRazorpayOrder(p);
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
