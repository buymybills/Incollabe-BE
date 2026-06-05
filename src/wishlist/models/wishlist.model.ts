import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  HasMany,
  AllowNull,
  Default,
  Index,
  Unique,
} from 'sequelize-typescript';
import { WishlistItem } from './wishlist-item.model';

@Table({ tableName: 'wishlists', timestamps: true })
export class Wishlist extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  declare id: number;

  /** Instagram sender ID — the owner of this wishlist */
  @Index
  @AllowNull(false)
  @Column({ type: DataType.STRING(64), field: 'ig_sender_id' })
  declare igSenderId: string;

  /** Folder name, e.g. "Dresses", "Shoes" — unique per user */
  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare name: string;

  /** UUID token used for the public share link */
  @Unique
  @AllowNull(false)
  @Column({ type: DataType.UUID, field: 'share_token', defaultValue: DataType.UUIDV4 })
  declare shareToken: string;

  @HasMany(() => WishlistItem)
  declare items: WishlistItem[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
