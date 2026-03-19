import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CreatorStudioController } from './creator-studio.controller';
import { CreatorStudioService } from './creator-studio.service';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Post } from '../post/models/post.model';
import { PostView } from '../post/models/post-view.model';
import { Like } from '../post/models/like.model';
import { Share } from '../post/models/share.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Influencer,
      Brand,
      Post,
      PostView,
      Like,
      Share,
    ]),
  ],
  controllers: [CreatorStudioController],
  providers: [CreatorStudioService],
  exports: [CreatorStudioService],
})
export class CreatorStudioModule {}
