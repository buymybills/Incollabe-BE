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
  UseInterceptors,
  UploadedFile,
  Headers,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody, ApiConsumes, ApiHeader } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { HypeStoreService } from './hype-store.service';
import { CreateHypeStoreDto, UpdateHypeStoreDto } from './dto/create-hype-store.dto';
import { UpdateCashbackConfigDto } from './dto/cashback-config.dto';
import { AddMoneyToWalletDto } from './dto/wallet.dto';
import { UpdateCreatorPreferenceDto } from './dto/creator-preference.dto';
import { CreateBrandSharedCouponDto } from './dto/create-brand-shared-coupon.dto';
import { CASHBACK_CLAIM_STRATEGIES } from './constants/cashback-strategies';
import { CreateWalletRechargeOrderDto, VerifyWalletPaymentDto } from './dto/wallet.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PurchaseWebhookDto, ReturnWebhookDto, WebhookResponseDto } from '../wallet/dto/hype-store-webhook.dto';

@ApiTags('Hype Store')
@Controller('brand/hype-store')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class HypeStoreController {
  constructor(
    private readonly hypeStoreService: HypeStoreService,
    private readonly configService: ConfigService,
  ) {}

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
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create new hype store (Brands only)',
    description:
      'Create a new hype store for your brand.\n\n' +
      '**Auto-generated/Auto-populated Fields:**\n' +
      '- Store name: Automatically generated as "Store 1", "Store 2", etc.\n' +
      '- Banner image: Auto-populated from brand profile banner (optional: can upload custom banner)\n' +
      '- Logo: Auto-populated from brand profile image\n' +
      '- Description: Auto-populated from brand bio\n' +
      '- Brand wallet: Created automatically if it doesn\'t exist\n\n' +
      '**Required Cashback Fields:**\n' +
      '- reelPostMaxCashback: Maximum cashback for reels/posts (Rs)\n' +
      '- storyMaxCashback: Maximum cashback for stories (Rs)\n' +
      '- monthlyClaimCount: Number of claims allowed per creator per month (1-6)\n\n' +
      '**Optional Cashback Fields:**\n' +
      '- reelPostMinCashback: Minimum cashback for reels/posts (default: Rs 100)\n' +
      '- storyMinCashback: Minimum cashback for stories (default: Rs 100)\n' +
      '- bannerImage: Upload custom banner image (JPG, PNG, max 5MB) - overrides brand profile banner\n\n' +
      '**Note:** Creator targeting preferences (age, gender, niche, locations) are configured at brand level using the PUT /creator-preferences endpoint and apply to all stores.\n\n' +
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
        bannerImage: {
          type: 'string',
          format: 'binary',
          description: 'Banner image file for the store (optional - auto-populated from brand profile if not provided). Max 5MB. Supported formats: JPG, PNG, WEBP',
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
        },
        cashbackPercentage: {
          type: 'number',
          description: 'Cashback percentage for coupon code suffix (optional: 1-99, default: 25). This becomes the last 2 digits of the auto-generated coupon code. Example: 25 generates SNCOL25',
          minimum: 1,
          maximum: 99,
          example: 25,
          default: 25
        }
      }
    },
    examples: {
      minimalConfig: {
        summary: 'Minimal Configuration (Required fields only)',
        description: 'Create store with only required fields. Min cashback will default to Rs 100 for both. Banner will be auto-populated from brand profile. Coupon code will be auto-generated as XXCOL25 (25% default).',
        value: {
          reelPostMaxCashback: 15000,
          storyMaxCashback: 10000,
          monthlyClaimCount: 3
        }
      },
      customCashbackConfig: {
        summary: 'Custom Cashback Configuration',
        description: 'Store setup with custom cashback range and custom coupon percentage. Coupon will be auto-generated as XXCOL30 (30% cashback). Upload banner image as file (not shown in example).',
        value: {
          reelPostMinCashback: 200,
          reelPostMaxCashback: 15000,
          storyMinCashback: 150,
          storyMaxCashback: 10000,
          monthlyClaimCount: 3,
          cashbackPercentage: 30
        }
      },
      highCashbackConfig: {
        summary: 'High Cashback Configuration',
        description: 'Store with higher cashback amounts for premium campaigns. Upload custom banner via file upload field (not shown in example).',
        value: {
          reelPostMinCashback: 500,
          reelPostMaxCashback: 20000,
          storyMinCashback: 300,
          storyMaxCashback: 15000,
          monthlyClaimCount: 5
        }
      },
      maximumReachConfig: {
        summary: 'Maximum Reach Configuration',
        description: 'Store with highest cashback and 6 monthly claims for maximum creator reach. Banner can be uploaded separately.',
        value: {
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
            },
            webhookCredentials: {
              type: 'object',
              description: 'Webhook integration for sending order events (purchase/return)',
              properties: {
                apiKey: {
                  type: 'string',
                  example: 'hs_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
                  description: 'API key included in webhook URL'
                },
                webhookUrl: {
                  type: 'string',
                  example: 'https://api.incollabe.com/webhooks/hype-store/hs_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
                  description: 'Unified webhook endpoint - POST with eventType in body'
                },
                message: {
                  type: 'string',
                  example: 'POST to this URL with eventType ("purchase" or "return") in the request body. See API docs for examples.'
                }
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
  @UseInterceptors(
    FileInterceptor('bannerImage', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
      },
    }),
  )
  async createStore(
    @Request() req: any,
    @Body() createDto: CreateHypeStoreDto,
    @UploadedFile() bannerImage?: Express.Multer.File,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.createStore(brandId, createDto, bannerImage);
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

  // DEPRECATED: Use POST /wallet/recharge from wallet module instead
  // @Post('wallet/create-order')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({
  //   summary: 'Create Razorpay order for wallet recharge',
  //   description: 'Step 1 of wallet recharge: Creates Razorpay payment order. Minimum recharge: Rs 5,000. Returns orderId and amount for Razorpay checkout.'
  // })
  // @ApiBody({
  //   description: 'Wallet recharge amount',
  //   schema: {
  //     type: 'object',
  //     required: ['amount'],
  //     properties: {
  //       amount: {
  //         type: 'number',
  //         description: 'Amount to add to wallet in Rs (minimum 5000)',
  //         example: 10000,
  //         minimum: 5000
  //       }
  //     }
  //   },
  //   examples: {
  //     minimumRecharge: {
  //       summary: 'Minimum Recharge',
  //       description: 'Minimum allowed recharge amount',
  //       value: {
  //         amount: 5000
  //       }
  //     },
  //     standardRecharge: {
  //       summary: 'Standard Recharge',
  //       description: 'Common recharge amount',
  //       value: {
  //         amount: 10000
  //       }
  //     },
  //     largeRecharge: {
  //       summary: 'Large Recharge',
  //       description: 'Large recharge for campaigns',
  //       value: {
  //         amount: 50000
  //       }
  //     }
  //   }
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Razorpay order created successfully',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       success: { type: 'boolean', example: true },
  //       id: { type: 'string', example: 'WALLET_92_1709805600000', description: 'Unique wallet recharge order ID' },
  //       payment: {
  //         type: 'object',
  //         properties: {
  //           orderId: { type: 'string', example: 'order_NXt7aB3kEFG9H2', description: 'Razorpay order ID - use this in Razorpay checkout' },
  //           amount: { type: 'number', example: 1000000, description: 'Amount in paise (Rs 10,000 = 1000000 paise)' },
  //           currency: { type: 'string', example: 'INR' },
  //           keyId: { type: 'string', example: 'rzp_test_...', description: 'Razorpay API Key ID for checkout' }
  //         }
  //       }
  //     }
  //   }
  // })
  // @ApiResponse({ status: 400, description: 'Amount below minimum (Rs 5,000)' })
  // @ApiResponse({ status: 404, description: 'Wallet not found for this brand' })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // async createWalletRechargeOrder(
  //   @Request() req: any,
  //   @Body() createOrderDto: CreateWalletRechargeOrderDto,
  // ) {
  //   const brandId = req.user.id;
  //   return this.hypeStoreService.createWalletRechargeOrder(brandId, createOrderDto.amount);
  // }

  // DEPRECATED: Use POST /wallet/verify-payment from wallet module instead
  // @Post('wallet/verify-payment')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({
  //   summary: 'Verify Razorpay payment and credit wallet',
  //   description: 'Step 2 of wallet recharge: Verifies Razorpay payment signature and credits wallet balance. Call this after user completes payment on Razorpay checkout.'
  // })
  // @ApiBody({
  //   description: 'Razorpay payment verification details',
  //   schema: {
  //     type: 'object',
  //     required: ['orderId', 'paymentId', 'signature'],
  //     properties: {
  //       orderId: {
  //         type: 'string',
  //         description: 'Razorpay order ID received from create-order API',
  //         example: 'order_NXt7aB3kEFG9H2'
  //       },
  //       paymentId: {
  //         type: 'string',
  //         description: 'Razorpay payment ID received after successful payment',
  //         example: 'pay_NXt7aB3kEFG9H2'
  //       },
  //       signature: {
  //         type: 'string',
  //         description: 'Razorpay signature received after successful payment',
  //         example: 'a8b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7'
  //       }
  //     }
  //   },
  //   examples: {
  //     successfulPayment: {
  //       summary: 'Successful Payment Verification',
  //       description: 'Example with valid Razorpay payment details',
  //       value: {
  //         orderId: 'order_NXt7aB3kEFG9H2',
  //         paymentId: 'pay_NXt7aB3kEFG9H2',
  //         signature: 'a8b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7'
  //       }
  //     }
  //   }
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Payment verified and wallet credited',
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       id: { type: 'number', example: 1 },
  //       userId: { type: 'number', example: 92 },
  //       userType: { type: 'string', example: 'brand' },
  //       balance: { type: 'number', example: 35000.00, description: 'Updated balance after recharge' },
  //       totalCredited: { type: 'number', example: 60000.00, description: 'Total amount credited including this recharge' },
  //       totalDebited: { type: 'number', example: 25000.00 },
  //       totalCashbackReceived: { type: 'number', example: 0.00 },
  //       totalRedeemed: { type: 'number', example: 0.00 },
  //       isActive: { type: 'boolean', example: true },
  //       createdAt: { type: 'string', example: '2026-03-07T10:00:00.000Z' },
  //       updatedAt: { type: 'string', example: '2026-03-07T12:45:00.000Z' }
  //     }
  //   }
  // })
  // @ApiResponse({ status: 400, description: 'Invalid payment signature or payment not successful' })
  // @ApiResponse({ status: 404, description: 'Wallet not found for this brand' })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // async verifyWalletPayment(
  //   @Request() req: any,
  //   @Body() verifyPaymentDto: VerifyWalletPaymentDto,
  // ) {
  //   const brandId = req.user.id;
  //   return this.hypeStoreService.verifyAndAddMoneyToWallet(
  //     brandId,
  //     verifyPaymentDto.orderId,
  //     verifyPaymentDto.paymentId,
  //     verifyPaymentDto.signature,
  //   );
  // }

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

  @Get('creator-preferences')
  @ApiOperation({
    summary: 'Get brand-level creator targeting preferences',
    description: 'Returns the creator targeting preferences configured for the authenticated brand (applies to all stores)'
  })
  @ApiResponse({ status: 200, description: 'Creator preferences retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBrandCreatorPreferences(@Request() req: any) {
    const brandId = req.user.id;
    return this.hypeStoreService.getCreatorPreferences(brandId);
  }

  @Get(':storeId')
  @ApiOperation({
    summary: 'Get store details by ID',
    description:
      'Get comprehensive store details including performance metrics, budget, orders, and sales analytics.\n\n' +
      '**Coupon Code Usage:**\n' +
      '- `brandCouponCode`: Brand-shared coupon code (e.g., SNCOL25) that customers use at checkout\n' +
      '- Influencers share this coupon code WITH their unique referral code (e.g., INFL123)\n' +
      '- Example: Customer uses couponCode="SNCOL25" + referralCode="INFL123" for influencer attribution\n\n' +
      '**Webhook Integration:**\n' +
      'When sending purchase webhooks, include both:\n' +
      '- `couponCode`: "SNCOL25" (from this API response)\n' +
      '- `referralCode`: "INFL123" (influencer who promoted the product)'
  })
  @ApiParam({ name: 'storeId', type: Number, description: 'Store ID' })
  @ApiResponse({
    status: 200,
    description: 'Store details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 9 },
        storeName: { type: 'string', example: 'Store 1' },
        brandCouponCode: {
          type: 'string',
          example: 'SNCOL25',
          description: 'Brand-shared coupon code that customers use at checkout. Influencers share this code WITH their referral code (e.g., INFL123) for attribution.'
        },
        cashbackLimit: { type: 'string', example: '25%', description: 'Cashback percentage extracted from coupon code (last 2 digits)' },
        monthlyPurchaseLimit: { type: 'number', example: 5, description: 'Monthly cashback claim limit per influencer' },
        wallet: {
          type: 'object',
          nullable: true,
          properties: {
            totalBudget: { type: 'number', example: 110000, description: 'Total amount added to wallet' },
            budgetUtilised: { type: 'number', example: 10000, description: 'Total cashback paid to influencers' },
            budgetRemaining: { type: 'number', example: 100000, description: 'Remaining wallet balance' },
            predictedValidityTransactions: { type: 'number', example: 50, description: 'Predicted number of transactions till budget depletes', nullable: true },
          },
        },
        orders: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 400, description: 'Total number of orders' },
            growthPercentage: { type: 'number', example: 10, description: 'Growth percentage vs last month' },
          },
        },
        sales: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 4250000, description: 'Total sales amount (₹42.5L)' },
            growthPercentage: { type: 'number', example: -5, description: 'Growth percentage vs last month (negative = decline)' },
          },
        },
        aggregatePerformance: {
          type: 'object',
          properties: {
            expectedROI: { type: 'number', example: 1.4, description: 'Average ROI across all influencers' },
            estimatedEngagement: { type: 'number', example: 13100, description: 'Average engagement count' },
            estimatedReach: { type: 'number', example: 210000, description: 'Average reach' },
            engagementScore: { type: 'number', example: 85.5, description: 'Average engagement score (0-100)' },
            totalInfluencers: { type: 'number', example: 15, description: 'Number of influencers who submitted proof' },
            tierLabels: {
              type: 'object',
              properties: {
                expectedROI: { type: 'string', example: 'Elite' },
                estimatedEngagement: { type: 'string', example: 'Elite' },
                estimatedReach: { type: 'string', example: 'Elite' },
              },
            },
          },
        },
        cashbackConfig: { type: 'object', description: 'Cashback configuration details' },
        creatorPreferences: { type: 'object', description: 'Creator targeting preferences', nullable: true },
        webhookCredentials: {
          type: 'object',
          nullable: true,
          description: 'Webhook integration credentials for receiving order events',
          properties: {
            apiKey: { type: 'string', example: 'hs_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', description: 'API key for webhook URL' },
            webhookUrl: { type: 'string', example: 'https://api.incollabe.com/webhooks/hype-store/hs_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', description: 'Webhook endpoint URL' },
            isActive: { type: 'boolean', example: true, description: 'Whether credentials are active' },
            createdAt: { type: 'string', example: '2026-03-12T08:00:00.000Z', description: 'When credentials were created' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreById(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getStoreById(parseInt(storeId), brandId);
  }

  @Put('creator-preferences')
  @ApiOperation({
    summary: 'Update brand-level creator targeting preferences',
    description: 'Update creator targeting criteria that apply to all stores under the brand'
  })
  @ApiBody({
    description: 'Creator preference payload',
    schema: {
      type: 'object',
      properties: {
        influencerTypes: {
          type: 'array',
          items: { type: 'string', enum: ['BELOW_1K', 'NANO', 'MICRO', 'MID_TIER', 'MACRO', 'MEGA'] },
          example: ['MICRO', 'MID_TIER']
        },
        minAge: { type: 'integer', example: 18 },
        maxAge: { type: 'integer', example: 45 },
        genderPreference: {
          type: 'array',
          items: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHERS'] },
          example: ['FEMALE']
        },
        nicheCategories: { type: 'array', items: { type: 'string' }, example: ['fashion', 'beauty'] },
        preferredLocations: { type: 'array', items: { type: 'string' }, example: ['Delhi', 'Mumbai'] },
        isPanIndia: { type: 'boolean', example: false },
      },
      required: [],
    },
    examples: {
      basic: {
        summary: 'Typical preference update',
        value: {
          influencerTypes: ['MICRO', 'MID_TIER'],
          minAge: 21,
          maxAge: 35,
          genderPreference: ['FEMALE'],
          nicheCategories: ['beauty', 'lifestyle'],
          preferredLocations: ['Bengaluru', 'Delhi'],
          isPanIndia: false,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Creator preferences updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateCreatorPreferences(
    @Request() req: any,
    @Body() updateDto: UpdateCreatorPreferenceDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.updateCreatorPreferences(brandId, updateDto);
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
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 123 },
              externalOrderId: { type: 'string', example: 'ORD-2026-0001' },
              hypeStoreId: { type: 'number', example: 9 },
              influencerId: { type: 'number', example: 45 },
              couponCode: { type: 'string', example: 'BRAND123' },
              orderAmount: { type: 'number', example: 1500 },
              cashbackAmount: { type: 'number', example: 250 },
              orderStatus: { type: 'string', example: 'COMPLETED' },
              cashbackStatus: { type: 'string', example: 'SENT' },
              createdAt: { type: 'string', example: '2026-03-11T10:00:00.000Z' },
            },
          },
        },
        total: { type: 'number', example: 120 },
      },
      example: {
        orders: [
          {
            id: 123,
            externalOrderId: 'ORD-2026-0001',
            hypeStoreId: 9,
            influencerId: 45,
            couponCode: 'BRAND123',
            orderAmount: 1500,
            cashbackAmount: 250,
            orderStatus: 'COMPLETED',
            cashbackStatus: 'SENT',
            createdAt: '2026-03-11T10:00:00.000Z',
          },
        ],
        total: 120,
      },
    },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 123 },
        externalOrderId: { type: 'string', example: '346KJNRGB' },
        orderTitle: {
          type: 'string',
          example: 'JBL Tune 770NC Active Noise Cancelling, 70Hr Playtime, Fast Pair & Multi Connect Bluetooth',
          nullable: true,
        },
        orderDate: { type: 'string', example: '2025-06-10T01:23:00.000Z' },
        orderAmount: { type: 'number', example: 10800 },
        orderStatus: { type: 'string', example: 'delivered' },
        cashback: {
          type: 'object',
          properties: {
            amount: { type: 'number', example: 1000.0 },
            type: { type: 'string', example: 'Flat 20%', nullable: true },
            status: { type: 'string', example: 'credited' },
            creditedAt: { type: 'string', example: '2025-08-15T10:00:00.000Z', nullable: true },
          },
        },
        promotionMedia: {
          type: 'object',
          nullable: true,
          properties: {
            type: { type: 'string', example: 'REEL', description: 'Content type: REEL, POST, or STORY' },
            url: { type: 'string', example: 'https://instagram.com/reel/abc123', description: 'Instagram content URL' },
            thumbnailUrl: { type: 'string', example: 'https://cdn.example.com/reels/123-thumb.jpg', nullable: true, description: 'Thumbnail image URL' },
            postedAt: { type: 'string', example: '2025-08-01T10:00:00.000Z', nullable: true, description: 'When content was posted on Instagram' },
            viewCount: { type: 'number', example: 32000, nullable: true, description: 'View count from Instagram Insights (updated asynchronously)' },
            submittedAt: { type: 'string', example: '2025-08-01T10:30:00.000Z', description: 'When proof was submitted to the platform' },
          },
        },
        performance: {
          type: 'object',
          properties: {
            expectedROI: { type: 'number', example: 1.4, description: 'Calculated ROI percentage based on reach value vs cashback cost' },
            estimatedEngagement: { type: 'number', example: 13100, description: 'Total engagement count (likes + comments + shares + saves)' },
            estimatedReach: { type: 'number', example: 210000, description: 'Average reach from Instagram insights' },
            avgEngagementRate: { type: 'number', example: 3.5, description: 'Average engagement rate percentage' },
            engagementScore: { type: 'number', example: 85.5, description: 'Engagement strength score (0-100) from profile scoring service' },
            engagementRating: { type: 'string', example: 'Excellent', description: 'Engagement rating: Exceptional, Excellent, Good, Fair, or Poor' },
            dataSource: { type: 'string', example: 'instagram_insights', enum: ['instagram_insights', 'estimated'], description: 'Source of performance data' },
            tierLabels: {
              type: 'object',
              properties: {
                expectedROI: { type: 'string', example: 'Elite' },
                estimatedEngagement: { type: 'string', example: 'Elite' },
                estimatedReach: { type: 'string', example: 'Elite' },
              },
            },
          },
        },
        store: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 9 },
            name: { type: 'string', example: 'Store 1' },
          },
        },
        influencer: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 45 },
            name: { type: 'string', example: 'Creator Name' },
          },
        },
        createdAt: { type: 'string', example: '2026-03-11T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2026-03-11T10:05:00.000Z' },
      },
      example: {
        id: 123,
        externalOrderId: '346KJNRGB',
        orderTitle: 'JBL Tune 770NC Active Noise Cancelling, 70Hr Playtime, Fast Pair & Multi Connect Bluetooth',
        orderDate: '2025-06-10T01:23:00.000Z',
        orderAmount: 10800,
        orderStatus: 'delivered',
        cashback: {
          amount: 1000.0,
          type: 'Flat 20%',
          status: 'credited',
          creditedAt: '2025-08-15T10:00:00.000Z',
        },
        promotionMedia: {
          type: 'REEL',
          url: 'https://instagram.com/reel/abc123',
          thumbnailUrl: 'https://cdn.example.com/reels/123-thumb.jpg',
          postedAt: '2025-08-01T10:00:00.000Z',
          viewCount: 32000,
          submittedAt: '2025-08-01T10:30:00.000Z',
        },
        performance: {
          expectedROI: 1.4,
          estimatedEngagement: 13100,
          estimatedReach: 210000,
          avgEngagementRate: 3.5,
          engagementScore: 85.5,
          engagementRating: 'Excellent',
          dataSource: 'instagram_insights',
          tierLabels: {
            expectedROI: 'Elite',
            estimatedEngagement: 'Elite',
            estimatedReach: 'Elite',
          },
        },
        store: { id: 9, name: 'Store 1' },
        influencer: { id: 45, name: 'Creator Name' },
        createdAt: '2026-03-11T10:00:00.000Z',
        updatedAt: '2026-03-11T10:05:00.000Z',
      },
    },
  })
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

  // ==================== Webhook Credentials Endpoints ====================

  @Get(':storeId/webhook-credentials')
  @ApiOperation({
    summary: 'Get webhook API key for store',
    description:
      'Get the API key for your webhook integration.\n\n' +
      '**Important:** For security, the webhook secret is only shown ONCE during store creation. If you lost it, please contact support.',
  })
  @ApiParam({
    name: 'storeId',
    type: Number,
    description: 'Store ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook API key retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          example: 'hs_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
          description: 'API key for webhook URL path',
        },
        isActive: {
          type: 'boolean',
          example: true,
          description: 'Whether credentials are active',
        },
        lastUsedAt: {
          type: 'string',
          nullable: true,
          example: '2026-03-15T10:30:00.000Z',
          description: 'Last time credentials were used',
        },
        createdAt: {
          type: 'string',
          example: '2026-03-10T08:00:00.000Z',
          description: 'When credentials were created',
        },
        webhookUrl: {
          type: 'string',
          example: 'https://api.incollabe.com/webhooks/hype-store/hs_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
          description: 'Unified webhook endpoint - POST with eventType in body',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store not found or credentials not configured' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWebhookCredentials(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    const credentials = await this.hypeStoreService.getWebhookCredentials(parseInt(storeId), brandId);

    // Add full webhook URL for convenience
    const baseUrl = this.configService.get<string>('API_BASE_URL') || 'https://api.incollabe.com';

    return {
      ...credentials,
      webhookUrl: `${baseUrl}/webhooks/hype-store/${credentials.apiKey}`,
    };
  }

  // ==================== Brand-Shared Coupon Endpoints ====================

  @Post(':storeId/brand-coupon')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create brand-shared coupon for store',
    description:
      'Create a brand-shared coupon code (e.g., SNITCHCOLLABKAROO) that all influencers can use with their unique referral codes for attribution.',
  })
  @ApiParam({
    name: 'storeId',
    type: Number,
    description: 'Store ID',
    example: 1,
  })
  @ApiBody({ type: CreateBrandSharedCouponDto })
  @ApiResponse({
    status: 201,
    description: 'Brand-shared coupon created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            couponCode: { type: 'string', example: 'SNITCHCOLLABKAROO' },
            hypeStoreId: { type: 'number', example: 1 },
            storeName: { type: 'string', example: 'Snitch Store' },
            isBrandShared: { type: 'boolean', example: true },
            isActive: { type: 'boolean', example: true },
            totalUses: { type: 'number', example: 0 },
            createdAt: { type: 'string', example: '2026-03-11T10:00:00Z' },
          },
        },
        message: {
          type: 'string',
          example: 'Brand-shared coupon SNITCHCOLLABKAROO created successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Coupon code already exists or store already has a brand-shared coupon',
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createBrandSharedCoupon(
    @Request() req: any,
    @Param('storeId') storeId: string,
    @Body() dto: CreateBrandSharedCouponDto,
  ) {
    const brandId = req.user.id;
    return this.hypeStoreService.createBrandSharedCoupon(
      parseInt(storeId),
      brandId,
      dto.couponCode,
      dto.description,
    );
  }

  @Get(':storeId/brand-coupon')
  @ApiOperation({
    summary: 'Get brand-shared coupon for store',
    description: 'Get the brand-shared coupon details including usage stats',
  })
  @ApiParam({
    name: 'storeId',
    type: Number,
    description: 'Store ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Brand-shared coupon details',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            couponCode: { type: 'string', example: 'SNITCHCOLLABKAROO' },
            hypeStoreId: { type: 'number', example: 1 },
            storeName: { type: 'string', example: 'Snitch Store' },
            isBrandShared: { type: 'boolean', example: true },
            isActive: { type: 'boolean', example: true },
            totalUses: { type: 'number', example: 145 },
            influencersUsingCount: { type: 'number', example: 23 },
            createdAt: { type: 'string', example: '2026-03-11T10:00:00Z' },
          },
        },
        message: { type: 'string', example: 'Brand-shared coupon details' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBrandSharedCoupon(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.getBrandSharedCoupon(parseInt(storeId), brandId);
  }

  @Put(':storeId/brand-coupon/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate brand-shared coupon',
    description: 'Deactivate the brand-shared coupon for this store',
  })
  @ApiParam({
    name: 'storeId',
    type: Number,
    description: 'Store ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Brand-shared coupon deactivated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Brand-shared coupon SNITCHCOLLABKAROO has been deactivated',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Store or coupon not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deactivateBrandSharedCoupon(@Request() req: any, @Param('storeId') storeId: string) {
    const brandId = req.user.id;
    return this.hypeStoreService.deactivateBrandSharedCoupon(parseInt(storeId), brandId);
  }
}
