import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/postgres.db';
import { SharedModule } from './shared/shared.module';
import { JwtAuthModule } from './shared/jwt.module';
import { AuthModule } from './auth/auth.module';
import { BrandModule } from './brand/brand.module';
import { InfluencerModule } from './influencer/influencer.module';
import { AdminModule } from './admin/admin.module';
import { PostModule } from './post/post.module';
import { RedisModule } from './redis/redis.module';
import { LoggingMiddleware } from './shared/middleware/logging.middleware';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    SharedModule,
    JwtAuthModule, // Global JWT module
    AuthModule,
    BrandModule,
    InfluencerModule,
    AdminModule,
    PostModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*'); // Apply to all routes
  }
}
