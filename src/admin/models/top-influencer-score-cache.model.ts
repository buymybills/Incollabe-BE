import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  Unique,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';

export interface TopInfluencerScoreCacheCreationAttributes {
  influencerId: number;
  overallScore: number;
  scoreBreakdown?: Record<string, any>;
  calculatedAt: Date;
}

@Table({ tableName: 'top_influencer_score_cache', timestamps: true, underscored: true })
export class TopInfluencerScoreCache extends Model<TopInfluencerScoreCache, TopInfluencerScoreCacheCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @ForeignKey(() => Influencer)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare influencerId: number;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @Column({ type: DataType.DECIMAL(10, 5), allowNull: false, defaultValue: 0 })
  declare overallScore: number;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare scoreBreakdown: Record<string, any>;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare calculatedAt: Date;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
