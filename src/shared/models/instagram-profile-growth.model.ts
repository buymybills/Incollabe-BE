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

export interface InstagramProfileGrowthCreationAttributes {
  influencerId?: number;
  brandId?: number;
  instagramUserId: string;
  instagramUsername?: string;
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  avgLikes?: number;
  avgComments?: number;
  avgReach?: number;
  avgImpressions?: number;
  avgSaves?: number;
  engagementRate?: number;
  snapshotDate: Date;
}

@Table({ tableName: 'instagram_profile_growth', timestamps: true, underscored: true })
export class InstagramProfileGrowth extends Model<InstagramProfileGrowth, InstagramProfileGrowthCreationAttributes> {
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

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare followersCount: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare followsCount: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare mediaCount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  declare avgLikes: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  declare avgComments: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare avgReach: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare avgImpressions: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare avgSaves: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
  })
  declare engagementRate: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  declare snapshotDate: Date;

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
