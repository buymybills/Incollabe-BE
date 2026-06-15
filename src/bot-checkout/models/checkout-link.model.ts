import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, AllowNull } from 'sequelize-typescript';

/**
 * A short id → full signed checkout token mapping, so the link the bot DMs is
 * tiny (`/api/checkout/<id>`) instead of embedding the whole base64 payload.
 * The stored token is still the tamper-proof HMAC-signed token; we just resolve
 * the short id back to it when the page (or its APIs) need the payload.
 */
@Table({
  tableName: 'checkout_links',
  timestamps: true,
  underscored: true,
})
export class CheckoutLink extends Model {
  /** Short, URL-safe random id used in the public link. */
  @Column({ type: DataType.STRING(16), primaryKey: true })
  declare id: string;

  /** The full signed checkout token this id resolves to. */
  @AllowNull(false)
  @Column(DataType.TEXT)
  declare token: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
