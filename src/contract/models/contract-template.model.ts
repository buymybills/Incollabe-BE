import { Table, Column, Model, DataType } from 'sequelize-typescript';
import { ContractType } from './contract.model';

@Table({ tableName: 'contract_templates', timestamps: true, underscored: true })
export class ContractTemplate extends Model<ContractTemplate> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @Column({
    type: DataType.ENUM(...Object.values(ContractType)),
    allowNull: false,
  })
  declare contractType: ContractType;

  @Column({ type: DataType.STRING(10), allowNull: false, defaultValue: '1.0' })
  declare version: string;

  /**
   * The template body with {{placeholder}} tokens.
   * e.g. "This agreement is between {{brandName}} and Collabkaroo..."
   * Admin can edit this text via the admin API.
   */
  @Column({ type: DataType.TEXT, allowNull: false })
  declare body: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  /** Admin ID who last updated this template */
  @Column({ type: DataType.INTEGER, allowNull: true })
  declare updatedBy: number;

  /** Optional note from admin describing what changed */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare notes: string;
}
