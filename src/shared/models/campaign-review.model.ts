import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export enum ReviewerType {
  BRAND = 'brand',
  INFLUENCER = 'influencer',
}

@Table({
  tableName: 'campaign_reviews',
  timestamps: true,
  underscored: true,
})
export class CampaignReview extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'campaign_id',
  })
  declare campaignId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'campaign_application_id',
  })
  declare campaignApplicationId: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    field: 'reviewer_type',
  })
  declare reviewerType: ReviewerType;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'reviewer_id',
  })
  declare reviewerId: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    field: 'reviewee_type',
  })
  declare revieweeType: ReviewerType;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'reviewee_id',
  })
  declare revieweeId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare rating: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'review_text',
  })
  declare reviewText: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
