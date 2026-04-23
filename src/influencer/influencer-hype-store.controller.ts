import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { InfluencerHypeStoreService } from './services/influencer-hype-store.service';
import { InstagramMetricsSchedulerService } from './services/instagram-metrics-scheduler.service';
import { InstagramService } from '../shared/services/instagram.service';
import {
  SubmitProofDto,
  ClaimMinimumCashbackDto,
  SubmitProofResponseDto,
  ClaimMinimumCashbackResponseDto,
} from './dto/hype-store-order.dto';

@ApiTags('Influencer - Hype Store')
@Controller('influencer/hype-store')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class InfluencerHypeStoreController {
  constructor(
    private readonly hypeStoreService: InfluencerHypeStoreService,
    private readonly instagramMetricsScheduler: InstagramMetricsSchedulerService,
    private readonly instagramService: InstagramService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all available Hype Stores',
    description: 'Browse all active Hype Stores available for influencers. Returns stores with cashback offers, brand details, and influencer engagement status.'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by brand name or store name' })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['cashback_desc', 'cashback_asc'],
    description: 'Sort by max cashback (reel/post) descending or ascending',
  })
  @ApiQuery({
    name: 'niche',
    required: false,
    enum: ['Fashion', 'Food', 'Beauty'],
    description: 'Filter stores by brand niche/category',
    example: 'Fashion',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available Hype Stores retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            stores: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  storeName: { type: 'string', example: 'Store 1' },
                  storeDescription: { type: 'string', example: 'Premium fashion brand' },
                  bannerImageUrl: { type: 'string', example: 'https://example.com/banner.jpg' },
                  logoUrl: { type: 'string', example: 'https://example.com/logo.jpg' },
                  brand: {
                    type: 'object',
                    properties: {
                      id: { type: 'number', example: 15 },
                      brandName: { type: 'string', example: 'Myntra' },
                      username: { type: 'string', example: 'myntra_official' },
                      profileImage: { type: 'string', example: 'https://example.com/brand.jpg' },
                    }
                  },
                  cashbackConfig: {
                    type: 'object',
                    properties: {
                      reelPostMinCashback: { type: 'number', example: 100 },
                      reelPostMaxCashback: { type: 'number', example: 15000 },
                      storyMinCashback: { type: 'number', example: 100 },
                      storyMaxCashback: { type: 'number', example: 10000 },
                      monthlyClaimCount: { type: 'number', example: 3 },
                    }
                  },
                  hasCoupon: { type: 'boolean', example: false, description: 'Whether influencer has generated coupon for this store' },
                  totalOrders: { type: 'number', example: 5, description: 'Number of orders this influencer has generated' },
                  totalCashbackEarned: { type: 'number', example: 2500.00, description: 'Total cashback earned from this store' },
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 50 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                totalPages: { type: 'number', example: 3 },
              }
            }
          }
        },
        message: { type: 'string', example: 'Hype stores retrieved successfully' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllStores(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('niche') niche?: string,
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getAllStores(
      influencerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      sortBy,
      niche,
    );
  }

  @Get('my-orders')
  @ApiOperation({
    summary: 'Get my orders and cashback history',
    description: 'Get all orders placed using influencer\'s coupon codes with cashback details. Supports search by order ID (e.g. NN1038SO) or brand name.'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'storeId', required: false, type: Number, description: 'Filter by specific store' })
  @ApiQuery({
    name: 'cashbackStatus',
    required: false,
    enum: ['pending', 'processing', 'credited', 'failed', 'cancelled'],
    description: 'Filter by cashback status'
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by order ID (e.g. NN1038SO) or brand name' })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            orders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  externalOrderId: { type: 'string', example: 'ORD123456' },
                  orderAmount: { type: 'number', example: 10800.00 },
                  orderCurrency: { type: 'string', example: 'INR' },
                  orderDate: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
                  orderStatus: { type: 'string', example: 'delivered', enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned'] },
                  cashbackAmount: { type: 'number', example: 1000.00 },
                  cashbackStatus: { type: 'string', example: 'credited', enum: ['pending', 'processing', 'credited', 'failed', 'cancelled'] },
                  cashbackCreditedAt: { type: 'string', nullable: true, example: '2026-03-10T10:00:00.000Z' },
                  couponCode: {
                    type: 'object',
                    properties: {
                      couponCode: { type: 'string', example: 'INFL123MYNTRA' },
                    }
                  },
                  hypeStore: {
                    type: 'object',
                    properties: {
                      id: { type: 'number', example: 1 },
                      storeName: { type: 'string', example: 'Store 1' },
                      logoUrl: { type: 'string' },
                      brand: {
                        type: 'object',
                        properties: {
                          brandName: { type: 'string', example: 'Myntra' },
                        }
                      }
                    }
                  },
                  createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
                }
              }
            },
            summary: {
              type: 'object',
              properties: {
                totalOrders: { type: 'number', example: 25 },
                totalOrderValue: { type: 'number', example: 125000.00 },
                totalCashbackEarned: { type: 'number', example: 12500.00 },
                pendingCashback: { type: 'number', example: 2000.00 },
                creditedCashback: { type: 'number', example: 10500.00 },
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 25 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                totalPages: { type: 'number', example: 2 },
              }
            }
          }
        },
        message: { type: 'string', example: 'Orders retrieved successfully' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyOrders(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('storeId') storeId?: string,
    @Query('cashbackStatus') cashbackStatus?: string,
    @Query('search') search?: string,
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getMyOrders(
      influencerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      storeId ? parseInt(storeId) : undefined,
      cashbackStatus,
      search,
    );
  }

  @Get('orders/:orderId')
  @ApiOperation({
    summary: 'Get order details',
    description: 'Get detailed information about a specific order including performance metrics, cashback status, and Instagram proof details'
  })
  @ApiParam({ name: 'orderId', type: Number, description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            externalOrderId: { type: 'string', example: 'ORD123456' },
            orderTitle: { type: 'string', nullable: true, example: 'JBL Tune 770NC Headphones' },
            orderAmount: { type: 'number', example: 10800.00 },
            orderCurrency: { type: 'string', example: 'INR' },
            orderDate: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
            orderStatus: { type: 'string', example: 'delivered', enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded', 'returned'] },
            cashbackAmount: { type: 'number', example: 2000.00 },
            cashbackType: { type: 'string', nullable: true, example: 'Flat 20%' },
            cashbackStatus: { type: 'string', example: 'credited', enum: ['pending', 'processing', 'credited', 'failed', 'cancelled'] },
            cashbackCreditedAt: { type: 'string', nullable: true, example: '2026-03-10T10:00:00.000Z' },
            minimumCashbackClaimed: { type: 'boolean', example: false },
            isReturned: { type: 'boolean', example: false },
            returnedAt: { type: 'string', nullable: true },
            returnPeriodDays: { type: 'number', example: 30 },
            returnWindowClosesAt: { type: 'string', nullable: true, example: '2026-04-06T10:00:00.000Z' },
            instagramProof: {
              type: 'object',
              nullable: true,
              properties: {
                url: { type: 'string', nullable: true, example: 'https://www.instagram.com/reel/ABC123xyz/' },
                contentType: { type: 'string', nullable: true, example: 'reel' },
                thumbnailUrl: { type: 'string', nullable: true, example: 'https://instagram.com/thumbnail.jpg' },
                viewCount: { type: 'number', nullable: true, example: 15000 },
                postedAt: { type: 'string', nullable: true, example: '2026-03-08T12:00:00.000Z' },
                submittedAt: { type: 'string', nullable: true, example: '2026-03-08T14:00:00.000Z' },
                approvalStatus: { type: 'string', nullable: true, example: 'pending_review', enum: ['pending_review', 'approved', 'rejected'] },
                approvedAt: { type: 'string', nullable: true, example: '2026-03-09T10:00:00.000Z' },
                rejectionReason: { type: 'string', nullable: true, example: 'Content does not clearly feature the product' },
              }
            },
            performance: {
              type: 'object',
              nullable: true,
              properties: {
                expectedROI: { type: 'number', nullable: true, example: 1.4, description: 'ROI percentage based on reach value vs cashback cost' },
                estimatedEngagement: { type: 'number', nullable: true, example: 13100, description: 'Estimated engagement count' },
                estimatedReach: { type: 'number', nullable: true, example: 210000, description: 'Estimated reach count' },
                tierLabels: {
                  type: 'object',
                  properties: {
                    expectedROI: { type: 'string', example: 'Elite', enum: ['Elite', 'Excellent', 'Good', 'Average', 'Poor', 'Unknown'] },
                    estimatedEngagement: { type: 'string', example: 'Elite', enum: ['Elite', 'Excellent', 'Good', 'Average', 'Low', 'Unknown'] },
                    estimatedReach: { type: 'string', example: 'Elite', enum: ['Elite', 'Excellent', 'Good', 'Average', 'Low', 'Unknown'] },
                  }
                },
              }
            },
            customer: {
              type: 'object',
              nullable: true,
              properties: {
                name: { type: 'string', nullable: true, example: 'John Doe' },
                email: { type: 'string', nullable: true, example: 'customer@example.com' },
                phone: { type: 'string', nullable: true, example: '+919876543210' },
              }
            },
            couponCode: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                couponCode: { type: 'string', example: 'INFL123' },
                isUniversal: { type: 'boolean', example: true },
                isBrandShared: { type: 'boolean', example: false },
              }
            },
            hypeStore: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                storeName: { type: 'string', example: 'Store 1' },
                logoUrl: { type: 'string', nullable: true },
                bannerImageUrl: { type: 'string', nullable: true },
                brand: {
                  type: 'object',
                  properties: {
                    id: { type: 'number', example: 15 },
                    brandName: { type: 'string', example: 'Myntra' },
                    username: { type: 'string', example: 'myntra_official' },
                    profileImage: { type: 'string', nullable: true },
                    niches: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'number', example: 1 },
                          name: { type: 'string', example: 'Fashion' },
                        },
                      },
                      example: [
                        { id: 1, name: 'Fashion' },
                        { id: 2, name: 'Accessories' },
                        { id: 3, name: 'Lifestyle' },
                      ],
                    },
                  }
                }
              }
            },
            metadata: { type: 'object', nullable: true, description: 'Additional order metadata' },
            createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
            updatedAt: { type: 'string', example: '2026-03-10T10:00:00.000Z' },
          }
        },
        message: { type: 'string', example: 'Order details retrieved successfully' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'This order does not belong to you' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOrderById(
    @Request() req: any,
    @Param('orderId') orderId: string,
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getInfluencerOrderDetails(influencerId, parseInt(orderId));
  }

  @Get('wallet')
  @ApiOperation({
    summary: 'Get wallet balance',
    description: 'Get influencer wallet balance with cashback earnings'
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            balance: { type: 'number', example: 12500.00, description: 'Available balance in wallet' },
            totalCredited: { type: 'number', example: 15000.00, description: 'Total amount credited' },
            totalDebited: { type: 'number', example: 2500.00, description: 'Total amount withdrawn/debited' },
            totalCashbackReceived: { type: 'number', example: 15000.00, description: 'Total cashback earned from Hype Store' },
            totalRedeemed: { type: 'number', example: 2500.00, description: 'Total amount redeemed/withdrawn' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', example: '2026-03-01T10:00:00.000Z' },
            updatedAt: { type: 'string', example: '2026-03-10T10:00:00.000Z' },
          }
        },
        message: { type: 'string', example: 'Wallet balance retrieved successfully' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWallet(@Request() req: any) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getWallet(influencerId);
  }

  @Get('wallet/transactions')
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description: 'Get paginated wallet transaction history for the influencer'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['cashback', 'redemption', 'refund', 'adjustment'],
    description: 'Filter by transaction type'
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  transactionType: { type: 'string', example: 'cashback', enum: ['cashback', 'redemption', 'refund', 'adjustment'] },
                  amount: { type: 'number', example: 1000.00 },
                  balanceBefore: { type: 'number', example: 11500.00 },
                  balanceAfter: { type: 'number', example: 12500.00 },
                  status: { type: 'string', example: 'completed', enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'] },
                  description: { type: 'string', example: 'Cashback for order ORD123456' },
                  hypeStoreId: { type: 'number', nullable: true, example: 1 },
                  createdAt: { type: 'string', example: '2026-03-10T10:00:00.000Z' },
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 50 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 20 },
                totalPages: { type: 'number', example: 3 },
              }
            }
          }
        },
        message: { type: 'string', example: 'Transactions retrieved successfully' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWalletTransactions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getWalletTransactions(
      influencerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      type,
    );
  }

  @Get('my-coupon')
  @ApiOperation({
    summary: 'Get or create universal coupon code',
    description:
      'Get your universal coupon code that works across ALL Hype Stores (Myntra, JBL, Social, etc.). ' +
      'If you don\'t have one yet, it will be auto-generated. ' +
      'Format: INFL{influencerId} (e.g., INFL123). ' +
      'Share this ONE code with your audience - it works everywhere!',
  })
  @ApiResponse({
    status: 200,
    description: 'Universal coupon retrieved or created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            couponCode: { type: 'string', example: 'INFL123', description: 'Universal coupon - works for ALL stores' },
            influencerId: { type: 'number', example: 123 },
            isUniversal: { type: 'boolean', example: true, description: 'True = works for all stores' },
            hypeStoreId: { type: 'number', nullable: true, example: null, description: 'NULL = universal coupon' },
            isActive: { type: 'boolean', example: true },
            totalUses: { type: 'number', example: 25, description: 'Total uses across ALL stores' },
            maxUses: { type: 'number', nullable: true },
            validFrom: { type: 'string', nullable: true },
            validUntil: { type: 'string', nullable: true },
            createdAt: { type: 'string', example: '2026-03-10T10:00:00.000Z' },
          },
        },
        message: { type: 'string', example: 'Your universal coupon' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUniversalCoupon(@Request() req: any) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getOrCreateUniversalCoupon(influencerId);
  }

  @Get('available-media')
  @ApiOperation({
    summary: 'Get recent Instagram posts/reels for proof submission',
    description:
      'Fetches recent Instagram posts and reels from the last 30 days that can be used as proof for orders. ' +
      'Returns media with thumbnails, permalinks, and timestamps for easy selection.',
  })
  @ApiQuery({
    name: 'contentType',
    required: false,
    enum: ['reel', 'story'],
    description: '"reel" = reels and carousels, "story" = active stories (last 24h)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to look back (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Available Instagram media retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '18160690258432745' },
              caption: { type: 'string', example: 'Check out this amazing product! #brand' },
              mediaType: { type: 'string', example: 'VIDEO' },
              mediaProductType: { type: 'string', example: 'REELS' },
              contentType: { type: 'string', example: 'post_reel' },
              mediaUrl: { type: 'string', example: 'https://scontent-...' },
              thumbnailUrl: { type: 'string', example: 'https://scontent-...' },
              permalink: { type: 'string', example: 'https://www.instagram.com/reel/DWtbiPkgthI/' },
              timestamp: { type: 'string', example: '2026-04-04T12:32:16.000Z' },
              formattedDate: { type: 'string', example: 'Apr 4, 2026, 12:32 PM' },
            },
          },
        },
        total: { type: 'number', example: 15 },
        message: { type: 'string', example: 'Found 15 posts/reels from the last 30 days' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No Instagram account connected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAvailableMedia(
    @Request() req: any,
    @Query('contentType') contentType?: 'reel' | 'post_reel' | 'story',
    @Query('days') days?: string,
  ) {
    const influencerId = req.user.id;

    // Stories use a dedicated endpoint — GET /{ig-user-id}/stories (active for 24h only)
    if (contentType === 'story') {
      const result = await this.instagramService.getInstagramStories(influencerId, 'influencer');
      return {
        success: true,
        data: result.data,
        total: result.total,
        message: `Found ${result.total} active stories`,
      };
    }

    const parsedDays = days ? Number.parseInt(days, 10) : 30;
    const daysBack = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 30;

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);

    // post_reel is the legacy value from frontend — treat as 'reel'
    const normalizedContentType: 'reel' | undefined =
      contentType === 'post_reel' || contentType === 'reel' ? 'reel' : undefined;

    const result = await this.instagramService.getInstagramMediaByDateRange(
      influencerId,
      'influencer',
      fromDate,
      toDate,
      normalizedContentType,
      50,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      message: `Found ${result.total} ${contentType || 'posts/reels'} from the last ${daysBack} days`,
    };
  }

  @Get(':storeId')
  @ApiOperation({
    summary: 'Get Hype Store details',
    description:
      'Get detailed information about a specific Hype Store including cashback offers and brand info.\n\n' +
      '**Coupon Codes Explained:**\n' +
      '- `brandCouponCode`: Brand\'s shared coupon that customers use at checkout (e.g., HMCOL25 for H&M with 25% cashback)\n' +
      '- `myReferralCode`: Your unique referral code for attribution (e.g., INFL7)\n\n' +
      '**Webhook Usage:**\n' +
      'When customers purchase using your referral, the webhook should include:\n' +
      '- `couponCode`: The brandCouponCode (e.g., "HMCOL25")\n' +
      '- `referralCode`: Your myReferralCode (e.g., "INFL7")'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({
    status: 200,
    description: 'Store details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            storeName: { type: 'string', example: 'Store 1' },
            storeDescription: { type: 'string', example: 'Premium fashion brand offering trendy clothing' },
            bannerImageUrl: { type: 'string', example: 'https://example.com/banner.jpg' },
            logoUrl: { type: 'string', example: 'https://example.com/logo.jpg' },
            isActive: { type: 'boolean', example: true },
            brand: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 15 },
                brandName: { type: 'string', example: 'Myntra' },
                username: { type: 'string', example: 'myntra_official' },
                brandBio: { type: 'string', example: 'India\'s leading fashion destination' },
                profileImage: { type: 'string' },
                profileBanner: { type: 'string' },
              }
            },
            cashbackConfig: {
              type: 'object',
              properties: {
                reelPostMinCashback: { type: 'number', example: 100 },
                reelPostMaxCashback: { type: 'number', example: 15000 },
                storyMinCashback: { type: 'number', example: 100 },
                storyMaxCashback: { type: 'number', example: 10000 },
                monthlyClaimCount: { type: 'number', example: 3 },
                claimStrategy: { type: 'string', example: 'OPTIMIZED_SPEND' },
              }
            },
            brandCouponCode: {
              type: 'string',
              nullable: true,
              example: 'HMCOL25',
              description: 'Brand\'s shared coupon code that customers use at checkout'
            },
            myReferralCode: {
              type: 'string',
              example: 'INFL123',
              description: 'Your unique referral code for attribution (format: INFL{your_id})'
            },
            myCoupon: {
              type: 'object',
              nullable: true,
              description: 'Legacy field - use myReferralCode instead',
              properties: {
                couponCode: { type: 'string', example: 'INFL123' },
                isActive: { type: 'boolean', example: true },
              }
            },
            myStats: {
              type: 'object',
              properties: {
                totalOrders: { type: 'number', example: 15 },
                totalOrderValue: { type: 'number', example: 125000.00 },
                totalCashbackEarned: { type: 'number', example: 10500.00 },
                pendingCashback: { type: 'number', example: 1500.00 },
                creditedCashback: { type: 'number', example: 9000.00 },
              }
            },
            createdAt: { type: 'string', example: '2026-03-01T10:00:00.000Z' },
          }
        },
        message: { type: 'string', example: 'Store details retrieved successfully' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreById(
    @Request() req: any,
    @Param('storeId') storeId: string,
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getStoreDetails(influencerId, parseInt(storeId));
  }

  @Post('orders/:orderId/submit-proof')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit Instagram proof for cashback (Reel/Post/Story)',
    description:
      'Submit Instagram Reel, Post, or Story as proof of promotion to claim full cashback.\n\n' +
      'For **reels/posts**: provide `mediaId` OR `instagramUrl`.\n\n' +
      'For **stories**: provide `mediaId` from the available stories list (`GET /available-media?contentType=story`). ' +
      'Stories are verified live against the Instagram Stories API (active for 24 hours only).',
  })
  @ApiParam({ name: 'orderId', type: Number, description: 'Order ID' })
  @ApiBody({ type: SubmitProofDto })
  @ApiResponse({
    status: 200,
    description: 'Proof submitted successfully',
    type: SubmitProofResponseDto,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            externalOrderId: { type: 'string', example: 'ORD123456' },
            orderAmount: { type: 'number', example: 10800.00 },
            cashbackAmount: { type: 'number', example: 2000.00, description: 'Full 30% cashback amount' },
            cashbackStatus: { type: 'string', example: 'processing', description: 'Changed from pending to processing' },
            instagramProofUrl: { type: 'string', example: 'https://www.instagram.com/reel/ABC123xyz/' },
            proofContentType: { type: 'string', example: 'reel' },
            proofSubmittedAt: { type: 'string', example: '2026-03-10T10:00:00.000Z' },
            hypeStore: {
              type: 'object',
              properties: {
                storeName: { type: 'string', example: 'Store 1' },
                brand: {
                  type: 'object',
                  properties: {
                    brandName: { type: 'string', example: 'Myntra' },
                  },
                },
              },
            },
          },
        },
        message: { type: 'string', example: 'Proof submitted successfully. Cashback will be credited after verification.' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'Proof already submitted or cashback already credited' })
  @ApiResponse({ status: 403, description: 'This order does not belong to you' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async submitProof(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @Body() submitProofDto: SubmitProofDto,
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.submitProof(influencerId, parseInt(orderId), submitProofDto);
  }

  @Post('orders/:orderId/claim-minimum')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Claim minimum cashback without posting content (7% instant)',
    description:
      'Claim minimum cashback (7% or ₹100 flat) instantly without posting any content. ' +
      'No Instagram post/reel/story required. Cashback is credited immediately to wallet. ' +
      'This option is available as shown in UI: "Don\'t want to post a content? Claim minimum 7% cashback instantly without promoting the product"',
  })
  @ApiParam({ name: 'orderId', type: Number, description: 'Order ID' })
  @ApiBody({ type: ClaimMinimumCashbackDto })
  @ApiResponse({
    status: 200,
    description: 'Minimum cashback claimed and credited successfully',
    type: ClaimMinimumCashbackResponseDto,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            order: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 1 },
                externalOrderId: { type: 'string', example: 'ORD123456' },
                orderAmount: { type: 'number', example: 10800.00 },
                cashbackAmount: { type: 'number', example: 100.00, description: 'Minimum cashback amount (7% or flat ₹100)' },
                cashbackStatus: { type: 'string', example: 'credited', description: 'Changed from pending to credited' },
                cashbackCreditedAt: { type: 'string', example: '2026-03-10T10:00:00.000Z' },
                minimumCashbackClaimed: { type: 'boolean', example: true },
              },
            },
            wallet: {
              type: 'object',
              properties: {
                balance: { type: 'number', example: 1200.00, description: 'Updated wallet balance after crediting' },
                totalCashbackReceived: { type: 'number', example: 2400.00, description: 'Total lifetime cashback' },
              },
            },
            transaction: {
              type: 'object',
              properties: {
                id: { type: 'number', example: 101 },
                amount: { type: 'number', example: 100.00 },
                transactionType: { type: 'string', example: 'cashback' },
                description: { type: 'string', example: 'Minimum cashback for order ORD123456 (claimed without posting)' },
              },
            },
          },
        },
        message: { type: 'string', example: 'Minimum cashback of ₹100 has been credited to your wallet' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'Cashback already claimed or order not eligible' })
  @ApiResponse({ status: 403, description: 'This order does not belong to you' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async claimMinimumCashback(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @Body() _claimDto: ClaimMinimumCashbackDto,
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.claimMinimumCashback(influencerId, parseInt(orderId));
  }

  @Get(':storeId/referral-code')
  @ApiOperation({
    summary: 'Get or create referral code for a store',
    description: 'Get the influencer\'s unique referral code for a specific store. Used for brand-shared coupon tracking.',
  })
  @ApiParam({
    name: 'storeId',
    description: 'Hype Store ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Referral code retrieved or created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            referralCode: { type: 'string', example: 'INFL15' },
            hypeStoreId: { type: 'number', example: 1 },
            storeName: { type: 'string', example: 'Snitch Store' },
            brandName: { type: 'string', example: 'Snitch' },
            totalClicks: { type: 'number', example: 150 },
            totalOrders: { type: 'number', example: 12 },
            totalRevenue: { type: 'number', example: 45000.00 },
            isActive: { type: 'boolean', example: true },
          },
        },
        message: { type: 'string', example: 'Your referral code for this store' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 400, description: 'Store is not active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getReferralCode(@Request() req: any, @Param('storeId') storeId: string) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getOrCreateReferralCode(influencerId, parseInt(storeId));
  }

  @Get(':storeId/brand-coupon')
  @ApiOperation({
    summary: 'Get brand-shared coupon with tracking link',
    description:
      'Get the brand\'s shared coupon code along with your unique tracking link. ' +
      'Share this tracking link with your followers so purchases can be attributed to you.',
  })
  @ApiParam({
    name: 'storeId',
    description: 'Hype Store ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Brand-shared coupon with tracking link',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            couponCode: { type: 'string', example: 'SNITCHCOLLABKAROO' },
            referralCode: { type: 'string', example: 'INFL15' },
            trackingLink: {
              type: 'string',
              example: 'https://snitch.com?referralCode=INFL15&coupon=SNITCHCOLLABKAROO',
            },
            hypeStoreId: { type: 'number', example: 1 },
            storeName: { type: 'string', example: 'Snitch Store' },
            brandName: { type: 'string', example: 'Snitch' },
            instructions: {
              type: 'string',
              example: 'Share this link with your followers. When they use coupon SNITCHCOLLABKAROO at checkout, you\'ll get credited!',
            },
          },
        },
        message: { type: 'string', example: 'Brand-shared coupon with your referral tracking link' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store not found or no brand-shared coupon available' })
  @ApiResponse({ status: 400, description: 'Store is not active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBrandSharedCoupon(@Request() req: any, @Param('storeId') storeId: string) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getBrandSharedCoupon(influencerId, parseInt(storeId));
  }

  @Post('orders/:orderId/mark-returned')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark order as returned by customer',
    description:
      'Mark an order as returned. This will remove the locked cashback from your wallet. ' +
      'Can only be called if the customer returns the item before the return window closes.',
  })
  @ApiParam({ name: 'orderId', type: Number, description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order marked as returned successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            orderId: { type: 'number', example: 1 },
            removedCashback: { type: 'number', example: 2500.00 },
            walletLockedAmount: { type: 'number', example: 0.00 },
          },
        },
        message: { 
          type: 'string', 
          example: 'Return processed successfully. Cashback of ₹2500.00 has been removed from your wallet.' 
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'Order already marked as returned or no locked cashback' })
  @ApiResponse({ status: 403, description: 'This order does not belong to you' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markOrderReturned(
    @Request() req: any,
    @Param('orderId') orderId: string,
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.markOrderReturned(influencerId, parseInt(orderId));
  }

  @Post('orders/:orderId/refresh-instagram-metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh Instagram metrics for an order',
    description:
      'Manually refresh the Instagram view count, reach, and engagement metrics for a specific order. ' +
      'This fetches the latest data from Instagram API and updates the order record.',
  })
  @ApiParam({ name: 'orderId', type: Number, description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Instagram metrics refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Instagram metrics updated successfully' },
        data: {
          type: 'object',
          properties: {
            orderId: { type: 'number', example: 1 },
            previousViewCount: { type: 'number', example: 75 },
            newViewCount: { type: 'number', example: 125 },
            previousReach: { type: 'number', example: 67 },
            newReach: { type: 'number', example: 110 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Order not found or no Instagram proof URL' })
  @ApiResponse({ status: 403, description: 'This order does not belong to you' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async refreshInstagramMetrics(
    @Param('orderId') orderId: string,
  ) {
    // Note: The refreshMetricsForOrder method will handle order validation
    return this.instagramMetricsScheduler.refreshMetricsForOrder(parseInt(orderId));
  }

}
