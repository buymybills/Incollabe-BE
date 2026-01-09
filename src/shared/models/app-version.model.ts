import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
} from 'sequelize-typescript';

export type PlatformType = 'ios' | 'android';

@Table({
  tableName: 'app_versions',
  timestamps: true,
})
export class AppVersion extends Model<AppVersion> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  platform: PlatformType;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  latestVersion: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  latestVersionCode: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  minimumVersion: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  minimumVersionCode: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  forceUpdate: boolean;

  @Column({
    type: DataType.TEXT,
    defaultValue: 'A new version is available. Please update to get the latest features and improvements.',
  })
  updateMessage: string;

  @Column({
    type: DataType.TEXT,
    defaultValue: 'This version is no longer supported. Please update to continue using the app.',
  })
  forceUpdateMessage: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  isActive: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
