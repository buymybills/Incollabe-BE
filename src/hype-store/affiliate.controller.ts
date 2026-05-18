import { Controller, Get, Param, Ip, Headers, NotFoundException, Logger, Redirect } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/sequelize';
import { HypeStoreReferralCode } from '../wallet/models/hype-store-referral-code.model';
import { HypeStoreReferralClick } from '../wallet/models/hype-store-referral-click.model';
import { HypeStore } from '../wallet/models/hype-store.model';
import { Brand } from '../brand/model/brand.model';

@ApiTags('Affiliate')
@Controller('affiliate')
export class AffiliateController {
  private readonly logger = new Logger(AffiliateController.name);

  constructor(
    @InjectModel(HypeStoreReferralCode)
    private referralCodeModel: typeof HypeStoreReferralCode,
    @InjectModel(HypeStoreReferralClick)
    private referralClickModel: typeof HypeStoreReferralClick,
  ) {}

  /**
   * Public affiliate link redirect endpoint.
   * Tracks the click and redirects to the brand's store.
   * Brands should include the referral code in their webhook when a purchase is made.
   */
  @Get('r/:referralCode')
  @Redirect()
  @ApiOperation({
    summary: 'Track affiliate link click and redirect to brand store',
    description:
      'Public endpoint. Records the click for analytics, then redirects to the brand\'s website. ' +
      'The brand should pass the referral code back in their purchase webhook for cashback attribution.',
  })
  @ApiParam({ name: 'referralCode', example: 'INFL15', description: 'Influencer referral code' })
  @ApiResponse({ status: 302, description: 'Redirect to brand store URL' })
  @ApiResponse({ status: 404, description: 'Affiliate link not found or inactive' })
  async trackAndRedirect(
    @Param('referralCode') referralCode: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer: string,
  ) {
    const refCode = await this.referralCodeModel.findOne({
      where: { referralCode, isActive: true },
      include: [
        {
          model: HypeStore,
          include: [{ model: Brand }],
        },
      ],
    });

    if (!refCode) {
      throw new NotFoundException('Affiliate link not found or inactive');
    }

    const hypeStore = (refCode as any).hypeStore as HypeStore;
    const brand = (hypeStore as any)?.brand as Brand;
    const destinationUrl = brand?.websiteUrl || '';

    if (!destinationUrl) {
      this.logger.warn(`No destination URL configured for affiliate link ${referralCode} (store #${refCode.hypeStoreId})`);
      throw new NotFoundException('Brand store URL not configured. Please contact the brand.');
    }

    // Record the click asynchronously (don't block the redirect)
    this.referralClickModel
      .create({
        referralCodeId: refCode.id,
        hypeStoreId: refCode.hypeStoreId,
        influencerId: refCode.influencerId,
        customerIp: ip,
        userAgent: userAgent || null,
        referrer: referrer || null,
        clickedAt: new Date(),
        converted: false,
      } as any)
      .then(() =>
        this.referralCodeModel.increment({ totalClicks: 1 }, { where: { id: refCode.id } }),
      )
      .catch((err) => this.logger.error(`Failed to record affiliate click for ${referralCode}:`, err));

    const separator = destinationUrl.includes('?') ? '&' : '?';
    const redirectUrl = `${destinationUrl}${separator}ref=${referralCode}`;
    return { url: redirectUrl, statusCode: 302 };
  }
}
