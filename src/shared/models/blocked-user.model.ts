import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

export enum BlockUserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({ tableName: 'blocked_users', timestamps: true })
export class BlockedUser extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  // Blocker (who initiated the block)
  @AllowNull(false)
  @Index
  @Column({ type: DataType.ENUM(...Object.values(BlockUserType)), field: 'blocker_type' })
  declare blockerType: BlockUserType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column({ type: DataType.INTEGER, field: 'blocker_influencer_id' })
  declare blockerInfluencerId: number | null;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column({ type: DataType.INTEGER, field: 'blocker_brand_id' })
  declare blockerBrandId: number | null;

  // Blocked (who got blocked)
  @AllowNull(false)
  @Index
  @Column({ type: DataType.ENUM(...Object.values(BlockUserType)), field: 'blocked_type' })
  declare blockedType: BlockUserType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column({ type: DataType.INTEGER, field: 'blocked_influencer_id' })
  declare blockedInfluencerId: number | null;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column({ type: DataType.INTEGER, field: 'blocked_brand_id' })
  declare blockedBrandId: number | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => Influencer, 'blockerInfluencerId')
  declare blockerInfluencer: Influencer;

  @BelongsTo(() => Brand, 'blockerBrandId')
  declare blockerBrand: Brand;

  @BelongsTo(() => Influencer, 'blockedInfluencerId')
  declare blockedInfluencer: Influencer;

  @BelongsTo(() => Brand, 'blockedBrandId')
  declare blockedBrand: Brand;

  get blockerId(): number {
    return this.blockerType === BlockUserType.INFLUENCER
      ? this.blockerInfluencerId!
      : this.blockerBrandId!;
  }

  get blockedId(): number {
    return this.blockedType === BlockUserType.INFLUENCER
      ? this.blockedInfluencerId!
      : this.blockedBrandId!;
  }
}
