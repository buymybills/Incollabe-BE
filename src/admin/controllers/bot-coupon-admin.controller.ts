import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AdminRole } from '../models/admin.model';
import { BotCouponService } from '../../bot-checkout/bot-coupon.service';
import { BotCouponType } from '../../bot-checkout/models/bot-coupon.model';

/**
 * Admin CRUD for bot-managed checkout coupons. These are OUR promo codes that
 * work in the Instagram shopping checkout (validated + discounted server-side).
 */
@ApiTags('Admin - Bot Coupons')
@ApiBearerAuth()
@Controller('admin/bot-coupons')
@UseGuards(AdminAuthGuard, RolesGuard)
export class BotCouponAdminController {
  constructor(private readonly coupons: BotCouponService) {}

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] List checkout coupons' })
  async list() {
    return { success: true, coupons: await this.coupons.list() };
  }

  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] Create a checkout coupon' })
  async create(
    @Body()
    body: {
      code: string;
      discountType: BotCouponType;
      discountValue: number;
      maxDiscountInr?: number;
      minOrderInr?: number;
      isActive?: boolean;
      usageLimit?: number;
      validFrom?: string;
      validUntil?: string;
    },
  ) {
    const coupon = await this.coupons.create({
      code: body.code,
      discountType: body.discountType,
      discountValue: body.discountValue,
      maxDiscountInr: body.maxDiscountInr ?? null,
      minOrderInr: body.minOrderInr ?? null,
      isActive: body.isActive,
      usageLimit: body.usageLimit ?? null,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    });
    return { success: true, coupon };
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] Update a coupon (e.g. toggle isActive)' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) {
    const coupon = await this.coupons.update(id, body);
    if (!coupon) throw new NotFoundException('Coupon not found');
    return { success: true, coupon };
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.CONTENT_MODERATOR)
  @ApiOperation({ summary: '[ADMIN] Delete a coupon' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const ok = await this.coupons.remove(id);
    if (!ok) throw new NotFoundException('Coupon not found');
    return { success: true };
  }
}
