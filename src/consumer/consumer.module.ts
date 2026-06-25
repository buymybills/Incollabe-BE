import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConsumerController } from './consumer.controller';
import { ConsumerService } from './consumer.service';
import { Consumer } from '../auth/model/consumer.model';
import { Influencer } from '../auth/model/influencer.model';
import { InfluencerInviteCode } from '../auth/model/influencer-invite-code.model';
import { Brand } from '../brand/model/brand.model';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Consumer, Influencer, InfluencerInviteCode, Brand]),
    SharedModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [ConsumerController],
  providers: [ConsumerService],
})
export class ConsumerModule {}
