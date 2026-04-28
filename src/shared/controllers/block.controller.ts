import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { IsIn, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { HybridAuthGuard } from '../../auth/guards/hybrid-auth.guard';
import { BlockService } from '../services/block.service';
import type { RequestWithUser } from '../../types/request.types';

class BlockUserDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  blockedId: number;

  @IsIn(['influencer', 'brand'])
  blockedType: 'influencer' | 'brand';
}

@ApiTags('Block')
@ApiBearerAuth()
@UseGuards(HybridAuthGuard)
@Controller('block')
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @Post()
  @ApiOperation({ summary: 'Block a user' })
  @ApiBody({ type: BlockUserDto })
  async blockUser(@Req() req: RequestWithUser, @Body() body: BlockUserDto) {
    return this.blockService.blockUser(
      req.user.id,
      req.user.userType as 'influencer' | 'brand',
      body.blockedId,
      body.blockedType,
    );
  }

  @Delete(':blockedId/:blockedType')
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiParam({ name: 'blockedId', type: Number })
  @ApiParam({ name: 'blockedType', enum: ['influencer', 'brand'] })
  async unblockUser(
    @Req() req: RequestWithUser,
    @Param('blockedId', ParseIntPipe) blockedId: number,
    @Param('blockedType') blockedType: 'influencer' | 'brand',
  ) {
    return this.blockService.unblockUser(
      req.user.id,
      req.user.userType as 'influencer' | 'brand',
      blockedId,
      blockedType,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all blocked users (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getBlockedUsers(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.blockService.getBlockedUsers(
      req.user.id,
      req.user.userType as 'influencer' | 'brand',
      page ? +page : 1,
      limit ? +limit : 20,
    );
  }
}
