import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { PostBoostExpiryCronService } from './services/post-boost-expiry.cron';
import { PostViewService } from './services/post-view.service';
import { HypeReelController } from './controllers/hype-reel.controller';
import { HypeReelService } from './services/hype-reel.service';
import { Post } from './models/post.model';
import { Like } from './models/like.model';
import { Follow } from './models/follow.model';
import { Share } from './models/share.model';
import { PostView } from './models/post-view.model';
import { ProfileView } from '../shared/models/profile-view.model';
import { PostBoostInvoice } from './models/post-boost-invoice.model';
import { Comment } from './models/comment.model';
import { HypeReelProduct } from './models/hype-reel-product.model';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { HypeStoreOrder } from '../wallet/models/hype-store-order.model';
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
      ProfileView,
      PostBoostInvoice,
      Comment,
      HypeReelProduct,
      Influencer,
      Brand,
      InfluencerNiche,
      BrandNiche,
      HypeStoreOrder,
    ]),
    JwtAuthModule,
    SharedModule,
  ],
  controllers: [PostController, HypeReelController],
  providers: [PostService, PostViewService, PostBoostExpiryCronService, HypeReelService],
  exports: [PostService],
})
export class PostModule {}
