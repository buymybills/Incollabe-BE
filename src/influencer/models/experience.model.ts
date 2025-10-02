import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  HasMany,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';
import { ExperienceSocialLink } from './experience-social-link.model';

@Table({
  tableName: 'experiences',
  timestamps: true,
})
export class Experience extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare influencerId: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true, // Made optional to support existing data
    comment: 'References the campaign this experience is associated with',
  })
  declare campaignId: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare campaignName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare brandName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare campaignCategory: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare deliverableFormat: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  declare successfullyCompleted: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare roleDescription: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare keyResultAchieved: string;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;

  @HasMany(() => ExperienceSocialLink)
  declare socialLinks: ExperienceSocialLink[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
