import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/postgres.db';
import { SharedModule } from './shared/shared.module';
import { FirebaseModule } from './shared/firebase.module';
import { JwtAuthModule } from './shared/jwt.module';
import { AuthModule } from './auth/auth.module';
import { BrandModule } from './brand/brand.module';
import { InfluencerModule } from './influencer/influencer.module';
import { AdminModule } from './admin/admin.module';
import { PostModule } from './post/post.module';
import { CampaignModule } from './campaign/campaign.module';
import { RedisModule } from './redis/redis.module';
import { LoggingMiddleware } from './shared/middleware/logging.middleware';
import { ApiLoggerMiddleware } from './middleware/api-logger.middleware';
import { ApiActivityLog } from './shared/models/api-activity-log.model';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs
    ConfigModule.forRoot({ isGlobal: true }),
    // Configure Bull with Redis
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: Number(configService.get('REDIS_PORT')) || 6379,
        },
      }),
    }),
    DatabaseModule,
    RedisModule,
    SequelizeModule.forFeature([ApiActivityLog]), // For ApiLoggerMiddleware
    SharedModule,
    FirebaseModule,
    JwtAuthModule, // Global JWT module
    AuthModule,
    BrandModule,
    InfluencerModule,
    AdminModule,
    PostModule,
    CampaignModule,
  ],
  controllers: [AppController],
  providers: [AppService, ApiLoggerMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware, ApiLoggerMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
