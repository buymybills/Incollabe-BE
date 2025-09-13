import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  Unique,
  AllowNull,
  BelongsToMany,
} from 'sequelize-typescript';
import { Niche } from './niche.model';
import { InfluencerNiche } from './influencer-niche.model';

@Table({
  tableName: 'influencers',
  timestamps: true,
})
export class Influencer extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  username: string;

  @AllowNull(false)
  @Unique
  @Column({
    type: DataType.STRING,
    validate: {
      is: {
        args: /^\+91[6-9]\d{9}$/,
        msg: 'Phone number must be in format +91XXXXXXXXXX where X is a valid Indian mobile number',
      },
    },
  })
  phone: string;

  @AllowNull(true)
  @Column(DataType.DATEONLY)
  dateOfBirth: Date;

  @AllowNull(true)
  @Column(DataType.ENUM('Male', 'Female', 'Others'))
  gender: 'Male' | 'Female' | 'Others';

  @AllowNull(true)
  @Column(DataType.TEXT)
  bio: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  profileImage: string;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isPhoneVerified: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  lastLoginAt: Date;

  @AllowNull(true)
  @Column(DataType.STRING)
  deviceToken: string;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @BelongsToMany(() => Niche, () => InfluencerNiche)
  niches: Niche[];
}