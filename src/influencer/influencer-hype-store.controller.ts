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
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all available Hype Stores',
    description: 'Browse all active Hype Stores available for influencers. Returns stores with cashback offers, brand details, and influencer engagement status.'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by brand name or store name' })
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
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getAllStores(
      influencerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
    );
  }

  @Get('my-orders')
  @ApiOperation({
    summary: 'Get my orders and cashback history',
    description: 'Get all orders placed using influencer\'s coupon codes with cashback details'
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
  ) {
    const influencerId = req.user.id;
    return this.hypeStoreService.getMyOrders(
      influencerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      storeId ? parseInt(storeId) : undefined,
      cashbackStatus,
    );
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

  @Get(':storeId')
  @ApiOperation({
    summary: 'Get Hype Store details',
    description: 'Get detailed information about a specific Hype Store including cashback offers and brand info'
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
            myCoupon: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'number', example: 1 },
                couponCode: { type: 'string', example: 'INFL123MYNTRA' },
                isActive: { type: 'boolean', example: true },
                totalUses: { type: 'number', example: 15 },
                createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
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
      'Submit Instagram Reel, Post, or Story URL as proof of promotion to claim full cashback. ' +
      'After submission, cashback status changes to "processing" and will be reviewed by brand admin. ' +
      'Once approved, full cashback (up to 30%) will be credited to wallet.',
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
              example: 'https://snitch.com?ref=INFL15&coupon=SNITCHCOLLABKAROO',
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
}
