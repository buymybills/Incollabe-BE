import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, literal } from 'sequelize';
import { BotEvent, BotEventType } from './models/bot-event.model';
import { TrackBotEventDto } from './dto/track-bot-event.dto';

const DEFAULT_BRAND = 'thesouledstore';

export interface DateRange {
  brand: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class BotAnalyticsService {
  private readonly logger = new Logger(BotAnalyticsService.name);

  constructor(
    @InjectModel(BotEvent)
    private readonly botEventModel: typeof BotEvent,
  ) {}

  // ==========================================================================
  // INGESTION (fire-and-forget — never blocks the caller)
  // ==========================================================================

  track(events: TrackBotEventDto[]): void {
    const rows = events.map((e) => ({
      brand: e.brand || DEFAULT_BRAND,
      source: e.source || 'instagram',
      userKey: e.userKey ?? null,
      username: e.username ?? null,
      sessionId: e.sessionId ?? null,
      eventType: e.eventType,
      productSlug: e.productSlug ?? null,
      productTitle: e.productTitle ?? null,
      category: e.category ?? null,
      gender: e.gender ?? null,
      size: e.size ?? null,
      priceInr: e.priceInr ?? null,
      valueInr: e.valueInr ?? null,
      query: e.query ?? null,
      faqCategory: e.faqCategory ?? null,
      answered: e.answered ?? null,
      metadata: e.metadata ?? null,
    }));

    this.botEventModel
      .bulkCreate(rows as any[])
      .catch((err) => this.logger.error('Failed to persist bot events', err));
  }

  // ==========================================================================
  // AGGREGATIONS
  // ==========================================================================

  private where(range: DateRange, extra: Record<string, any> = {}) {
    const where: Record<string, any> = { brand: range.brand, ...extra };
    if (range.startDate || range.endDate) {
      where.createdAt = {};
      if (range.startDate) where.createdAt[Op.gte] = range.startDate;
      if (range.endDate) where.createdAt[Op.lte] = range.endDate;
    }
    return where;
  }

  private async countByType(range: DateRange): Promise<Record<string, number>> {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range),
      attributes: ['eventType', [fn('COUNT', col('id')), 'count']],
      group: ['eventType'],
      raw: true,
    })) as unknown as { eventType: string; count: string }[];
    const out: Record<string, number> = {};
    for (const r of rows) out[r.eventType] = parseInt(r.count, 10);
    return out;
  }

  private async uniqueUsers(range: DateRange): Promise<number> {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, { userKey: { [Op.ne]: null } }),
      attributes: [[fn('COUNT', fn('DISTINCT', col('user_key'))), 'count']],
      raw: true,
    })) as unknown as { count: string }[];
    return rows.length ? parseInt(rows[0].count, 10) : 0;
  }

  private async sumValue(range: DateRange, eventType: BotEventType): Promise<number> {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, { eventType }),
      attributes: [[fn('COALESCE', fn('SUM', col('value_inr')), 0), 'sum']],
      raw: true,
    })) as unknown as { sum: string }[];
    return rows.length ? Math.round(Number(rows[0].sum) || 0) : 0;
  }

  private pctChange(current: number, previous: number): number {
    if (!previous) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /** Build the previous comparison window of equal length immediately before the range. */
  private previousRange(range: DateRange): DateRange | null {
    if (!range.startDate || !range.endDate) return null;
    const span = range.endDate.getTime() - range.startDate.getTime();
    return {
      brand: range.brand,
      startDate: new Date(range.startDate.getTime() - span),
      endDate: new Date(range.startDate.getTime()),
    };
  }

  async overview(range: DateRange) {
    const [counts, users, gmv, prev] = await Promise.all([
      this.countByType(range),
      this.uniqueUsers(range),
      this.sumValue(range, BotEventType.PAYMENT_COMPLETED),
      this.previousRange(range)
        ? Promise.all([
            this.countByType(this.previousRange(range)!),
            this.uniqueUsers(this.previousRange(range)!),
            this.sumValue(this.previousRange(range)!, BotEventType.PAYMENT_COMPLETED),
          ])
        : Promise.resolve(null),
    ]);

    const c = (t: BotEventType) => counts[t] || 0;
    // GMV + orders reflect ACTUAL paid orders (Razorpay success), not links created
    const orders = c(BotEventType.PAYMENT_COMPLETED);
    const buyIt = c(BotEventType.BUY_IT_TAP);
    const csAnswered = c(BotEventType.FAQ_ANSWERED);
    const csUnanswered = c(BotEventType.FAQ_UNANSWERED);
    const aov = orders ? Math.round(gmv / orders) : 0;
    const conversionRate = users ? +((orders / users) * 100).toFixed(1) : 0;

    const wrap = (count: number, prevCount: number) => ({
      count,
      percentageChange: this.pctChange(count, prevCount),
    });

    const [pc, pu, pgmv] = prev ?? [{}, 0, 0];
    const pCount = (t: BotEventType) => (pc as Record<string, number>)[t] || 0;

    return {
      uniqueUsers: wrap(users, pu as number),
      buyItTaps: wrap(buyIt, pCount(BotEventType.BUY_IT_TAP)),
      orders: wrap(orders, pCount(BotEventType.PAYMENT_COMPLETED)),
      gmv: wrap(gmv, pgmv as number),
      aov: { count: aov, percentageChange: 0 },
      conversionRate: { count: conversionRate, percentageChange: 0 },
      productsShown: wrap(c(BotEventType.PRODUCTS_SHOWN), pCount(BotEventType.PRODUCTS_SHOWN)),
      csAnswered: wrap(csAnswered, pCount(BotEventType.FAQ_ANSWERED)),
      csUnanswered: wrap(csUnanswered, pCount(BotEventType.FAQ_UNANSWERED)),
    };
  }

  async funnel(range: DateRange) {
    const counts = await this.countByType(range);
    // The monotonic PURCHASE funnel. Deliberately excludes "Reels analysed"
    // (not the true top — text searches also show products, so products_shown
    // can exceed reels_analysed and produce a nonsensical negative drop-off) and
    // "Product taps"/tile_tap (users tap "Buy it" directly on a card, so it's
    // often 0 and breaks the descending chain). Those live as separate metrics.
    const steps: { key: BotEventType; label: string }[] = [
      { key: BotEventType.PRODUCTS_SHOWN, label: 'Products shown' },
      { key: BotEventType.BUY_IT_TAP, label: 'Buy it taps' },
      { key: BotEventType.SIZE_SELECTED, label: 'Size selected' },
      { key: BotEventType.PAYMENT_LINK_CREATED, label: 'Payment link' },
      { key: BotEventType.PAYMENT_COMPLETED, label: 'Paid' },
    ];
    return steps.map((s, i) => {
      const count = counts[s.key] || 0;
      const prev = i === 0 ? count : counts[steps[i - 1].key] || 0;
      // drop-off vs the immediately preceding step, clamped to [0,100] so a
      // data anomaly can never render as a negative / double-negative percent
      const dropOff =
        i === 0 || !prev
          ? 0
          : Math.max(0, Math.min(100, Math.round(((prev - count) / prev) * 100)));
      return { step: s.label, count, dropOffPct: dropOff };
    });
  }

  async timeseries(range: DateRange, metric: 'orders' | 'gmv' | 'users') {
    const where = this.where(range);
    // Daily buckets in IST (created_at is UTC) so chart days match the brand's day.
    const day: any = literal("DATE(created_at AT TIME ZONE 'Asia/Kolkata')");
    let attributes: any[];
    if (metric === 'gmv') {
      where['eventType'] = BotEventType.PAYMENT_COMPLETED;
      attributes = [[day, 'date'], [fn('COALESCE', fn('SUM', col('value_inr')), 0), 'value']];
    } else if (metric === 'orders') {
      where['eventType'] = BotEventType.PAYMENT_COMPLETED;
      attributes = [[day, 'date'], [fn('COUNT', col('id')), 'value']];
    } else {
      where['userKey'] = { [Op.ne]: null };
      attributes = [[day, 'date'], [fn('COUNT', fn('DISTINCT', col('user_key'))), 'value']];
    }
    const rows = (await this.botEventModel.findAll({
      where,
      attributes,
      group: [day],
      order: [[day, 'ASC']],
      raw: true,
    })) as unknown as { date: string; value: string }[];
    return rows.map((r) => ({ date: r.date, value: Number(r.value) }));
  }

  private async topByEvent(range: DateRange, eventType: BotEventType, limit: number) {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, { eventType, productSlug: { [Op.ne]: null } }),
      attributes: [
        'productSlug',
        [fn('MAX', col('product_title')), 'title'],
        [fn('MAX', col('category')), 'category'],
        [fn('MAX', col('price_inr')), 'priceInr'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['productSlug'],
      order: [[literal('count'), 'DESC']],
      limit,
      raw: true,
    })) as unknown as any[];
    return rows.map((r) => ({
      slug: r.productSlug,
      title: r.title,
      category: r.category,
      priceInr: r.priceInr ? Math.round(Number(r.priceInr)) : null,
      count: parseInt(r.count, 10),
    }));
  }

  async topProducts(range: DateRange, metric: 'views' | 'buys' | 'saves' | 'purchases', limit = 20) {
    if (metric === 'purchases') {
      // Real paid orders; fall back to checkout intent until the webhook has data
      const paid = await this.topByEvent(range, BotEventType.PAYMENT_COMPLETED, limit);
      return paid.length ? paid : this.topByEvent(range, BotEventType.PAYMENT_LINK_CREATED, limit);
    }
    const eventType =
      metric === 'buys' ? BotEventType.BUY_IT_TAP
        : metric === 'saves' ? BotEventType.SAVE
          : BotEventType.PRODUCTS_SHOWN;
    return this.topByEvent(range, eventType, limit);
  }

  /**
   * Order list with details — each completed payment (Razorpay success), falling
   * back to payment links created until the webhook has data. For the admin table.
   */
  async orders(range: DateRange, limit = 100) {
    const completed = await this.orderRows(range, BotEventType.PAYMENT_COMPLETED, limit, true);
    if (completed.length) return completed;
    return this.orderRows(range, BotEventType.PAYMENT_LINK_CREATED, limit, false);
  }

  private async orderRows(range: DateRange, eventType: BotEventType, limit: number, paid: boolean) {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, { eventType }),
      attributes: ['productTitle', 'productSlug', 'category', 'size', 'valueInr', 'priceInr', 'username', 'userKey', 'gender', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit,
      raw: true,
    })) as unknown as any[];
    return rows.map((r) => ({
      product: r.productTitle,
      slug: r.productSlug,
      category: r.category,
      size: r.size,
      amountInr: Math.round(Number(r.valueInr ?? r.priceInr ?? 0)),
      username: r.username,
      userKey: r.userKey,
      gender: r.gender,
      paid,
      createdAt: r.createdAt,
    }));
  }

  /** Unmet demand: sold-out + not-found "Buy it"s — what shoppers want but can't get. */
  async demandGaps(range: DateRange, limit = 30) {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, {
        eventType: { [Op.in]: [BotEventType.SOLD_OUT, BotEventType.PRODUCT_NOT_FOUND] },
      }),
      attributes: [
        'eventType',
        [fn('COALESCE', col('product_title'), col('query')), 'label'],
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['eventType', fn('COALESCE', col('product_title'), col('query'))],
      order: [[literal('count'), 'DESC']],
      limit,
      raw: true,
    })) as unknown as any[];
    return rows.map((r) => ({
      type: r.eventType,
      label: r.label,
      count: parseInt(r.count, 10),
    }));
  }

  async faqBreakdown(range: DateRange) {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, {
        eventType: { [Op.in]: [BotEventType.FAQ_ANSWERED, BotEventType.FAQ_UNANSWERED] },
      }),
      attributes: [
        [fn('COALESCE', col('faq_category'), literal("'general'")), 'category'],
        'eventType',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: [fn('COALESCE', col('faq_category'), literal("'general'")), 'eventType'],
      order: [[literal('count'), 'DESC']],
      raw: true,
    })) as unknown as any[];
    const map: Record<string, { category: string; answered: number; unanswered: number }> = {};
    for (const r of rows) {
      const cat = r.category as string;
      map[cat] = map[cat] || { category: cat, answered: 0, unanswered: 0 };
      if (r.eventType === BotEventType.FAQ_UNANSWERED) map[cat].unanswered = parseInt(r.count, 10);
      else map[cat].answered = parseInt(r.count, 10);
    }
    return Object.values(map);
  }

  // ==========================================================================
  // EXPANDED ANALYTICS
  // ==========================================================================

  /** Split a dimension (category/gender) by interactions, for donut charts. */
  private async splitBy(range: DateRange, column: 'category' | 'gender') {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, {
        eventType: { [Op.in]: [BotEventType.PRODUCTS_SHOWN, BotEventType.BUY_IT_TAP, BotEventType.PRICE_ASKED] },
        [column]: { [Op.ne]: null },
      }),
      attributes: [column, [fn('COUNT', col('id')), 'count']],
      group: [column],
      order: [[literal('count'), 'DESC']],
      raw: true,
    })) as unknown as any[];
    return rows.map((r) => ({ label: r[column], count: parseInt(r.count, 10) }));
  }

  categorySplit(range: DateRange) {
    return this.splitBy(range, 'category');
  }
  genderSplit(range: DateRange) {
    return this.splitBy(range, 'gender');
  }

  /** Which sizes shoppers pick — and which are most often sold out (restock signal). */
  async sizeDemand(range: DateRange) {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, {
        size: { [Op.ne]: null },
        eventType: { [Op.in]: [BotEventType.SIZE_SELECTED, BotEventType.SOLD_OUT, BotEventType.STOCK_CHECKED] },
      }),
      attributes: ['size', 'eventType', [fn('COUNT', col('id')), 'count']],
      group: ['size', 'eventType'],
      raw: true,
    })) as unknown as any[];
    const map: Record<string, { size: string; selected: number; soldOut: number }> = {};
    for (const r of rows) {
      const s = String(r.size).toUpperCase();
      map[s] = map[s] || { size: s, selected: 0, soldOut: 0 };
      const c = parseInt(r.count, 10);
      if (r.eventType === BotEventType.SOLD_OUT) map[s].soldOut += c;
      else map[s].selected += c;
    }
    return Object.values(map).sort((a, b) => b.selected + b.soldOut - (a.selected + a.soldOut));
  }

  /** Activity by hour-of-day × weekday — when shoppers engage (heatmap). */
  async heatmap(range: DateRange) {
    // Weekday + hour in IST so "when do shoppers engage" reflects local time.
    const istTs = literal("(created_at AT TIME ZONE 'Asia/Kolkata')");
    const dow = fn('date_part', 'dow', istTs);
    const hour = fn('date_part', 'hour', istTs);
    const rows = (await this.botEventModel.findAll({
      where: this.where(range),
      attributes: [[dow, 'dow'], [hour, 'hour'], [fn('COUNT', col('id')), 'count']],
      group: [dow, hour],
      raw: true,
    })) as unknown as any[];
    return rows.map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), count: parseInt(r.count, 10) }));
  }

  /** Top search queries (free-text shopping intent + tile taps). */
  async topSearches(range: DateRange, limit = 20) {
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, {
        eventType: { [Op.in]: [BotEventType.SEARCH, BotEventType.TILE_TAP, BotEventType.PRICE_ASKED] },
        query: { [Op.ne]: null },
      }),
      attributes: [[fn('LOWER', col('query')), 'query'], [fn('COUNT', col('id')), 'count']],
      group: [fn('LOWER', col('query'))],
      order: [[literal('count'), 'DESC']],
      limit,
      raw: true,
    })) as unknown as any[];
    return rows.map((r) => ({ query: r.query, count: parseInt(r.count, 10) }));
  }

  /** Most-shared reels (from event metadata) — content driving the bot. */
  async topReels(range: DateRange, limit = 15) {
    const url = fn('jsonb_extract_path_text', col('metadata'), 'url');
    const rows = (await this.botEventModel.findAll({
      where: this.where(range, {
        eventType: BotEventType.REEL_SHARED,
        [Op.and]: literal(`metadata->>'url' IS NOT NULL`),
      }),
      attributes: [[url, 'url'], [fn('COUNT', col('id')), 'count']],
      group: [url],
      order: [[literal('count'), 'DESC']],
      limit,
      raw: true,
    })) as unknown as any[];
    return rows.map((r) => ({ url: r.url, count: parseInt(r.count, 10) }));
  }

  /** Abandoned intent: products with Buy-it taps but no payment link (recoverable). */
  async abandonedCarts(range: DateRange, limit = 20) {
    const buys = (await this.botEventModel.findAll({
      where: this.where(range, { eventType: BotEventType.BUY_IT_TAP, productSlug: { [Op.ne]: null } }),
      attributes: ['productSlug', [fn('MAX', col('product_title')), 'title'], [fn('COUNT', col('id')), 'count']],
      group: ['productSlug'],
      raw: true,
    })) as unknown as any[];
    const paid = (await this.botEventModel.findAll({
      where: this.where(range, { eventType: BotEventType.PAYMENT_LINK_CREATED, productSlug: { [Op.ne]: null } }),
      attributes: ['productSlug', [fn('COUNT', col('id')), 'count']],
      group: ['productSlug'],
      raw: true,
    })) as unknown as any[];
    const paidMap: Record<string, number> = {};
    for (const p of paid) paidMap[p.productSlug] = parseInt(p.count, 10);
    const rows = buys
      .map((b) => ({
        slug: b.productSlug,
        title: b.title,
        buys: parseInt(b.count, 10),
        paid: paidMap[b.productSlug] || 0,
      }))
      .map((r) => ({ ...r, abandoned: Math.max(0, r.buys - r.paid) }))
      .filter((r) => r.abandoned > 0)
      .sort((a, b) => b.abandoned - a.abandoned)
      .slice(0, limit);
    const total = rows.reduce((n, r) => n + r.abandoned, 0);
    return { total, products: rows };
  }

  /**
   * New vs returning shoppers. Returning = shopper active on 2+ distinct days
   * (they came back); new = active on a single day. This is meaningful for any
   * view — including the default with no date filter.
   */
  async retention(range: DateRange) {
    const [total, returningRows] = await Promise.all([
      this.uniqueUsers(range),
      this.botEventModel.findAll({
        where: this.where(range, { userKey: { [Op.ne]: null } }),
        attributes: ['userKey'],
        group: ['userKey'],
        // Bucket by INDIAN calendar day (created_at is stored UTC). A shopper who
        // returns just after IST midnight must count as 2 days → returning, even
        // though both events fall on the same UTC date.
        having: literal(
          "COUNT(DISTINCT DATE(created_at AT TIME ZONE 'Asia/Kolkata')) >= 2",
        ),
        raw: true,
      }) as unknown as Promise<{ userKey: string }[]>,
    ]);
    const returningUsers = returningRows.length;
    return { newUsers: Math.max(0, total - returningUsers), returningUsers };
  }
}
