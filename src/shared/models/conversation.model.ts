import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  Index,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';
// import { Message } from './message.model'; // Circular dependency - will be resolved at runtime

export enum ParticipantType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'conversations',
  timestamps: true,
})
export class Conversation extends Model<Conversation> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  // New generic participant fields
  @Index
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  declare participant1Type: ParticipantType;

  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare participant1Id: number;

  @Index
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  declare participant2Type: ParticipantType;

  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare participant2Id: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare unreadCountParticipant1: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare unreadCountParticipant2: number;

  // Legacy fields (for backward compatibility - nullable now)
  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare influencerId: number;

  @ForeignKey(() => Brand)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare brandId: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare lastMessage: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare lastMessageAt: Date;

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
  })
  declare lastMessageSenderType: string; // 'influencer' or 'brand'

  @Column({
    type: DataType.STRING(20),
    allowNull: true,
    defaultValue: 'text',
  })
  declare lastMessageType: string; // 'text' | 'image' | 'video' | 'audio' | 'file' | 'media'

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare unreadCountInfluencer: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare unreadCountBrand: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  // Campaign chat fields
  @Column({
    type: DataType.STRING(20),
    defaultValue: 'personal',
    field: 'conversation_type',
  })
  declare conversationType: 'personal' | 'campaign';

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'campaign_id',
  })
  declare campaignId: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'campaign_application_id',
  })
  declare campaignApplicationId: number | null;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    field: 'is_campaign_closed',
  })
  declare isCampaignClosed: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'campaign_closed_at',
  })
  declare campaignClosedAt: Date | null;

  // Associations
  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Brand)
  declare brand: Brand;

  @HasMany(() => require('./message.model').Message)
  declare messages: any[];
}
