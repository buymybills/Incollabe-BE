import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Index,
} from 'sequelize-typescript';

export enum ContentType {
  STORY = 'story',
  POST_REEL = 'post_reel',
}

export interface CashbackTierCreationAttributes {
  minFollowers: number;
  maxFollowers: number | null;
  contentType: ContentType;
  cashbackPercentage: number;
  isActive?: boolean;
}

@Table({
  tableName: 'cashback_tiers',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'idx_cashback_tiers_followers',
      fields: ['min_followers', 'max_followers'],
    },
    {
      name: 'idx_cashback_tiers_content',
      fields: ['content_type'],
    },
    {
      name: 'idx_cashback_tiers_active',
      fields: ['is_active'],
    },
  ],
})
export class CashbackTier extends Model<
  CashbackTier,
  CashbackTierCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'min_followers',
  })
  @Index
  declare minFollowers: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'max_followers',
    comment: 'NULL means unlimited (no upper limit)',
  })
  @Index
  declare maxFollowers: number | null;

  @Column({
    type: DataType.ENUM(...Object.values(ContentType)),
    allowNull: false,
    field: 'content_type',
  })
  @Index
  declare contentType: ContentType;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    field: 'cashback_percentage',
    comment: 'Cashback percentage (e.g., 25.00 = 25%)',
  })
  declare cashbackPercentage: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  })
  @Index
  declare isActive: boolean;

  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  /**
   * Check if a follower count falls within this tier's range
   */
  isInRange(followerCount: number): boolean {
    const meetsMin = followerCount >= this.minFollowers;
    const meetsMax = this.maxFollowers === null || followerCount <= this.maxFollowers;
    return meetsMin && meetsMax;
  }

  /**
   * Get a human-readable range description
   */
  getRangeDescription(): string {
    if (this.maxFollowers === null) {
      return `${this.minFollowers.toLocaleString()}+ followers`;
    }
    return `${this.minFollowers.toLocaleString()} - ${this.maxFollowers.toLocaleString()} followers`;
  }

  /**
   * Calculate cashback amount for a given order value
   */
  calculateCashback(orderAmount: number): number {
    return (orderAmount * this.cashbackPercentage) / 100;
  }
}
