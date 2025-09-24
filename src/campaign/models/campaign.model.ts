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

@Table({
  tableName: 'campaigns',
  timestamps: true,
})
export class Campaign extends Model<Campaign> {
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
  name: string;

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
    defaultValue: CampaignStatus.DRAFT,
  })
  status: CampaignStatus;

  @Column({
    type: DataType.ENUM(...Object.values(CampaignType)),
    allowNull: false,
    defaultValue: CampaignType.PAID,
  })
  type: CampaignType;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  startDate: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  endDate: Date;

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
  nicheIds: number[];

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
  brand: Brand;

  @HasMany(() => CampaignCity)
  cities: CampaignCity[];

  @HasMany(() => CampaignDeliverable)
  deliverables: CampaignDeliverable[];

  @HasMany(() => CampaignInvitation)
  invitations: CampaignInvitation[];
}
