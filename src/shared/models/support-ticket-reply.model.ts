import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { SupportTicket } from './support-ticket.model';
import { Admin } from '../../admin/models/admin.model';
import { Influencer } from '../../auth/model/influencer.model';
import { Brand } from '../../brand/model/brand.model';

export enum ReplyAuthorType {
  ADMIN = 'admin',
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

@Table({
  tableName: 'support_ticket_replies',
  timestamps: true,
})
export class SupportTicketReply extends Model<SupportTicketReply> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => SupportTicket)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare ticketId: number;

  @Column({
    type: DataType.ENUM(...Object.values(ReplyAuthorType)),
    allowNull: false,
  })
  declare authorType: ReplyAuthorType;

  @ForeignKey(() => Admin)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare adminId: number;

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
    allowNull: false,
  })
  declare message: string;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: true,
    defaultValue: [],
  })
  declare imageUrls: string[];

  // Associations
  @BelongsTo(() => SupportTicket)
  declare ticket: SupportTicket;

  @BelongsTo(() => Admin)
  declare admin: Admin;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @BelongsTo(() => Brand)
  declare brand: Brand;
}
