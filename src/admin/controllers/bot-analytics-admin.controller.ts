import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import {
  BotAnalyticsService,
  DateRange,
} from '../../bot-analytics/bot-analytics.service';
import { BotCheckoutService } from '../../bot-checkout/bot-checkout.service';

/**
 * Admin-only analytics for the Instagram shopping bot.
 * Reads aggregates from bot_events. All routes accept
 * ?brand=&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD.
 */
@Controller('admin/dashboard/bot')
@UseGuards(AdminAuthGuard)
export class BotAnalyticsAdminController {
  constructor(
    private readonly botAnalytics: BotAnalyticsService,
    private readonly botCheckout: BotCheckoutService,
  ) {}

  private range(brand?: string, startDate?: string, endDate?: string): DateRange {
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined;
    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined;
    return {
      brand: brand || 'thesouledstore',
      startDate: start && !isNaN(start.getTime()) ? start : undefined,
      endDate: end && !isNaN(end.getTime()) ? end : undefined,
    };
  }

  @Get('overview')
  overview(
    @Query('brand') brand?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.botAnalytics.overview(this.range(brand, startDate, endDate));
  }

  @Get('funnel')
  funnel(
    @Query('brand') brand?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.botAnalytics.funnel(this.range(brand, startDate, endDate));
  }

  @Get('timeseries')
  timeseries(
    @Query('metric') metric: 'orders' | 'gmv' | 'users' = 'orders',
    @Query('brand') brand?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.botAnalytics.timeseries(this.range(brand, startDate, endDate), metric);
  }

  @Get('top-products')
  topProducts(
    @Query('metric') metric: 'views' | 'buys' | 'saves' = 'buys',
    @Query('limit') limit?: string,
    @Query('brand') brand?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.botAnalytics.topProducts(
      this.range(brand, startDate, endDate),
      metric,
      limit ? Math.min(parseInt(limit, 10) || 20, 100) : 20,
    );
  }

  @Get('demand-gaps')
  demandGaps(
    @Query('brand') brand?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.botAnalytics.demandGaps(this.range(brand, startDate, endDate));
  }

  @Get('faq')
  faq(
    @Query('brand') brand?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.botAnalytics.faqBreakdown(this.range(brand, startDate, endDate));
  }

  @Get('category-split')
  categorySplit(@Query('brand') b?: string, @Query('startDate') s?: string, @Query('endDate') e?: string) {
    return this.botAnalytics.categorySplit(this.range(b, s, e));
  }

  @Get('gender-split')
  genderSplit(@Query('brand') b?: string, @Query('startDate') s?: string, @Query('endDate') e?: string) {
    return this.botAnalytics.genderSplit(this.range(b, s, e));
  }

  @Get('size-demand')
  sizeDemand(@Query('brand') b?: string, @Query('startDate') s?: string, @Query('endDate') e?: string) {
    return this.botAnalytics.sizeDemand(this.range(b, s, e));
  }

  @Get('heatmap')
  heatmap(@Query('brand') b?: string, @Query('startDate') s?: string, @Query('endDate') e?: string) {
    return this.botAnalytics.heatmap(this.range(b, s, e));
  }

  @Get('top-searches')
  topSearches(@Query('brand') b?: string, @Query('startDate') s?: string, @Query('endDate') e?: string) {
    return this.botAnalytics.topSearches(this.range(b, s, e));
  }

  @Get('top-reels')
  topReels(@Query('brand') b?: string, @Query('startDate') s?: string, @Query('endDate') e?: string) {
    return this.botAnalytics.topReels(this.range(b, s, e));
  }

  @Get('abandoned-carts')
  abandonedCarts(@Query('brand') b?: string, @Query('startDate') s?: string, @Query('endDate') e?: string) {
    return this.botAnalytics.abandonedCarts(this.range(b, s, e));
  }

  @Get('retention')
  retention(@Query('brand') b?: string, @Query('startDate') s?: string, @Query('endDate') e?: string) {
    return this.botAnalytics.retention(this.range(b, s, e));
  }

  @Get('orders')
  async orders(
    @Query('limit') limit?: string,
    @Query('brand') b?: string,
    @Query('startDate') s?: string,
    @Query('endDate') e?: string,
  ) {
    const range = this.range(b, s, e);
    const lim = limit ? Math.min(parseInt(limit, 10) || 100, 500) : 100;
    // Prefer the rich bot_orders table (shipping address + Razorpay txn). Fall back
    // to the bot_events-derived list until checkout orders exist.
    const rich = await this.botCheckout.adminOrders(range, lim);
    if (rich.length) return rich;
    return this.botAnalytics.orders(range, lim);
  }
}
