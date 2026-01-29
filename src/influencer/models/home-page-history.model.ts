import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';
import { Influencer } from '../../auth/model/influencer.model';

export enum HomePageActionType {
  APP_OPEN = 'app_open',
  HOME_VIEW = 'home_view',
  TAB_SWITCH = 'tab_switch',
  PULL_REFRESH = 'pull_refresh',
  BACKGROUND = 'background',
  FOREGROUND = 'foreground',
}

export interface HomePageHistoryCreationAttributes {
  influencerId: number;
  actionType: HomePageActionType;
  deviceId?: string;
  appVersion?: string;
}

@Table({
  tableName: 'home_page_history',
  timestamps: true,
})
export class HomePageHistory extends Model<
  HomePageHistory,
  HomePageHistoryCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => Influencer)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'influencer_id',
  })
  declare influencerId: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    field: 'action_type',
  })
  declare actionType: HomePageActionType;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
    field: 'device_id',
  })
  declare deviceId: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    field: 'app_version',
  })
  declare appVersion: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    field: 'createdAt',
  })
  declare createdAt: Date;

  @UpdatedAt
  @Column({
    type: DataType.DATE,
    field: 'updatedAt',
  })
  declare updatedAt: Date;

  @BelongsTo(() => Influencer)
  declare influencer: Influencer;
}
