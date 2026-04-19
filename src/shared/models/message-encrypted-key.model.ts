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
    field: 'message_id',
  })
  declare messageId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'recipient_id',
  })
  declare recipientId: number;

  @Column({
    type: DataType.ENUM('influencer', 'brand'),
    allowNull: false,
    field: 'recipient_type',
  })
  declare recipientType: 'influencer' | 'brand';

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'encrypted_key',
  })
  declare encryptedKey: string;
}
