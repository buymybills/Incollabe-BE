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
import { CustomNiche } from '../auth/model/custom-niche.model';

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
          CustomNiche,
        ],
        autoLoadModels: true,
        synchronize: true, // Disabled to prevent index conflicts with existing database
        logging: false,
      }),
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
