import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Post } from '../post/models/post.model';
import { Influencer } from '../auth/model/influencer.model';
import { HypeReelProduct } from '../post/models/hype-reel-product.model';
import { PostCategory } from '../post/models/post-category.model';
import { PostSubcategory } from '../post/models/post-subcategory.model';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Post,
      Influencer,
      HypeReelProduct,
      PostCategory,
      PostSubcategory,
    ]),
  ],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
