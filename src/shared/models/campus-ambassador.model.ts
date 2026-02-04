import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export interface CampusAmbassadorCreationAttributes {
  ambassadorId: string;
  name: string;
  phoneNumber: string;
  email: string;
  collegeName: string;
  collegeCity: string;
  collegeState: string;
  totalReferrals?: number;
  successfulSignups?: number;
  verifiedSignups?: number;
}

@Table({
  tableName: 'campus_ambassadors',
  timestamps: true,
  underscored: true,
})
export class CampusAmbassador extends Model<
  CampusAmbassador,
  CampusAmbassadorCreationAttributes
> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    unique: true,
  })
  declare ambassadorId: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.STRING(15),
    allowNull: false,
    comment: 'Phone number with +91 prefix (e.g., +919876543210)',
  })
  declare phoneNumber: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare collegeName: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare collegeCity: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  declare collegeState: string;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare totalReferrals: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  declare successfulSignups: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
    comment: 'Number of referred influencers that got verified by admin',
  })
  declare verifiedSignups: number;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'created_at',
  })
  declare createdAt: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    field: 'updated_at',
  })
  declare updatedAt: Date;
}
