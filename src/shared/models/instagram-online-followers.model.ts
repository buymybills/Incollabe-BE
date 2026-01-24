import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

/**
 * Represents hourly distribution of when followers are online
 * Format: { hour: 0-23, value: count_of_followers_online }
 */
export interface OnlineFollowersData {
  hour: number;
  value: number;
}

export interface InstagramOnlineFollowersCreationAttributes {
  influencerId?: number;
  brandId?: number;
  instagramUserId: string;
  instagramUsername?: string;
  onlineFollowersData: OnlineFollowersData[];
  fetchedAt: Date;
}

@Table({ tableName: 'instagram_online_followers', timestamps: true, underscored: true })
export class InstagramOnlineFollowers extends Model<InstagramOnlineFollowers, InstagramOnlineFollowersCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare influencerId: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare brandId: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare instagramUserId: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare instagramUsername: string;

  /**
   * Stores hourly distribution of online followers
   * Format: [{ hour: 0, value: 1234 }, { hour: 1, value: 2345 }, ...]
   * hour: 0-23 (24-hour format)
   * value: number of followers online at that hour
   */
  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  declare onlineFollowersData: OnlineFollowersData[];

  /**
   * When this data was fetched from Instagram API
   */
  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare fetchedAt: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Brand)
  declare brand: Brand;
}
