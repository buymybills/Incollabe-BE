import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { InfluencerInviteCode } from '../auth/model/influencer-invite-code.model';
import { InviteCodesService } from './invite-codes.service';
import { InviteCodesController } from './invite-codes.controller';

@Module({
  imports: [SequelizeModule.forFeature([InfluencerInviteCode])],
  controllers: [InviteCodesController],
  providers: [InviteCodesService],
  exports: [InviteCodesService],
})
export class InviteCodesModule {}
