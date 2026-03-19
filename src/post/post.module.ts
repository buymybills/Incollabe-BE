import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PostBoostExpiryCronService } from './services/post-boost-expiry.cron';
import { Post } from './models/post.model';
import { Like } from './models/like.model';
import { Follow } from './models/follow.model';
import { Share } from './models/share.model';
import { PostView } from './models/post-view.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { InfluencerNiche } from '../auth/model/influencer-niche.model';
import { BrandNiche } from '../brand/model/brand-niche.model';
import { JwtAuthModule } from '../shared/jwt.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Post,
      Like,
      Follow,
      Share,
      PostView,
      Influencer,
      Brand,
      InfluencerNiche,
      BrandNiche,
    ]),
    JwtAuthModule,
    SharedModule,
  ],
  controllers: [PostController],
  providers: [PostService, PostBoostExpiryCronService],
  exports: [PostService],
})
export class PostModule {}
