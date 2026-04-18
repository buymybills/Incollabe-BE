import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  Index,
} from 'sequelize-typescript';
import { Message } from './message.model';

@Table({
  tableName: 'message_encrypted_keys',
  timestamps: false,
})
export class MessageEncryptedKey extends Model<MessageEncryptedKey> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => Message)
  @Index
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare messageId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare recipientId: number;

  @Column({
    type: DataType.ENUM('influencer', 'brand'),
    allowNull: false,
  })
  declare recipientType: 'influencer' | 'brand';

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare encryptedKey: string;
}
