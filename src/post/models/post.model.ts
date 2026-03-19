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
  HasMany,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
import { Like } from './like.model';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'posts',
  timestamps: true,
})
export class Post extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare content?: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  declare mediaUrls: string[];

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(UserType)))
  declare userType: UserType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  declare influencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  declare brandId: number;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare likesCount: number;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare sharesCount: number;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare viewsCount: number;

  // Boost Mode fields
  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isBoosted: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare boostedAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare boostExpiresAt: Date;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare boostPaymentId: string;

  @AllowNull(true)
  @Column(DataType.DECIMAL(10, 2))
  declare boostAmount: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Brand)
  declare brand: Brand;

  @HasMany(() => Like)
  declare likes: Like[];

  get user() {
    return this.userType === UserType.INFLUENCER ? this.influencer : this.brand;
  }
}
