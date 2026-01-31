import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export enum UserType {
  INFLUENCER = 'influencer',
  BRAND = 'brand',
}

export interface AppReviewRequestCreationAttributes {
  userId: number;
  userType: UserType;
  firstPromptedAt?: Date;
  lastPromptedAt?: Date;
  isReviewed?: boolean;
  reviewedAt?: Date;
  promptCount?: number;
}

@Table({
  tableName: 'app_review_requests',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'user_type'],
      name: 'unique_user_review_request',
    },
  ],
})
export class AppReviewRequest extends Model<AppReviewRequest, AppReviewRequestCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'user_id',
  })
  declare userId: number;

  @Column({
    type: DataType.ENUM(...Object.values(UserType)),
    allowNull: false,
    field: 'user_type',
  })
  declare userType: UserType;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'first_prompted_at',
  })
  declare firstPromptedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
    field: 'last_prompted_at',
  })
  declare lastPromptedAt: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_reviewed',
  })
  declare isReviewed: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'reviewed_at',
  })
  declare reviewedAt: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'prompt_count',
  })
  declare promptCount: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
