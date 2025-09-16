import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../auth/model/brand.model';
import { Niche } from '../auth/model/niche.model';
import { Otp } from '../auth/model/otp.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { BrandNiche } from '../auth/model/brand-niche.model';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        dialect: 'postgres',
        host: config.get<string>('POSTGRES_HOST') || 'localhost',
        port: Number(config.get<string>('POSTGRES_PORT')) || 5432,
        username: config.get<string>('POSTGRES_USER') || 'postgres',
        password: config.get<string>('POSTGRES_PASSWORD') || 'root',
        database: config.get<string>('POSTGRES_DB') || 'incollab_db',
        models: [Influencer, Brand, Niche, Otp, InfluencerNiche, BrandNiche],
        autoLoadModels: true,
        synchronize: true, // Set to false in production
        logging: false,
      }),
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
