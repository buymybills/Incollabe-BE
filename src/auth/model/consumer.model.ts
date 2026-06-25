import {
  Table,
  Column,
  Model,
  DataType,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  Index,
  AfterFind,
} from 'sequelize-typescript';
import { EncryptionService } from '../../shared/services/encryption.service';

@Table({
  tableName: 'consumers',
  timestamps: true,
})
export class Consumer extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare phone: string;

  @AllowNull(true)
  @Unique
  @Index
  @Column({ type: DataType.STRING, field: 'phone_hash' })
  declare phoneHash: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT, field: 'profile_image' })
  declare profileImage: string;

  @AllowNull(true)
  @Column({ type: DataType.DATEONLY, field: 'date_of_birth' })
  declare dateOfBirth: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING, field: 'fcm_token' })
  declare fcmToken: string;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  })
  declare isActive: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @AfterFind
  static decryptSensitiveData(instances: Consumer[] | Consumer | null) {
    if (!instances) return;
    const encryptionService = new EncryptionService({
      get: (key: string) => process.env[key],
    } as any);
    const decrypt = (instance: Consumer) => {
      if (instance.phone) {
        instance.phone = encryptionService.decrypt(instance.phone);
      }
    };
    if (Array.isArray(instances)) {
      instances.forEach(decrypt);
    } else {
      decrypt(instances);
    }
  }
}
