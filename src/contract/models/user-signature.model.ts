import { Table, Column, Model, DataType } from 'sequelize-typescript';

export enum SignatureUserType {
  BRAND = 'brand',
  INFLUENCER = 'influencer',
}

@Table({ tableName: 'user_signatures', timestamps: true, underscored: true })
export class UserSignature extends Model<UserSignature> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  declare id: number;

  @Column({
    type: DataType.ENUM(...Object.values(SignatureUserType)),
    allowNull: false,
  })
  declare userType: SignatureUserType;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare userId: number;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare signatureUrl: string;
}
