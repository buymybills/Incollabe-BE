import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  AllowNull,
  Index,
  Default,
} from 'sequelize-typescript';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Every meaningful step a shopper takes with the Instagram shopping bot.
 * These map 1:1 to the handler/tool points in the bot (Gemini ai project).
 */
export enum BotEventType {
  // Discovery / reels
  REEL_SHARED = 'reel_shared',
  REEL_ANALYZED = 'reel_analyzed',
  PRODUCTS_SHOWN = 'products_shown',
  TILE_TAP = 'tile_tap',
  SEARCH = 'search',
  SHOW_MORE = 'show_more',
  // Purchase funnel
  BUY_IT_TAP = 'buy_it_tap',
  SIZE_SELECTED = 'size_selected',
  STOCK_CHECKED = 'stock_checked',
  SOLD_OUT = 'sold_out',
  PRODUCT_NOT_FOUND = 'product_not_found',
  PAYMENT_LINK_CREATED = 'payment_link_created',
  PAYMENT_COMPLETED = 'payment_completed',
  // Engagement
  SAVE = 'save',
  UNSAVE = 'unsave',
  REVIEW_VIEWED = 'review_viewed',
  SIZE_CHART_VIEWED = 'size_chart_viewed',
  PRICE_ASKED = 'price_asked',
  STYLE_ADVICE = 'style_advice',
  // Customer service
  FAQ_ANSWERED = 'faq_answered',
  FAQ_UNANSWERED = 'faq_unanswered',
  // Quality
  MODEL_ERROR = 'model_error',
}

// ============================================================================
// MODEL
// ============================================================================

@Table({
  tableName: 'bot_events',
  timestamps: false,
  underscored: true,
})
export class BotEvent extends Model<BotEvent> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  // Tenant — which brand this bot is serving (multi-tenant from day 1)
  @AllowNull(false)
  @Default('thesouledstore')
  @Index
  @Column(DataType.STRING(60))
  declare brand: string;

  @AllowNull(false)
  @Default('instagram')
  @Column(DataType.STRING(20))
  declare source: string;

  // Hashed Instagram sender id (never store the raw id)
  @AllowNull(true)
  @Index
  @Column(DataType.STRING(64))
  declare userKey: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  declare sessionId: string | null;

  // Event
  @AllowNull(false)
  @Index
  @Column(DataType.STRING(40))
  declare eventType: BotEventType;

  // Product context (when applicable)
  @AllowNull(true)
  @Index
  @Column(DataType.STRING(180))
  declare productSlug: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare productTitle: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(120))
  declare category: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare gender: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare size: string | null;

  @AllowNull(true)
  @Column(DataType.FLOAT)
  declare priceInr: number | null;

  // Revenue contribution (payment_link_created / payment_completed)
  @AllowNull(true)
  @Column(DataType.FLOAT)
  declare valueInr: number | null;

  // Search / question context
  @AllowNull(true)
  @Column(DataType.STRING(300))
  declare query: string | null;

  @AllowNull(true)
  @Column(DataType.STRING(60))
  declare faqCategory: string | null;

  @AllowNull(true)
  @Column(DataType.BOOLEAN)
  declare answered: boolean | null;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare metadata: Record<string, any> | null;

  @CreatedAt
  @Index
  @Column({ field: 'created_at' })
  declare createdAt: Date;
}
