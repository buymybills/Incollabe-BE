import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Campaign } from './campaign.model';

export enum DeliverableType {
  // Social Media Deliverables (for UGC, PAID, BARTER)
  INSTAGRAM_POST = 'instagram_post',
  INSTAGRAM_STORY = 'instagram_story',
  INSTAGRAM_REEL = 'instagram_reel',
  YOUTUBE_SHORT = 'youtube_short',
  YOUTUBE_LONG_VIDEO = 'youtube_long_video',
  FACEBOOK_POST = 'facebook_post',
  FACEBOOK_STORY = 'facebook_story',
  LINKEDIN_POST = 'linkedin_post',
  TWITTER_POST = 'twitter_post',

  // Engagement Deliverables (for ENGAGEMENT)
  LIKE_COMMENT = 'like_comment',
  PLAYSTORE_REVIEW = 'playstore_review',
  APPSTORE_REVIEW = 'appstore_review',
  GOOGLE_REVIEW = 'google_review',
  APP_DOWNLOAD = 'app_download',
}

export enum Platform {
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook',
  LINKEDIN = 'linkedin',
  TWITTER = 'twitter',
  ENGAGEMENT = 'engagement', // For engagement-type deliverables
}

@Table({
  tableName: 'campaign_deliverables',
  timestamps: false,
})
export class CampaignDeliverable extends Model<CampaignDeliverable> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Campaign)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  campaignId: number;

  @Column({
    type: DataType.ENUM(...Object.values(Platform)),
    allowNull: false,
  })
  platform: Platform;

  @Column({
    type: DataType.ENUM(...Object.values(DeliverableType)),
    allowNull: false,
  })
  type: DeliverableType;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  budget: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  quantity: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  specifications: string;

  // Associations
  @BelongsTo(() => Campaign)
  campaign: Campaign;
}
