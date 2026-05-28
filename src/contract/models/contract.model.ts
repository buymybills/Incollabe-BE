import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
} from 'sequelize-typescript';
import { ContractSignatory } from './contract-signatory.model';
import { ContractAuditLog } from './contract-audit-log.model';

export enum ContractType {
  PLATFORM_BRAND = 'platform_brand',
  PLATFORM_INFLUENCER = 'platform_influencer',
  BRAND_INFLUENCER = 'brand_influencer',
}

export enum ContractStatus {
  PENDING = 'pending',
  PARTIALLY_SIGNED = 'partially_signed',
  FULLY_SIGNED = 'fully_signed',
  BREACHED = 'breached',
  VOID = 'void',
}

@Table({ tableName: 'contracts', timestamps: true, underscored: true })
export class Contract extends Model<Contract> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  declare contractNumber: string;

  @Column({
    type: DataType.ENUM(...Object.values(ContractType)),
    allowNull: false,
  })
  declare contractType: ContractType;

  @Column({
    type: DataType.ENUM(...Object.values(ContractStatus)),
    allowNull: false,
    defaultValue: ContractStatus.PENDING,
  })
  declare status: ContractStatus;

  @Column({ type: DataType.STRING(10), allowNull: false, defaultValue: '1.0' })
  declare templateVersion: string;

  /**
   * All dynamic variables used to render the contract text
   * e.g. brandName, influencerName, campaignName, deliverables, deadlines, penaltyAmount
   */
  @Column({ type: DataType.JSONB, allowNull: false })
  declare contractData: Record<string, any>;

  /** SHA-256 of the final rendered contract text — used to prove no tampering */
  @Column({ type: DataType.STRING(64), allowNull: true })
  declare contentHash: string;

  /** S3 URL of the generated signed PDF */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare pdfUrl: string;

  /**
   * Snapshot of the fully rendered contract text at the time it was created.
   * Stored so the hash remains valid even if the template is later edited by admin.
   */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare contractText: string;

  /** Only set for brand_influencer contracts */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare campaignApplicationId: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare brandId: number;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare influencerId: number;

  /** Deadline by which all parties must sign, else auto-voided */
  @Column({ type: DataType.DATE, allowNull: true })
  declare signingDeadline: Date;

  /** Populated when status moves to 'breached' */
  @Column({ type: DataType.JSONB, allowNull: true })
  declare breachDetails: Record<string, any>;

  @HasMany(() => ContractSignatory)
  declare signatories: ContractSignatory[];

  @HasMany(() => ContractAuditLog)
  declare auditLogs: ContractAuditLog[];
}
