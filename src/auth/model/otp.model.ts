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
  Index,
  BeforeCreate,
  BeforeUpdate,
  AfterFind,
} from 'sequelize-typescript';
import { EncryptionService } from '../../shared/services/encryption.service';

@Table({
  tableName: 'otps',
  timestamps: true,
  indexes: [
    {
      fields: ['identifier', 'type', 'otp', 'expiresAt'],
    },
  ],
})
export class Otp extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.TEXT)
  identifier: string; // Can be phone OR email (encrypted)

  @AllowNull(true)
  @Index
  @Column(DataType.STRING)
  identifierHash: string; // Hash of identifier for searching

  @AllowNull(false)
  @Index
  @Column(DataType.ENUM('phone', 'email'))
  type: 'phone' | 'email'; // Indicates what type of identifier

  @AllowNull(false)
  @Column(DataType.STRING)
  otp: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  expiresAt: Date;

  @AllowNull(false)
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isUsed: boolean;

  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  attempts: number;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;

  @AfterFind
  static async decryptSensitiveData(instances: Otp[] | Otp | null) {
    if (!instances) return;

    const encryptionService = new EncryptionService({
      get: (key: string) => process.env[key],
    } as any);

    const decrypt = (instance: Otp) => {
      if (instance.identifier) {
        instance.identifier = encryptionService.decrypt(instance.identifier);
      }
    };

    if (Array.isArray(instances)) {
      instances.forEach(decrypt);
    } else {
      decrypt(instances);
    }
  }
}
