import { Column, Model, Table, DataType, PrimaryKey, AutoIncrement, BelongsToMany } from 'sequelize-typescript';
import { Niche } from './niche.model';
import { BrandNiche } from './brand-niche.model';

export interface BrandCreationAttributes {
  email: string;
  phone: string;
  password?: string;
  isPhoneVerified?: boolean;
  brandName?: string;
  username?: string;
  legalEntityName?: string;
  companyType?: string;
  brandEmailId?: string;
  pocName?: string;
  pocDesignation?: string;
  pocEmailId?: string;
  pocContactNumber?: string;
  brandBio?: string;
  profileImage?: string;
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
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  password: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
    validate: {
      is: {
        args: /^\+91[6-9]\d{9}$/,
        msg: 'Phone number must be in format +91XXXXXXXXXX where X is a valid Indian mobile number',
      },
    },
  })
  phone: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isPhoneVerified: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  brandName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  username: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  legalEntityName: string;

  @Column({
    type: DataType.ENUM,
    values: [
      'Private Limited Company (Pvt. Ltd.)',
      'Public Limited Company (PLC)',
      'One-Person Company (OPC)',
      'Limited Liability Partnership (LLP)',
      'Partnership Firm'
    ],
    allowNull: true,
  })
  companyType: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  brandEmailId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  pocName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  pocDesignation: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  pocEmailId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  pocContactNumber: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  brandBio: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  profileImage: string;


  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  incorporationDocument: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  gstDocument: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  panDocument: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isProfileCompleted: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

  @BelongsToMany(() => Niche, () => BrandNiche)
  niches: Niche[];
}