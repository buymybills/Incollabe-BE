import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Niche } from '../auth/model/niche.model';
import { Otp } from '../auth/model/otp.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { Country } from '../shared/models/country.model';
import { City } from '../shared/models/city.model';
import { CompanyType } from '../shared/models/company-type.model';
import { Admin } from '../admin/models/admin.model';
import { ProfileReview } from '../admin/models/profile-review.model';
import { Post } from '../post/models/post.model';
import { Like } from '../post/models/like.model';
import { Follow } from '../post/models/follow.model';
import { Campaign } from '../campaign/models/campaign.model';
import { CampaignCity } from '../campaign/models/campaign-city.model';
import { CampaignDeliverable } from '../campaign/models/campaign-deliverable.model';
import { CampaignInvitation } from '../campaign/models/campaign-invitation.model';
import { CampaignApplication } from '../campaign/models/campaign-application.model';
import { CustomNiche } from '../auth/model/custom-niche.model';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const host = config.get<string>('POSTGRES_HOST') || 'localhost';
        const port = Number(config.get<string>('POSTGRES_PORT')) || 5432;
        const username = config.get<string>('POSTGRES_USER') || 'postgres';
        const password = config.get<string>('POSTGRES_PASSWORD') || 'root';
        const database = config.get<string>('POSTGRES_DB') || 'incollab_db';

        // Check if SSL should be enabled (simple: just check POSTGRES_SSL env var)
        const postgresSSL = config.get<string>('POSTGRES_SSL');
        const useSSL = postgresSSL === 'true';

        console.log('=== Database Configuration ===');
        console.log('Host:', host);
        console.log('Port:', port);
        console.log('Username:', username);
        console.log('Database:', database);
        console.log('POSTGRES_SSL env var:', postgresSSL);
        console.log('useSSL:', useSSL);

        const dialectOptions = useSSL
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            }
          : {};

        console.log(
          'Dialect Options:',
          JSON.stringify(dialectOptions, null, 2),
        );
        console.log('==============================');

        return {
          dialect: 'postgres',
          host,
          port,
          username,
          password,
          database,
          dialectOptions,
          pool: {
            max: 50,       // Maximum 50 connections (was default 5)
            min: 5,        // Minimum 5 idle connections
            acquire: 60000, // 60 seconds timeout for acquiring connection
            idle: 10000,   // 10 seconds idle time before releasing
          },
          models: [
            Influencer,
            Brand,
            Niche,
            Otp,
            InfluencerNiche,
            BrandNiche,
            Country,
            City,
            CompanyType,
            Admin,
            ProfileReview,
            Post,
            Like,
            Follow,
            Campaign,
            CampaignCity,
            CampaignDeliverable,
            CampaignInvitation,
            CampaignApplication,
            CustomNiche,
          ],
          autoLoadModels: true,
          synchronize: false, // Disabled to prevent index conflicts with existing database
          logging: false,
        };
      },
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
