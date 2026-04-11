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
import { SupportTicket } from '../shared/models/support-ticket.model';
import { SupportTicketReply } from '../shared/models/support-ticket-reply.model';
import { Conversation } from '../shared/models/conversation.model';
import { Message } from '../shared/models/message.model';
import { InfluencerReferralUsage } from '../auth/model/influencer-referral-usage.model';
import { PushNotification } from '../admin/models/push-notification.model';
import { InfluencerCredibilityScore } from '../shared/models/influencer-credibility-score.model';
import { GroupChat } from '../shared/models/group-chat.model';
import { GroupMember } from '../shared/models/group-member.model';
import { InAppNotification } from '../shared/models/in-app-notification.model';
// Old Hype Store models (legacy)
// import { HypeStoreWallet } from '../hype-store/models/hype-store-wallet.model';
// import { HypeStoreWalletTransaction } from '../hype-store/models/hype-store-wallet-transaction.model';
// import { HypeStoreCashbackConfig } from '../hype-store/models/hype-store-cashback-config.model';
// import { HypeStoreCashbackTransaction } from '../hype-store/models/hype-store-cashback-transaction.model';

// New Hype Store models (coupon-based affiliate system)
// import { HypeStore } from '../wallet/models/hype-store.model';
// import { HypeStoreCouponCode } from '../wallet/models/hype-store-coupon-code.model';
// import { HypeStoreCashbackTier } from '../wallet/models/hype-store-cashback-tier.model';
// import { HypeStoreOrder } from '../wallet/models/hype-store-order.model';
// import { HypeStoreCreatorPreference } from '../wallet/models/hype-store-creator-preference.model';
// import { HypeStoreWebhookLog } from '../wallet/models/hype-store-webhook-log.model';
// import { HypeStoreWebhookSecret } from '../wallet/models/hype-store-webhook-secret.model';
// import { HypeStoreReferralCode } from '../wallet/models/hype-store-referral-code.model';
// import { HypeStoreReferralClick } from '../wallet/models/hype-store-referral-click.model';

// Wallet models
// import { Wallet } from '../wallet/models/wallet.model';
// import { WalletTransaction } from '../wallet/models/wallet-transaction.model';
// import { WalletRechargeLimit } from '../wallet/models/wallet-recharge-limit.model';

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
          define: {
            underscored: false, // Use camelCase for column names
            timestamps: true,
          },
          pool: {
            max: 30, // Maximum 30 connections per instance (2 instances = 60 total, safe for RDS)
            min: 5, // Minimum 5 idle connections
            acquire: 60000, // 60 seconds timeout for acquiring connection
            idle: 10000, // 10 seconds idle time before releasing
            evict: 1000, // Run eviction every 1 second
          },
          // Enable connection retry on transient failures
          retry: {
            max: 3, // Retry up to 3 times
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
            SupportTicket,
            SupportTicketReply,
            Conversation,
            Message,
            InfluencerReferralUsage,
            PushNotification,
            InfluencerCredibilityScore,
            GroupChat,
            GroupMember,
            InAppNotification,
            // Hype Store models
            // HypeStore,
            // HypeStoreCouponCode,
            // HypeStoreCashbackTier,
            // HypeStoreOrder,
            // HypeStoreCreatorPreference,
            // HypeStoreWebhookLog,
            // HypeStoreWebhookSecret,
            // HypeStoreReferralCode,
            // HypeStoreReferralClick,
            // // Old Hype Store models (legacy)
            // HypeStoreWallet,
            // HypeStoreWalletTransaction,
            // HypeStoreCashbackConfig,
            // HypeStoreCashbackTransaction,
            // // Wallet models
            // Wallet,
            // WalletTransaction,
            // WalletRechargeLimit,
          ],
          autoLoadModels: true,
          synchronize: false, // Disabled to prevent index conflicts with existing database
          logging: false, // Disabled for performance
        };
      },
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
