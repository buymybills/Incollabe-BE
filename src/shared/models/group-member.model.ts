import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Index,
} from 'sequelize-typescript';
import { GroupChat } from './group-chat.model';

export enum MemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum MemberType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
  ADMIN = 'admin',
}

@Table({
  tableName: 'group_members',
  timestamps: false, // Using joinedAt instead
})
export class GroupMember extends Model<GroupMember> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => GroupChat)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare groupChatId: number;

  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare memberId: number;

  @Index
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  declare memberType: MemberType;

  @Column({
    type: DataType.STRING(20),
    defaultValue: MemberRole.MEMBER,
  })
  declare role: MemberRole;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare joinedAt: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare lastReadMessageId: number;

  @Index
  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare leftAt: Date;

  // Associations
  @BelongsTo(() => GroupChat)
  declare groupChat: GroupChat;
}
