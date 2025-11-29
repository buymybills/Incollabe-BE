import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';

@Table({
  tableName: 'influencer_upi_ids',
  timestamps: true,
})
export class InfluencerUpi extends Model<InfluencerUpi> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  influencerId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  upiId: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  })
  isSelectedForCurrentTransaction: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  lastUsedAt: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  influencer: Influencer;
}
