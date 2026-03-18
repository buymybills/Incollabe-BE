import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CreatorStudioController } from './creator-studio.controller';
import { CreatorStudioService } from './creator-studio.service';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';

@Module({
  imports: [SequelizeModule.forFeature([Influencer, Brand])],
  controllers: [CreatorStudioController],
  providers: [CreatorStudioService],
  exports: [CreatorStudioService],
})
export class CreatorStudioModule {}
