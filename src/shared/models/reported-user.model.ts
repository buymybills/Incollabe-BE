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

export enum ReportUserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  FAKE_ACCOUNT = 'fake_account',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  SCAM = 'scam',
  HATE_SPEECH = 'hate_speech',
  OTHER = 'other',
}

export const AUTO_SUSPEND_THRESHOLD = 5;

@Table({ tableName: 'reported_users', timestamps: true, underscored: true })
export class ReportedUser extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  // Reporter (who filed the report)
  @AllowNull(false)
  @Index
  @Column({ type: DataType.ENUM(...Object.values(ReportUserType)), field: 'reporter_type' })
  declare reporterType: ReportUserType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column({ type: DataType.INTEGER, field: 'reporter_influencer_id' })
  declare reporterInfluencerId: number | null;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column({ type: DataType.INTEGER, field: 'reporter_brand_id' })
  declare reporterBrandId: number | null;

  // Reported (who was reported)
  @AllowNull(false)
  @Index
  @Column({ type: DataType.ENUM(...Object.values(ReportUserType)), field: 'reported_type' })
  declare reportedType: ReportUserType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column({ type: DataType.INTEGER, field: 'reported_influencer_id' })
  declare reportedInfluencerId: number | null;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column({ type: DataType.INTEGER, field: 'reported_brand_id' })
  declare reportedBrandId: number | null;

  @AllowNull(false)
  @Column({ type: DataType.ENUM(...Object.values(ReportReason)), field: 'reason' })
  declare reason: ReportReason;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'description' })
  declare description: string | null;

  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, defaultValue: false, field: 'is_overruled' })
  declare isOverruled: boolean;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: 'overruled_at' })
  declare overruledAt: Date | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => Influencer, 'reporterInfluencerId')
  declare reporterInfluencer: Influencer;

  @BelongsTo(() => Brand, 'reporterBrandId')
  declare reporterBrand: Brand;

  @BelongsTo(() => Influencer, 'reportedInfluencerId')
  declare reportedInfluencer: Influencer;

  @BelongsTo(() => Brand, 'reportedBrandId')
  declare reportedBrand: Brand;

  get reporterId(): number {
    return this.reporterType === ReportUserType.INFLUENCER
      ? this.reporterInfluencerId!
      : this.reporterBrandId!;
  }

  get reportedId(): number {
    return this.reportedType === ReportUserType.INFLUENCER
      ? this.reportedInfluencerId!
      : this.reportedBrandId!;
  }
}
