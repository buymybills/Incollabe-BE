import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Unique,
  AllowNull,
  Default,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { TabAccessLevel } from './admin.model';

@Table({
  tableName: 'admin_roles',
  timestamps: true,
  underscored: true,
})
export class AdminRoleDefinition extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(50))
  declare name: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  declare label: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description: string | null;

  @AllowNull(false)
  @Default({})
  @Column({
    type: DataType.JSONB,
    field: 'tab_permissions',
  })
  declare tabPermissions: Record<string, TabAccessLevel>;

  @AllowNull(false)
  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    field: 'is_system_role',
  })
  declare isSystemRole: boolean;

  @AllowNull(true)
  @Column({
    type: DataType.INTEGER,
    field: 'created_by',
  })
  declare createdBy: number | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
