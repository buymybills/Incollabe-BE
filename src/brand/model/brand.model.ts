import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  BelongsToMany,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Niche } from '../../auth/model/niche.model';
import { BrandNiche } from './brand-niche.model';
import { Country } from '../../shared/models/country.model';
import { City } from '../../shared/models/city.model';
import { CompanyType } from '../../shared/models/company-type.model';

export interface BrandCreationAttributes {
  email: string;
  phone: string | null;
  password?: string;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  brandName?: string;
  username?: string;
  legalEntityName?: string;
  companyTypeId?: number;
  brandEmailId?: string;
  pocName?: string;
  pocDesignation?: string;
  pocEmailId?: string;
  pocContactNumber?: string;
  brandBio?: string;
  profileImage?: string;
  profileBanner?: string;
  profileHeadline?: string;
  websiteUrl?: string;
  foundedYear?: number;
  headquarterCountryId?: number;
  headquarterCityId?: number;
  activeRegions?: string[];
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  incorporationDocument?: string;
  gstDocument?: string;
  panDocument?: string;
  isProfileCompleted?: boolean;
  isActive?: boolean;
}

@Table({ tableName: 'brands', timestamps: true })
export class Brand extends Model<Brand, BrandCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare password: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare phone: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isPhoneVerified: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isEmailVerified: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare brandName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare username: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare legalEntityName: string;

  @ForeignKey(() => CompanyType)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare companyTypeId: number;

  @BelongsTo(() => CompanyType)
  companyType: CompanyType;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare brandEmailId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare pocName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare pocDesignation: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare pocEmailId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare pocContactNumber: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare brandBio: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare profileImage: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare profileBanner: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare fcmToken: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare profileHeadline: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare websiteUrl: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare foundedYear: number;

  @ForeignKey(() => Country)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare headquarterCountryId: number;

  @ForeignKey(() => City)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare headquarterCityId: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  declare activeRegions: string[];

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare facebookUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare instagramUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare youtubeUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare linkedinUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare twitterUrl: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare incorporationDocument: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare gstDocument: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare panDocument: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isProfileCompleted: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isVerified: boolean;

  @BelongsToMany(() => Niche, () => BrandNiche)
  declare niches: Niche[];

  @BelongsTo(() => Country, 'headquarterCountryId')
  declare headquarterCountry: Country;

  @BelongsTo(() => City, 'headquarterCityId')
  declare headquarterCity: City;
}
