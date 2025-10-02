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
} from 'sequelize-typescript';
import { Admin } from './admin.model';

export enum ProfileType {
  BRAND = 'brand',
  INFLUENCER = 'influencer',
}

export enum ReviewStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Table({
  tableName: 'profile_reviews',
  timestamps: true,
})
export class ProfileReview extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare profileId: number;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(ProfileType)))
  declare profileType: ProfileType;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM(...Object.values(ReviewStatus)),
    defaultValue: ReviewStatus.PENDING,
  })
  declare status: ReviewStatus;

  @ForeignKey(() => Admin)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare reviewedBy: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare rejectionReason: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare adminComments: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare reviewedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare submittedAt: Date;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare statusViewed: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Admin)
  declare reviewer: Admin;
}
