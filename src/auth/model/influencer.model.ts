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
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Niche } from './niche.model';
import { InfluencerNiche } from './influencer-niche.model';
import { Country } from '../../shared/models/country.model';
import { City } from '../../shared/models/city.model';
import { GENDER_OPTIONS, OTHERS_GENDER_OPTIONS } from '../types/gender.enum';
import type { GenderType, OthersGenderType } from '../types/gender.enum';

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
  @Column(DataType.ENUM(...GENDER_OPTIONS))
  gender: GenderType;

  @AllowNull(true)
  @Column(DataType.ENUM(...OTHERS_GENDER_OPTIONS))
  othersGender: OthersGenderType;

  @AllowNull(true)
  @Column(DataType.TEXT)
  bio: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  profileImage: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  profileBanner: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  profileHeadline: string;

  @ForeignKey(() => Country)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  countryId: number;

  @ForeignKey(() => City)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  cityId: number;

  @AllowNull(true)
  @Column(DataType.STRING)
  whatsappNumber: string;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isWhatsappVerified: boolean;

  // Social Media Links
  @AllowNull(true)
  @Column(DataType.STRING)
  instagramUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  youtubeUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  facebookUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  linkedinUrl: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  twitterUrl: string;

  // Collaboration Costs (stored as JSON)
  @AllowNull(true)
  @Column(DataType.JSON)
  collaborationCosts: object;

  // Profile Completion Status
  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isProfileCompleted: boolean;

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

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isVerified: boolean;

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

  @BelongsTo(() => Country)
  country: Country;

  @BelongsTo(() => City)
  city: City;
}
