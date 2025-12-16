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
  BOTH = 'both',
}

@Table({
  tableName: 'deep_links',
  timestamps: true,
})
export class DeepLink extends Model<DeepLink> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  declare id: number;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
    unique: true,
  })
  declare url: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare description: string;

  @Column({
    type: DataType.ENUM(...Object.values(UserType)),
    allowNull: false,
    defaultValue: UserType.BOTH,
  })
  declare userType: UserType;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare category: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare isActive: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
