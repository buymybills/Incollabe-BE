import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Experience } from './experience.model';

@Table({
  tableName: 'experience_social_links',
  timestamps: true,
})
export class ExperienceSocialLink extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Experience)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare experienceId: number;

  @Column({
    type: DataType.ENUM(
      'instagram',
      'youtube',
      'facebook',
      'twitter',
      'linkedin',
    ),
    allowNull: false,
  })
  declare platform: string;

  @Column({
    type: DataType.ENUM('post', 'reel', 'video', 'shorts'),
    allowNull: false,
  })
  declare contentType: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare url: string;

  @BelongsTo(() => Experience)
  declare experience: Experience;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
