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
  ApiProperty,
  ApiResponse,
} from '@nestjs/swagger';
import { IsIn, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { HybridAuthGuard } from '../../auth/guards/hybrid-auth.guard';
import { BlockService } from '../services/block.service';
import type { RequestWithUser } from '../../types/request.types';

class BlockUserDto {
  @ApiProperty({ description: 'ID of the user to block', example: 42 })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  blockedId: number;

  @ApiProperty({
    description: 'Type of the user to block',
    enum: ['influencer', 'brand'],
    example: 'influencer',
  })
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
  @ApiResponse({
    status: 201,
    description: 'User blocked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User blocked successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot block yourself or invalid input' })
  @ApiResponse({ status: 404, description: 'User to block not found' })
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
  @ApiParam({ name: 'blockedId', type: Number, description: 'ID of the blocked user' })
  @ApiParam({ name: 'blockedType', enum: ['influencer', 'brand'], description: 'Type of the blocked user' })
  @ApiResponse({
    status: 200,
    description: 'User unblocked successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'User unblocked successfully' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Block relationship not found' })
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
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)', example: 20 })
  @ApiResponse({
    status: 200,
    description: 'List of blocked users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        blockedUsers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              blockId: { type: 'number', example: 1 },
              blockedAt: { type: 'string', example: '2026-04-17T10:00:00.000Z' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 42 },
                  name: { type: 'string', example: 'John Doe', nullable: true },
                  brandName: { type: 'string', example: 'Acme Corp', nullable: true },
                  username: { type: 'string', example: 'johndoe' },
                  profileImage: { type: 'string', example: 'https://...', nullable: true },
                  userType: { type: 'string', enum: ['influencer', 'brand'], example: 'influencer' },
                },
              },
            },
          },
        },
        total: { type: 'number', example: 5 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 1 },
      },
    },
  })
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
