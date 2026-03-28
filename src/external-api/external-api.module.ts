import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
// import { ExternalChatController } from './external-chat.controller';
import { HybridAuthGuard } from '../auth/guards/hybrid-auth.guard';
import { SharedModule } from '../shared/shared.module';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';

/**
 * External API Module
 *
 * Exposes complete chat functionality to external backend applications.
 *
 * Authentication:
 * - JWT for brands and internal influencers
 * - API Key for external influencers
 *
 * Features:
 * - Personal 1-to-1 conversations
 * - Group chat
 * - E2EE encrypted messaging
 * - File uploads
 * - Campaign conversations
 * - Real-time WebSocket support
 */
@Module({
  imports: [
    SharedModule, // Provides ChatService, GroupChatService, ChatGateway, S3Service
    SequelizeModule.forFeature([Influencer, Brand]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    //ExternalChatController
    ],
  providers: [HybridAuthGuard],
  exports: [],
})
export class ExternalApiModule {}
