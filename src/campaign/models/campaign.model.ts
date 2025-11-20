import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Brand } from '../../brand/model/brand.model';
import { CampaignCity } from './campaign-city.model';
import { CampaignDeliverable } from './campaign-deliverable.model';
import { CampaignInvitation } from './campaign-invitation.model';
import { CampaignApplication } from './campaign-application.model';

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum CampaignType {
  PAID = 'paid',
  BARTER = 'barter',
  HYBRID = 'hybrid',
}

export interface CampaignCreationAttributes {
  brandId: number;
  name: string;
  description?: string;
  category?: string;
  deliverableFormat?: string;
  status?: CampaignStatus;
  type?: CampaignType;
  isInviteOnly?: boolean;
  isPanIndia?: boolean;
  minAge?: number;
  maxAge?: number;
  isOpenToAllAges?: boolean;
  genderPreferences?: string[];
  isOpenToAllGenders?: boolean;
  nicheIds?: number[];
  customInfluencerRequirements?: string;
  performanceExpectations?: string;
  brandSupport?: string;
  isActive?: boolean;
}

@Table({
  tableName: 'campaigns',
  timestamps: true,
})
export class Campaign extends Model<Campaign, CampaignCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  brandId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  category: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  deliverableFormat: string;

  @Column({
    type: DataType.ENUM(...Object.values(CampaignStatus)),
    allowNull: false,
    defaultValue: CampaignStatus.ACTIVE,
  })
  declare status: CampaignStatus;

  @Column({
    type: DataType.ENUM(...Object.values(CampaignType)),
    allowNull: false,
    defaultValue: CampaignType.PAID,
  })
  type: CampaignType;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isInviteOnly: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isPanIndia: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  minAge: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  maxAge: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isOpenToAllAges: boolean;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  genderPreferences: string[];

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isOpenToAllGenders: boolean;

  @Column({
    type: DataType.JSON,
    allowNull: true,
  })
  declare nicheIds: number[];

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  customInfluencerRequirements: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  performanceExpectations: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  brandSupport: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  isActive: boolean;

  // Associations
  @BelongsTo(() => Brand)
  declare brand: Brand;

  @HasMany(() => CampaignCity)
  declare cities: CampaignCity[];

  @HasMany(() => CampaignDeliverable)
  declare deliverables: CampaignDeliverable[];

  @HasMany(() => CampaignInvitation)
  declare invitations: CampaignInvitation[];

  @HasMany(() => CampaignApplication)
  declare applications: CampaignApplication[];
}
