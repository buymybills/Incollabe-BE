import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Contract } from './contract.model';

export enum SignatoryPartyType {
  BRAND = 'brand',
  INFLUENCER = 'influencer',
  PLATFORM = 'platform',
}

export enum SignatoryStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
}

@Table({ tableName: 'contract_signatories', timestamps: true })
export class ContractSignatory extends Model<ContractSignatory> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @ForeignKey(() => Contract)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare contractId: number;

  @Column({
    type: DataType.ENUM(...Object.values(SignatoryPartyType)),
    allowNull: false,
  })
  declare partyType: SignatoryPartyType;

  /** Null for platform (Collabkaroo) — platform auto-signs on contract creation */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare partyId: number;

  @Column({
    type: DataType.ENUM(...Object.values(SignatoryStatus)),
    allowNull: false,
    defaultValue: SignatoryStatus.PENDING,
  })
  declare status: SignatoryStatus;

  @Column({ type: DataType.DATE, allowNull: true })
  declare signedAt: Date;

  @Column({ type: DataType.STRING(45), allowNull: true })
  declare ipAddress: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare deviceInfo: string;

  /** Frontend must call the 'scroll' endpoint before the Sign button is enabled */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare scrolledToBottom: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  declare scrolledAt: Date;

  @BelongsTo(() => Contract)
  declare contract: Contract;
}
