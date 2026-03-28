import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Admin } from '../../admin/models/admin.model';
import { ProSubscription } from './pro-subscription.model';

@Table({
  tableName: 'pro_subscription_promotions',
  timestamps: true,
  underscored: true,
})
export class ProSubscriptionPromotion extends Model {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 19900, // ₹199 in paise
  })
  declare originalPrice: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare discountedPrice: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare discountPercentage: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare startDate: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare endDate: Date;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare maxUses: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare currentUses: number;

  @ForeignKey(() => Admin)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare createdBy: number;

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

  // Relationships
  @BelongsTo(() => Admin)
  declare admin: Admin;

  @HasMany(() => ProSubscription)
  declare subscriptions: ProSubscription[];

  // Helper methods
  isCurrentlyActive(): boolean {
    const now = new Date();
    return (
      this.isActive &&
      this.startDate <= now &&
      this.endDate >= now &&
      (this.maxUses === null || this.currentUses < this.maxUses)
    );
  }

  getTimeRemaining(): string {
    const now = new Date();
    const diff = this.endDate.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`;
    }

    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  getSpotsLeft(): number | null {
    if (this.maxUses === null) return null;
    return Math.max(0, this.maxUses - this.currentUses);
  }
}
