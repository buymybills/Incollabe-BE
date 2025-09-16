import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Influencer } from './model/influencer.model';
import { Brand } from './model/brand.model';
import { Niche } from './model/niche.model';
import { Otp } from './model/otp.model';
import { InfluencerNiche } from './model/influencer-niche.model';
import { BrandNiche } from './model/brand-niche.model';
import { NicheSeeder } from '../database/seeders/niche.seeder';
import { SeedController } from '../database/seed.controller';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Influencer,
      Brand,
      Niche,
      Otp,
      InfluencerNiche,
      BrandNiche,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '15m' },
      }),
    }),
    SharedModule,
  ],
  controllers: [AuthController, SeedController],
  providers: [AuthService, NicheSeeder],
  exports: [AuthService, NicheSeeder],
})
export class AuthModule {}
