import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
} from 'sequelize-typescript';
import { Contract } from './contract.model';

export enum AuditAction {
  CONTRACT_CREATED = 'contract_created',
  CONTRACT_VIEWED = 'contract_viewed',
  SCROLLED_TO_BOTTOM = 'scrolled_to_bottom',
  CONTRACT_SIGNED = 'contract_signed',
  PDF_GENERATED = 'pdf_generated',
  BREACH_FLAGGED = 'breach_flagged',
  EVIDENCE_BUNDLE_GENERATED = 'evidence_bundle_generated',
  CONTRACT_VOIDED = 'contract_voided',
}

@Table({ tableName: 'contract_audit_logs', timestamps: false, underscored: true })
export class ContractAuditLog extends Model<ContractAuditLog> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ForeignKey(() => Contract)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare contractId: number;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare action: string;

  /** brand | influencer | platform | system */
  @Column({ type: DataType.STRING(20), allowNull: false })
  declare actorType: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  declare actorId: number;

  @Column({ type: DataType.JSONB, allowNull: true })
  declare metadata: Record<string, any>;

  @Column({ type: DataType.STRING(45), allowNull: true })
  declare ipAddress: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;
}
