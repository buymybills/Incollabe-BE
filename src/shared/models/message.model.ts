import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { Conversation } from './conversation.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  MEDIA = 'media', // For mixed/multiple media attachments
}

export enum SenderType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'messages',
  timestamps: true,
})
export class Message extends Model<Message> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => Conversation)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare conversationId: number;

  @Column({
    type: DataType.ENUM(...Object.values(SenderType)),
    allowNull: false,
  })
  declare senderType: SenderType;

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
    type: DataType.ENUM(...Object.values(MessageType)),
    defaultValue: MessageType.TEXT,
  })
  declare messageType: MessageType;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  // For encrypted messages, stores JSON with dual encryption:
  // { encryptedKeyForSender, encryptedKeyForRecipient, iv, ciphertext, version }
  // Both sender and recipient can decrypt using their own private keys
  declare content: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  declare attachmentUrl: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  declare attachmentName: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: true,
  })
  declare mediaType: string; // MIME type e.g. image/jpeg, video/mp4

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isRead: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare readAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isDeleted: boolean;

  // E2EE fields
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare isEncrypted: boolean;

  @Column({
    type: DataType.STRING(10),
    defaultValue: 'v1',
  })
  declare encryptionVersion: string;

  // Associations
  @BelongsTo(() => Conversation)
  declare conversation: Conversation;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Brand)
  declare brand: Brand;
}
