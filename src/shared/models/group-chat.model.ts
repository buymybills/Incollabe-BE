import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  HasOne,
} from 'sequelize-typescript';
import { GroupMember } from './group-member.model';
import { Conversation } from './conversation.model';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
  ADMIN = 'admin',
}

@Table({
  tableName: 'group_chats',
  timestamps: true,
})
export class GroupChat extends Model<GroupChat> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare avatarUrl: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare createdById: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  declare createdByType: UserType;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 10,
  })
  declare maxMembers: number;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  // Timestamps
  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;

  // Associations
  @HasMany(() => GroupMember)
  declare members: GroupMember[];

  @HasOne(() => Conversation)
  declare conversation: Conversation;
}
