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

  @AllowNull(false)
  @Column(DataType.TEXT)
  content: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  mediaUrls: string[];

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(UserType)))
  userType: UserType;

  @AllowNull(true)
  @ForeignKey(() => Influencer)
  @Column(DataType.INTEGER)
  influencerId: number;

  @AllowNull(true)
  @ForeignKey(() => Brand)
  @Column(DataType.INTEGER)
  brandId: number;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  likesCount: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  influencer: Influencer;

  @BelongsTo(() => Brand)
  brand: Brand;

  @HasMany(() => Like)
  likes: Like[];

  get user() {
    return this.userType === UserType.INFLUENCER ? this.influencer : this.brand;
  }
}
