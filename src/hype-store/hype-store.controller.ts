import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { HypeStoreService } from './hype-store.service';
import { CreateHypeStoreDto, UpdateHypeStoreDto } from './dto/create-hype-store.dto';
import { UpdateCashbackConfigDto } from './dto/cashback-config.dto';
import { AddMoneyToWalletDto } from './dto/wallet.dto';
import { UpdateCreatorPreferenceDto } from './dto/creator-preference.dto';
import { CASHBACK_CLAIM_STRATEGIES } from './constants/cashback-strategies';
import { CreateWalletRechargeOrderDto, VerifyWalletPaymentDto } from './dto/wallet.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Hype Store')
@Controller('api/brand/hype-store')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class HypeStoreController {
  constructor(private readonly hypeStoreService: HypeStoreService) {}

  @Get('cashback-strategies')
  @ApiOperation({
    summary: 'Get available cashback claim strategies',
    description: 'Returns list of all available cashback claim strategies with their descriptions and claim limits'
  })
  @ApiResponse({ status: 200, description: 'List of cashback strategies retrieved successfully' })
  getCashbackStrategies() {
    return {
      strategies: CASHBACK_CLAIM_STRATEGIES,
    };
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new hype store (Brands only)',
    description:
      'Create a new hype store for your brand.\n\n' +
      '**Auto-generated/Auto-populated Fields:**\n' +
      '- Store name: Automatically generated as "Store 1", "Store 2", etc.\n' +
      '- Banner image: Auto-populated from brand profile banner (optional: can override with bannerImageUrl)\n' +
      '- Logo: Auto-populated from brand profile image\n' +
      '- Description: Auto-populated from brand bio\n' +
      '- Brand wallet: Created automatically if it doesn\'t exist\n\n' +
      '**Required Cashback Fields:**\n' +
      '- reelPostMaxCashback: Maximum cashback for reels/posts (Rs)\n' +
      '- storyMaxCashback: Maximum cashback for stories (Rs)\n' +
      '- monthlyClaimCount: Number of claims allowed per creator per month (1-6)\n\n' +
      '**Optional Cashback Fields:**\n' +
      '- reelPostMinCashback: Minimum cashback for reels/posts (default: Rs 100)\n' +
      '- storyMinCashback: Minimum cashback for stories (default: Rs 100)\n\n' +
      '**Note:** Creator targeting preferences (age, gender, niche, locations) should be configured separately using the PUT /:storeId/creator-preferences endpoint after store creation.\n\n' +
      '**Claim Strategy (Auto-derived from monthly claim count):**\n' +
      '- 1 claim = PILOT_RUN\n' +
      '- 2 claims = VALIDATE_ROI\n' +
      '- 3 claims = OPTIMIZED_SPEND (default)\n' +
      '- 4 claims = BALANCED_GROWTH\n' +
      '- 5 claims = AGGRESSIVE_ACQUISITION\n' +
      '- 6 claims = MAXIMUM_REACH'
  })
  @ApiBody({
    description: 'Hype Store Configuration',
    schema: {
      type: 'object',
      required: ['reelPostMaxCashback', 'storyMaxCashback', 'monthlyClaimCount'],
      properties: {
        bannerImageUrl: {
          type: 'string',
          format: 'uri',
          description: 'Banner image URL for the store (optional - auto-populated from brand profile)',
          example: 'https://example.com/images/store-banner.jpg'
        },
        reelPostMinCashback: {
          type: 'number',
          description: 'Minimum cashback for reel/post in Rs (optional - default: 100)',
          example: 100,
          default: 100,
          minimum: 0
        },
        reelPostMaxCashback: {
          type: 'number',
          description: 'Maximum cashback for reel/post in Rs (required)',
          example: 15000,
          minimum: 0
        },
        storyMinCashback: {
          type: 'number',
          description: 'Minimum cashback for story in Rs (optional - default: 100)',
          example: 100,
          default: 100,
          minimum: 0
        },
        storyMaxCashback: {
          type: 'number',
          description: 'Maximum cashback for story in Rs (required)',
          example: 10000,
          minimum: 0
        },
        monthlyClaimCount: {
          type: 'number',
          description: 'Number of cashback claims allowed per creator per month (required: 1-6)',
          minimum: 1,
          maximum: 6,
          example: 3
        }
      }
    },
    examples: {
      minimalConfig: {
        summary: 'Minimal Configuration (Required fields only)',
        description: 'Create store with only required fields. Min cashback will default to Rs 100 for both.',
        value: {
          reelPostMaxCashback: 15000,
          storyMaxCashback: 10000,
          monthlyClaimCount: 3
        }
      },
      basicConfig: {
        summary: 'Basic Configuration',
        description: 'Simple store setup with banner and custom cashback range',
        value: {
          bannerImageUrl: 'https://example.com/images/fashion-store-banner.jpg',
          reelPostMinCashback: 200,
          reelPostMaxCashback: 15000,
          storyMinCashback: 150,
          storyMaxCashback: 10000,
          monthlyClaimCount: 3
        }
      },
      highCashbackConfig: {
        summary: 'High Cashback Configuration',
        description: 'Store with higher cashback amounts for premium campaigns',
        value: {
          bannerImageUrl: 'https://example.com/images/beauty-store-banner.jpg',
          reelPostMinCashback: 500,
          reelPostMaxCashback: 20000,
          storyMinCashback: 300,
          storyMaxCashback: 15000,
          monthlyClaimCount: 5
        }
      },
      maximumReachConfig: {
        summary: 'Maximum Reach Configuration',
        description: 'Store with highest cashback and 6 monthly claims for maximum creator reach',
        value: {
          bannerImageUrl: 'https://example.com/images/electronics-banner.jpg',
          reelPostMinCashback: 1000,
          reelPostMaxCashback: 25000,
          storyMinCashback: 500,
          storyMaxCashback: 20000,
          monthlyClaimCount: 6
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Store created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            brandId: { type: 'number', example: 15 },
            storeName: { type: 'string', example: 'Store 1' },
            storeDescription: { type: 'string', nullable: true },
            bannerImageUrl: { type: 'string', example: 'https://example.com/banner.jpg' },
            logoUrl: { type: 'string', nullable: true },
            isActive: { type: 'boolean', example: true },
            monthlyCreatorLimit: { type: 'number', example: 5 },
            createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
            cashbackConfig: {
              type: 'object',
              properties: {
                reelPostMinCashback: { type: 'number', example: 100 },
                reelPostMaxCashback: { type: 'number', example: 12000 },
                storyMinCashback: { type: 'number', example: 100 },
                storyMaxCashback: { type: 'number', example: 12000 },
                monthlyClaimCount: { type: 'number', example: 3 },
                claimStrategy: { type: 'string', example: 'OPTIMIZED_SPEND' }
              }
            }
          }
        },
        message: { type: 'string', example: 'Hype store created successfully' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createStore(@Request() req: any, @Body() createDto: CreateHypeStoreDto) {
    const brandId = req.user.id;
    return this.hypeStoreService.createStore(brandId, createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all stores for current brand',
    description: 'Returns all hype stores belonging to the authenticated brand with cashback config and creator preferences'
  })
  @ApiResponse({
    status: 200,
    description: 'Stores retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              brandId: { type: 'number', example: 92 },
              storeName: { type: 'string', example: 'Store 1' },
              storeDescription: { type: 'string', nullable: true, example: 'My awesome store' },
              bannerImageUrl: { type: 'string', nullable: true, example: 'https://example.com/banner.jpg' },
              logoUrl: { type: 'string', nullable: true },
              isActive: { type: 'boolean', example: true },
              monthlyCreatorLimit: { type: 'number', example: 5 },
              createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
              updatedAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
              cashbackConfig: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  storeId: { type: 'number', example: 1 },
                  reelPostMinCashback: { type: 'number', example: 100 },
                  reelPostMaxCashback: { type: 'number', example: 12000 },
                  storyMinCashback: { type: 'number', example: 100 },
                  storyMaxCashback: { type: 'number', example: 12000 },
                  monthlyClaimCount: { type: 'number', example: 3 },
                  claimStrategy: { type: 'string', example: 'OPTIMIZED_SPEND' }
                }
              },
              creatorPreferences: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  storeId: { type: 'number', example: 1 },
                  influencerTypes: { type: 'array', items: { type: 'string' }, example: ['micro', 'macro'] },
                  minAge: { type: 'number', example: 18 },
                  maxAge: { type: 'number', example: 35 },
                  genderPreference: { type: 'array', items: { type: 'string' }, example: ['Male', 'Female'] },
                  nicheCategories: { type: 'array', items: { type: 'string' }, example: ['Fashion', 'Beauty'] },
                  preferredLocations: { type: 'array', items: { type: 'string' }, example: ['Mumbai', 'Delhi'] },
                  isPanIndia: { type: 'boolean', example: false }
                }
              }
            }
          }
        },
        message: { type: 'string', example: 'Stores retrieved successfully' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyStores(@Request() req: any) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoresByBrandId(brandId);
  }

  @Get('wallet/balance')
  @ApiOperation({
    summary: 'Get wallet balance',
    description: 'Get brand-level wallet balance shared across all stores. Wallet is created automatically when first store is created.'
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        userId: { type: 'number', example: 92, description: 'Brand ID' },
        userType: { type: 'string', example: 'brand', enum: ['brand', 'influencer'] },
        balance: { type: 'number', example: 25000.00, description: 'Current wallet balance in Rs' },
        totalCredited: { type: 'number', example: 50000.00, description: 'Total amount added to wallet (recharges + refunds)' },
        totalDebited: { type: 'number', example: 25000.00, description: 'Total amount spent from wallet (payments to influencers)' },
        totalCashbackReceived: { type: 'number', example: 0.00, description: 'Total cashback received (influencers only)' },
        totalRedeemed: { type: 'number', example: 0.00, description: 'Total amount withdrawn (influencers only)' },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2026-03-07T12:30:00.000Z' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Wallet not found for this brand' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWalletBalance(@Request() req: any) {
    const brandId = req.user.id;
    return this.hypeStoreService.getWalletBalance(brandId);
  }

  @Get('wallet/transactions')
  @ApiOperation({
    summary: 'Get wallet transaction history',
    description: 'Get paginated wallet transaction history for the brand'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination (default: 0)' })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              walletId: { type: 'number', example: 1 },
              transactionType: {
                type: 'string',
                example: 'recharge',
                enum: ['recharge', 'debit', 'cashback', 'redemption', 'refund', 'adjustment'],
                description: 'recharge: Brand adds money | debit: Brand pays influencer | cashback: Influencer receives cashback | redemption: Influencer withdraws | refund: Money returned | adjustment: Admin adjustment'
              },
              amount: { type: 'number', example: 10000.00, description: 'Transaction amount in Rs' },
              balanceBefore: { type: 'number', example: 15000.00, description: 'Wallet balance before transaction' },
              balanceAfter: { type: 'number', example: 25000.00, description: 'Wallet balance after transaction' },
              status: {
                type: 'string',
                example: 'completed',
                enum: ['pending', 'processing', 'completed', 'failed', 'cancelled']
              },
              paymentGateway: { type: 'string', example: 'razorpay', nullable: true },
              paymentOrderId: { type: 'string', example: 'order_NXt7aB3kEFG9H2', nullable: true },
              paymentTransactionId: { type: 'string', example: 'pay_NXt7aB3kEFG9H2', nullable: true },
              paymentReferenceId: { type: 'string', nullable: true },
              upiId: { type: 'string', nullable: true, description: 'UPI ID for redemptions' },
              relatedUserId: { type: 'number', nullable: true, description: 'Recipient influencer ID for debits' },
              relatedUserType: { type: 'string', nullable: true, example: 'influencer' },
              campaignId: { type: 'number', nullable: true },
              hypeStoreId: { type: 'number', nullable: true },
              description: { type: 'string', example: 'Wallet recharge via Razorpay' },
              notes: { type: 'string', nullable: true },
              metadata: { type: 'object', nullable: true, description: 'Additional data (e.g., razorpay response)' },
              processedBy: { type: 'number', nullable: true, description: 'Admin who processed (for redemptions)' },
              processedAt: { type: 'string', nullable: true },
              failedReason: { type: 'string', nullable: true },
              createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
              updatedAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' }
            }
          }
        },
        total: { type: 'number', example: 15, description: 'Total number of transactions' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Wallet not found for this brand' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWalletTransactions(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.getWalletTransactions(
      brandId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Post('wallet/create-order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create Razorpay order for wallet recharge',
    description: 'Step 1 of wallet recharge: Creates Razorpay payment order. Minimum recharge: Rs 5,000. Returns orderId and amount for Razorpay checkout.'
  })
  @ApiBody({
    description: 'Wallet recharge amount',
    schema: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: {
          type: 'number',
          description: 'Amount to add to wallet in Rs (minimum 5000)',
          example: 10000,
          minimum: 5000
        }
      }
    },
    examples: {
      minimumRecharge: {
        summary: 'Minimum Recharge',
        description: 'Minimum allowed recharge amount',
        value: {
          amount: 5000
        }
      },
      standardRecharge: {
        summary: 'Standard Recharge',
        description: 'Common recharge amount',
        value: {
          amount: 10000
        }
      },
      largeRecharge: {
        summary: 'Large Recharge',
        description: 'Large recharge for campaigns',
        value: {
          amount: 50000
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Razorpay order created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        orderId: { type: 'string', example: 'order_NXt7aB3kEFG9H2', description: 'Razorpay order ID - use this in Razorpay checkout' },
        amount: { type: 'number', example: 1000000, description: 'Amount in paise (Rs 10,000 = 1000000 paise)' },
        currency: { type: 'string', example: 'INR' },
        receipt: { type: 'string', example: 'WALLET_92_1709805600000' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Amount below minimum (Rs 5,000)' })
  @ApiResponse({ status: 404, description: 'Wallet not found for this brand' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createWalletRechargeOrder(
    @Request() req: any,
    @Body() createOrderDto: CreateWalletRechargeOrderDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.createWalletRechargeOrder(brandId, createOrderDto.amount);
  }

  @Post('wallet/verify-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Razorpay payment and credit wallet',
    description: 'Step 2 of wallet recharge: Verifies Razorpay payment signature and credits wallet balance. Call this after user completes payment on Razorpay checkout.'
  })
  @ApiBody({
    description: 'Razorpay payment verification details',
    schema: {
      type: 'object',
      required: ['orderId', 'paymentId', 'signature'],
      properties: {
        orderId: {
          type: 'string',
          description: 'Razorpay order ID received from create-order API',
          example: 'order_NXt7aB3kEFG9H2'
        },
        paymentId: {
          type: 'string',
          description: 'Razorpay payment ID received after successful payment',
          example: 'pay_NXt7aB3kEFG9H2'
        },
        signature: {
          type: 'string',
          description: 'Razorpay signature received after successful payment',
          example: 'a8b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7'
        }
      }
    },
    examples: {
      successfulPayment: {
        summary: 'Successful Payment Verification',
        description: 'Example with valid Razorpay payment details',
        value: {
          orderId: 'order_NXt7aB3kEFG9H2',
          paymentId: 'pay_NXt7aB3kEFG9H2',
          signature: 'a8b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verified and wallet credited',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        userId: { type: 'number', example: 92 },
        userType: { type: 'string', example: 'brand' },
        balance: { type: 'number', example: 35000.00, description: 'Updated balance after recharge' },
        totalCredited: { type: 'number', example: 60000.00, description: 'Total amount credited including this recharge' },
        totalDebited: { type: 'number', example: 25000.00 },
        totalCashbackReceived: { type: 'number', example: 0.00 },
        totalRedeemed: { type: 'number', example: 0.00 },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2026-03-07T12:45:00.000Z' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid payment signature or payment not successful' })
  @ApiResponse({ status: 404, description: 'Wallet not found for this brand' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyWalletPayment(
    @Request() req: any,
    @Body() verifyPaymentDto: VerifyWalletPaymentDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.verifyAndAddMoneyToWallet(
      brandId,
      verifyPaymentDto.orderId,
      verifyPaymentDto.paymentId,
      verifyPaymentDto.signature,
    );
  }

  @Post('wallet/add-money')
  @ApiOperation({
    summary: 'Add money to wallet (Manual/Admin)',
    description: 'Legacy endpoint for manual wallet additions. Use create-order + verify-payment for Razorpay flow.'
  })
  @ApiResponse({ status: 200, description: 'Money added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid amount or below minimum' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addMoneyToWallet(@Request() req: any, @Body() addMoneyDto: AddMoneyToWalletDto) {
    const brandId = req.user.id;
    return this.hypeStoreService.addMoneyToWallet(brandId, addMoneyDto);
  }

  @Get(':storeId')
  @ApiOperation({
    summary: 'Get store details by ID',
    description: 'Get specific store details including basic info, cashback config, and creator preferences'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreById(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreById(parseInt(storeId), brandId);
  }

  @Put(':storeId')
  @ApiOperation({
    summary: 'Update store details',
    description: 'Update store banner image, description, or active status'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Store updated successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateStore(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateHypeStoreDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateStore(parseInt(storeId), brandId, updateDto);
  }

  @Get(':storeId/cashback-config')
  @ApiOperation({
    summary: 'Get cashback configuration',
    description: 'Get cashback configuration for the store. Minimum cashback is fixed at Rs 100.'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Cashback config retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCashbackConfig(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getCashbackConfig(parseInt(storeId), brandId);
  }

  @Put(':storeId/cashback-config')
  @ApiOperation({
    summary: 'Update cashback configuration',
    description: 'Update max cashback, cashback percentage, and monthly claim count (1-6). Minimum cashback is fixed at Rs 100 and cannot be changed. Claim strategy is automatically derived from claim count.'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Cashback config updated successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCashbackConfig(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateCashbackConfigDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateCashbackConfig(parseInt(storeId), brandId, updateDto);
  }

  @Get(':storeId/creator-preferences')
  @ApiOperation({
    summary: 'Get creator targeting preferences',
    description: 'Get creator targeting preferences including influencer types, age, gender, niche, and locations'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Creator preferences retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCreatorPreferences(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getCreatorPreferences(parseInt(storeId), brandId);
  }

  @Put(':storeId/creator-preferences')
  @ApiOperation({
    summary: 'Update creator targeting preferences',
    description: 'Update creator targeting criteria for the store'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Creator preferences updated successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCreatorPreferences(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() updateDto: UpdateCreatorPreferenceDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateCreatorPreferences(parseInt(storeId), brandId, updateDto);
  }

  @Get(':storeId/dashboard')
  @ApiOperation({
    summary: 'Get store dashboard analytics',
    description: 'Get comprehensive analytics including total orders, revenue, active creators, conversion rate, etc.'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({ status: 200, description: 'Dashboard analytics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreDashboard(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreDashboard(parseInt(storeId), brandId);
  }

  @Get(':storeId/orders')
  @ApiOperation({
    summary: 'Get all orders for store',
    description: 'Get paginated list of all orders for the store'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of records (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination (default: 0)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreOrders(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreOrders(
      parseInt(storeId),
      brandId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get(':storeId/orders/:orderId')
  @ApiOperation({
    summary: 'Get order details',
    description: 'Get detailed information about a specific order'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiParam({ name: 'orderId', type: String, description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOrderDetails(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.getOrderDetails(parseInt(storeId), brandId, orderId);
  }
}
