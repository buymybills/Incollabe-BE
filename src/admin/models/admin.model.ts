import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  Unique,
  AllowNull,
  Default,
} from 'sequelize-typescript';

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  PROFILE_REVIEWER = 'profile_reviewer',
  CONTENT_MODERATOR = 'content_moderator',
}

export enum AdminStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Table({
  tableName: 'admins',
  timestamps: true,
})
export class Admin extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Unique
  @Column({
    type: DataType.STRING,
    validate: {
      isEmail: {
        msg: 'Please provide a valid email address',
      },
    },
  })
  declare email: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare password: string;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM(...Object.values(AdminRole)),
    defaultValue: AdminRole.PROFILE_REVIEWER,
  })
  declare role: AdminRole;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM(...Object.values(AdminStatus)),
    defaultValue: AdminStatus.ACTIVE,
  })
  declare status: AdminStatus;

  @AllowNull(true)
  @Column(DataType.JSON)
  declare permissions: string[];

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastLoginAt: Date;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare resetPasswordToken: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare resetPasswordExpires: Date;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare profileImage: string;

  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare twoFactorEnabled: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
