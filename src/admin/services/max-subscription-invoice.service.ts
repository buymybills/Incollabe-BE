import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { MaxxSubscriptionAdminService } from './maxx-subscription-admin.service';
import { MaxSubscriptionBrandService } from './max-subscription-brand.service';
import { ProSubscription } from '../../influencer/models/pro-subscription.model';
import { ProInvoice } from '../../influencer/models/pro-invoice.model';
import { MaxCampaignInvoice } from '../../campaign/models/max-campaign-invoice.model';
import { InviteOnlyCampaignInvoice } from '../../campaign/models/invite-only-campaign-invoice.model';
import { Campaign } from '../../campaign/models/campaign.model';
import { Brand } from '../../brand/model/brand.model';
import { Influencer } from '../../auth/model/influencer.model';
import {
  MaxSubscriptionInvoiceStatisticsDto,
  GetMaxSubscriptionInvoicesDto,
  MaxSubscriptionInvoicesResponseDto,
  MaxSubscriptionInvoiceItemDto,
  InvoiceTypeFilter,
} from '../dto/max-subscription-invoice.dto';
import { MaxPurchaseTypeFilter } from '../dto/max-subscription-brand.dto';

@Injectable()
export class MaxSubscriptionInvoiceService {
  constructor(
    @InjectModel(ProSubscription)
    private readonly proSubscriptionModel: typeof ProSubscription,
    @InjectModel(ProInvoice)
    private readonly proInvoiceModel: typeof ProInvoice,
    @InjectModel(MaxCampaignInvoice)
    private readonly maxCampaignInvoiceModel: typeof MaxCampaignInvoice,
    @InjectModel(InviteOnlyCampaignInvoice)
    private readonly inviteOnlyCampaignInvoiceModel: typeof InviteOnlyCampaignInvoice,
    private readonly maxxSubscriptionAdminService: MaxxSubscriptionAdminService,
    private readonly maxSubscriptionBrandService: MaxSubscriptionBrandService,
  ) {}

  /**
   * Get unified statistics combining influencer subscriptions and brand campaigns
   */
  async getUnifiedStatistics(): Promise<MaxSubscriptionInvoiceStatisticsDto> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get influencer Pro subscription stats
    const influencerStats = await this.maxxSubscriptionAdminService.getMaxxSubscriptionStatistics();

    // Get brand max campaign stats
    const brandStats = await this.maxSubscriptionBrandService.getStatistics();

    // Calculate totals
    const totalMaxxPurchased =
      influencerStats.activeMaxxProfiles +
      brandStats.totalMaxxProfile;

    // Calculate last month totals for growth
    const lastMonthInfluencerCount = await this.proSubscriptionModel.count({
      where: {
        status: 'active',
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });

    const lastMonthBrandCount = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: 'paid',
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });

    const lastMonthTotal = lastMonthInfluencerCount + lastMonthBrandCount;
    const totalMaxxPurchasedGrowth = this.calculateGrowth(totalMaxxPurchased, lastMonthTotal);

    // Get brand campaign type counts
    const inviteCampaignCount = await this.getBrandCampaignCountByType('invite_campaign');
    const maxxCampaignCount = await this.getBrandCampaignCountByType('maxx_campaign');

    // Calculate growth for each type
    const lastMonthInviteCampaign = await this.getBrandCampaignCountByType('invite_campaign', currentMonthStart);
    const lastMonthMaxxCampaign = await this.getBrandCampaignCountByType('maxx_campaign', currentMonthStart);

    return {
      totalMaxxPurchased,
      totalMaxxPurchasedGrowth,
      maxxSubscription: influencerStats.activeMaxxProfiles,
      maxxSubscriptionGrowth: influencerStats.activeMaxxProfilesGrowth || 0,
      inviteCampaign: inviteCampaignCount,
      inviteCampaignGrowth: this.calculateGrowth(inviteCampaignCount, lastMonthInviteCampaign),
      maxxCampaign: maxxCampaignCount,
      maxxCampaignGrowth: this.calculateGrowth(maxxCampaignCount, lastMonthMaxxCampaign),
    };
  }

  /**
   * Get unified list of invoices from both influencer subscriptions and brand campaigns
   */
  async getUnifiedInvoices(
    filters: GetMaxSubscriptionInvoicesDto,
  ): Promise<MaxSubscriptionInvoicesResponseDto> {
    const {
      page = 1,
      limit = 20,
      invoiceType,
      search,
      startDate,
      endDate,
      profileType,
      paymentMethod,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    let influencerInvoices: MaxSubscriptionInvoiceItemDto[] = [];
    let brandInvoices: MaxSubscriptionInvoiceItemDto[] = [];

    // Fetch influencer subscription invoices if needed
    // Skip if profileType filter is set to 'brand' only
    const shouldFetchInfluencerInvoices =
      (!invoiceType || invoiceType === InvoiceTypeFilter.ALL || invoiceType === InvoiceTypeFilter.MAXX_SUBSCRIPTION) &&
      (!profileType || profileType === 'all' || profileType === 'influencer');

    if (shouldFetchInfluencerInvoices) {
      influencerInvoices = await this.getInfluencerSubscriptionInvoices(search, startDate, endDate, paymentMethod);
    }

    // Fetch brand campaign invoices if needed
    // Skip if profileType filter is set to 'influencer' only
    const shouldFetchBrandInvoices =
      (!invoiceType || invoiceType === InvoiceTypeFilter.ALL ||
        invoiceType === InvoiceTypeFilter.INVITE_CAMPAIGN ||
        invoiceType === InvoiceTypeFilter.MAXX_CAMPAIGN) &&
      (!profileType || profileType === 'all' || profileType === 'brand');

    if (shouldFetchBrandInvoices) {
      brandInvoices = await this.getBrandCampaignInvoices(search, startDate, endDate, invoiceType, paymentMethod);
    }

    // Combine and sort all invoices
    let allInvoices = [...influencerInvoices, ...brandInvoices];

    // Sort by specified field
    allInvoices.sort((a, b) => {
      if (sortBy === 'amount') {
        return sortOrder === 'ASC' ? a.amount - b.amount : b.amount - a.amount;
      }
      // Sort by date (parse purchaseDateTime)
      const dateA = new Date(a.purchaseDateTime);
      const dateB = new Date(b.purchaseDateTime);
      return sortOrder === 'ASC' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });

    // Paginate
    const total = allInvoices.length;
    const offset = (page - 1) * limit;
    const paginatedInvoices = allInvoices.slice(offset, offset + limit);

    return {
      data: paginatedInvoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get influencer Pro subscription invoices
   */
  private async getInfluencerSubscriptionInvoices(
    search?: string,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<MaxSubscriptionInvoiceItemDto[]> {
    const whereClause: any = {
      paymentStatus: 'paid',
    };

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      if (paymentMethod === 'upi') {
        whereClause.paymentMethod = { [Op.iLike]: '%upi%' };
      } else if (paymentMethod === 'credit_card') {
        whereClause.paymentMethod = { [Op.or]: [
          { [Op.iLike]: '%card%' },
          { [Op.iLike]: '%credit%' },
        ]};
      } else if (paymentMethod === 'razorpay') {
        whereClause.paymentMethod = { [Op.iLike]: '%razorpay%' };
      }
    }

    // Date filtering
    if (startDate || endDate) {
      whereClause.paidAt = {};
      if (startDate) {
        whereClause.paidAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.paidAt[Op.lte] = endDateTime;
      }
    }

    const invoices = await this.proInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          association: 'subscription',
          required: true,
          include: [
            {
              association: 'influencer',
              required: true,
              where: search
                ? {
                    [Op.or]: [
                      { name: { [Op.iLike]: `%${search}%` } },
                      { username: { [Op.iLike]: `%${search}%` } },
                    ],
                  }
                : undefined,
            },
          ],
        },
      ],
      order: [['paidAt', 'DESC']],
    });

    return invoices
      .filter((invoice) => invoice.subscription?.influencer)
      .map((invoice) => {
        const influencer = invoice.subscription.influencer;
        const paidAt = new Date(invoice.paidAt);

        const time = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(paidAt);

        const date = new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }).format(paidAt);

        return {
          id: invoice.id,
          profileName: influencer.name,
          username: `@${influencer.username}`,
          profileType: 'Influencer',
          maxxType: 'Subscription',
          amount: invoice.amount / 100, // Convert from paise to Rs
          transactionId: invoice.razorpayPaymentId || invoice.invoiceNumber,
          paymentMethod: this.formatPaymentMethod(invoice.paymentMethod),
          purchaseDateTime: `${time} | ${date}`,
        };
      });
  }

  /**
   * Get brand Max campaign invoices
   */
  private async getBrandCampaignInvoices(
    search?: string,
    startDate?: string,
    endDate?: string,
    invoiceType?: InvoiceTypeFilter,
    paymentMethod?: string,
  ): Promise<MaxSubscriptionInvoiceItemDto[]> {
    let invoices: MaxSubscriptionInvoiceItemDto[] = [];

    // Fetch invite-only campaign invoices
    if (!invoiceType || invoiceType === InvoiceTypeFilter.ALL || invoiceType === InvoiceTypeFilter.INVITE_CAMPAIGN) {
      const inviteOnlyInvoices = await this.getInviteOnlyCampaignInvoices(search, startDate, endDate, paymentMethod);
      invoices = [...invoices, ...inviteOnlyInvoices];
    }

    // Fetch max campaign invoices
    if (!invoiceType || invoiceType === InvoiceTypeFilter.ALL || invoiceType === InvoiceTypeFilter.MAXX_CAMPAIGN) {
      const result = await this.maxSubscriptionBrandService.getMaxPurchases({
        page: 1,
        limit: 10000, // Get all for now, we'll paginate later
        search,
        startDate,
        endDate,
        purchaseType: MaxPurchaseTypeFilter.MAXX_CAMPAIGN,
        paymentMethod,
      });

      const maxCampaignInvoices = result.data.map((item) => ({
        id: item.id,
        profileName: item.brandName,
        username: item.username,
        profileType: 'Brand',
        maxxType: item.maxxType,
        amount: item.amount,
        transactionId: item.invoiceNumber,
        paymentMethod: this.formatPaymentMethod(item.paymentMethod),
        purchaseDateTime: item.purchaseDateTime,
        campaignId: item.campaignId,
        campaignName: item.campaignName,
      }));

      invoices = [...invoices, ...maxCampaignInvoices];
    }

    return invoices;
  }

  /**
   * Get invite-only campaign invoices
   */
  private async getInviteOnlyCampaignInvoices(
    search?: string,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<MaxSubscriptionInvoiceItemDto[]> {
    const whereClause: any = {
      paymentStatus: 'paid',
    };

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      if (paymentMethod === 'upi') {
        whereClause.paymentMethod = { [Op.iLike]: '%upi%' };
      } else if (paymentMethod === 'credit_card') {
        whereClause.paymentMethod = {
          [Op.or]: [
            { [Op.iLike]: '%card%' },
            { [Op.iLike]: '%credit%' },
          ],
        };
      } else if (paymentMethod === 'razorpay') {
        whereClause.paymentMethod = { [Op.iLike]: '%razorpay%' };
      }
    }

    // Date filtering
    if (startDate || endDate) {
      whereClause.paidAt = {};
      if (startDate) {
        whereClause.paidAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.paidAt[Op.lte] = endDateTime;
      }
    }

    const invoices = await this.inviteOnlyCampaignInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          association: 'campaign',
          required: true,
          where: search
            ? {
                name: { [Op.iLike]: `%${search}%` },
              }
            : undefined,
        },
        {
          association: 'brand',
          required: true,
          where: search
            ? {
                [Op.or]: [
                  { brandName: { [Op.iLike]: `%${search}%` } },
                  { username: { [Op.iLike]: `%${search}%` } },
                ],
              }
            : undefined,
        },
      ],
      order: [['paidAt', 'DESC']],
    });

    return invoices
      .filter((invoice) => invoice.campaign && invoice.brand)
      .map((invoice) => {
        const paidAt = new Date(invoice.paidAt);

        const time = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(paidAt);

        const date = new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }).format(paidAt);

        return {
          id: invoice.id,
          profileName: invoice.brand.brandName,
          username: `@${invoice.brand.username}`,
          profileType: 'Brand',
          maxxType: 'Invite Campaign',
          amount: invoice.totalAmount / 100, // Convert from paise to Rs
          transactionId: invoice.razorpayPaymentId || invoice.invoiceNumber,
          paymentMethod: this.formatPaymentMethod(invoice.paymentMethod),
          purchaseDateTime: `${time} | ${date}`,
          campaignId: invoice.campaignId,
          campaignName: invoice.campaign.name,
        };
      });
  }

  /**
   * Get count of brand campaigns by type
   */
  private async getBrandCampaignCountByType(
    type: 'invite_campaign' | 'maxx_campaign',
    beforeDate?: Date,
  ): Promise<number> {
    const whereClause: any = {
      paymentStatus: 'paid',
    };

    if (beforeDate) {
      whereClause.createdAt = {
        [Op.lt]: beforeDate,
      };
    }

    if (type === 'invite_campaign') {
      return await this.inviteOnlyCampaignInvoiceModel.count({
        where: whereClause,
      });
    } else {
      return await this.maxCampaignInvoiceModel.count({
        where: whereClause,
      });
    }
  }

  /**
   * Get a single invoice by ID and type
   */
  async getInvoiceById(
    invoiceId: number,
    invoiceType: InvoiceTypeFilter,
  ): Promise<{ invoiceUrl: string; invoiceNumber: string; profileName: string } | null> {
    try {
      // Try to find in ProInvoice
      if (invoiceType === InvoiceTypeFilter.MAXX_SUBSCRIPTION) {
        const proInvoice = await this.proInvoiceModel.findOne({
          where: { id: invoiceId },
          include: [
            {
              model: ProSubscription,
              as: 'subscription',
              include: [
                {
                  model: Influencer,
                  as: 'influencer',
                  attributes: ['name', 'username'],
                },
              ],
            },
          ],
        });

        if (proInvoice && proInvoice.invoiceUrl && proInvoice.subscription?.influencer) {
          return {
            invoiceUrl: proInvoice.invoiceUrl,
            invoiceNumber: proInvoice.invoiceNumber,
            profileName: (proInvoice.subscription.influencer as any).name || 'Unknown',
          };
        }
      }

      // Try to find in InviteOnlyCampaignInvoice
      if (invoiceType === InvoiceTypeFilter.INVITE_CAMPAIGN) {
        const inviteInvoice = await this.inviteOnlyCampaignInvoiceModel.findOne({
          where: { id: invoiceId },
          include: [
            {
              model: Brand,
              as: 'brand',
              attributes: ['brandName', 'username'],
            },
            {
              model: Campaign,
              as: 'campaign',
              attributes: ['name'],
            },
          ],
        });

        if (inviteInvoice && inviteInvoice.invoiceUrl) {
          return {
            invoiceUrl: inviteInvoice.invoiceUrl,
            invoiceNumber: inviteInvoice.invoiceNumber,
            profileName: inviteInvoice.brand?.brandName || 'Unknown',
          };
        }
      }

      // Try to find in MaxCampaignInvoice
      if (invoiceType === InvoiceTypeFilter.MAXX_CAMPAIGN) {
        const maxInvoice = await this.maxCampaignInvoiceModel.findOne({
          where: { id: invoiceId },
          include: [
            {
              model: Brand,
              as: 'brand',
              attributes: ['brandName', 'username'],
            },
            {
              model: Campaign,
              as: 'campaign',
              attributes: ['name'],
            },
          ],
        });

        if (maxInvoice && maxInvoice.invoiceUrl) {
          return {
            invoiceUrl: maxInvoice.invoiceUrl,
            invoiceNumber: maxInvoice.invoiceNumber,
            profileName: maxInvoice.brand?.brandName || 'Unknown',
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      return null;
    }
  }

  /**
   * Get all invoice PDF URLs for creating a zip file
   */
  async getAllInvoicePdfUrls(
    filters: GetMaxSubscriptionInvoicesDto,
  ): Promise<Array<{ invoiceUrl: string; invoiceNumber: string; profileName: string; maxxType: string }>> {
    const invoices: Array<{ invoiceUrl: string; invoiceNumber: string; profileName: string; maxxType: string }> = [];

    const { search, startDate, endDate, invoiceType, paymentMethod } = filters;

    // Fetch influencer subscription invoices if needed
    if (
      !invoiceType ||
      invoiceType === InvoiceTypeFilter.ALL ||
      invoiceType === InvoiceTypeFilter.MAXX_SUBSCRIPTION
    ) {
      const proInvoices = await this.getInfluencerInvoicePdfUrls(search, startDate, endDate, paymentMethod);
      invoices.push(...proInvoices);
    }

    // Fetch brand campaign invoices if needed
    if (
      !invoiceType ||
      invoiceType === InvoiceTypeFilter.ALL ||
      invoiceType === InvoiceTypeFilter.INVITE_CAMPAIGN ||
      invoiceType === InvoiceTypeFilter.MAXX_CAMPAIGN
    ) {
      const brandInvoices = await this.getBrandInvoicePdfUrls(search, startDate, endDate, invoiceType, paymentMethod);
      invoices.push(...brandInvoices);
    }

    return invoices.filter((inv) => inv.invoiceUrl); // Only return invoices with PDF URLs
  }

  /**
   * Get influencer Pro subscription invoice PDF URLs
   */
  private async getInfluencerInvoicePdfUrls(
    search?: string,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<Array<{ invoiceUrl: string; invoiceNumber: string; profileName: string; maxxType: string }>> {
    const whereClause: any = {
      paymentStatus: 'paid',
    };

    if (startDate || endDate) {
      whereClause.paidAt = {};
      if (startDate) whereClause.paidAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.paidAt[Op.lte] = new Date(endDate);
    }

    if (paymentMethod) {
      whereClause.paymentMethod = paymentMethod;
    }

    const influencerWhere: any = {};
    if (search) {
      influencerWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const proInvoices = await this.proInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          model: ProSubscription,
          as: 'subscription',
          required: true,
          include: [
            {
              model: Influencer,
              as: 'influencer',
              required: true,
              where: Object.keys(influencerWhere).length > 0 ? influencerWhere : undefined,
              attributes: ['name', 'username'],
            },
          ],
        },
      ],
      attributes: ['invoiceUrl', 'invoiceNumber'],
    });

    return proInvoices
      .filter((invoice) => invoice.subscription?.influencer && invoice.invoiceUrl)
      .map((invoice) => ({
        invoiceUrl: invoice.invoiceUrl,
        invoiceNumber: invoice.invoiceNumber,
        profileName: (invoice.subscription.influencer as any).name,
        maxxType: 'Maxx Subscription',
      }));
  }

  /**
   * Get brand campaign invoice PDF URLs
   */
  private async getBrandInvoicePdfUrls(
    search?: string,
    startDate?: string,
    endDate?: string,
    invoiceType?: InvoiceTypeFilter,
    paymentMethod?: string,
  ): Promise<Array<{ invoiceUrl: string; invoiceNumber: string; profileName: string; maxxType: string }>> {
    const invoices: Array<{ invoiceUrl: string; invoiceNumber: string; profileName: string; maxxType: string }> = [];

    // Fetch invite-only campaign invoices
    if (!invoiceType || invoiceType === InvoiceTypeFilter.ALL || invoiceType === InvoiceTypeFilter.INVITE_CAMPAIGN) {
      const inviteInvoices = await this.getInviteOnlyInvoicePdfUrls(search, startDate, endDate, paymentMethod);
      invoices.push(...inviteInvoices);
    }

    // Fetch max campaign invoices
    if (!invoiceType || invoiceType === InvoiceTypeFilter.ALL || invoiceType === InvoiceTypeFilter.MAXX_CAMPAIGN) {
      const maxInvoices = await this.getMaxCampaignInvoicePdfUrls(search, startDate, endDate, paymentMethod);
      invoices.push(...maxInvoices);
    }

    return invoices;
  }

  /**
   * Get invite-only campaign invoice PDF URLs
   */
  private async getInviteOnlyInvoicePdfUrls(
    search?: string,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<Array<{ invoiceUrl: string; invoiceNumber: string; profileName: string; maxxType: string }>> {
    const whereClause: any = {
      paymentStatus: 'paid',
    };

    if (startDate || endDate) {
      whereClause.paidAt = {};
      if (startDate) whereClause.paidAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.paidAt[Op.lte] = new Date(endDate);
    }

    if (paymentMethod) {
      whereClause.paymentMethod = paymentMethod;
    }

    const brandWhere: any = {};
    if (search) {
      brandWhere[Op.or] = [
        { brandName: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const invoices = await this.inviteOnlyCampaignInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          model: Brand,
          as: 'brand',
          required: true,
          where: Object.keys(brandWhere).length > 0 ? brandWhere : undefined,
          attributes: ['brandName', 'username'],
        },
        {
          model: Campaign,
          as: 'campaign',
          required: true,
          attributes: ['name'],
        },
      ],
      attributes: ['invoiceUrl', 'invoiceNumber'],
    });

    return invoices
      .filter((invoice) => invoice.brand && invoice.invoiceUrl)
      .map((invoice) => ({
        invoiceUrl: invoice.invoiceUrl,
        invoiceNumber: invoice.invoiceNumber,
        profileName: invoice.brand.brandName,
        maxxType: 'Invite Campaign',
      }));
  }

  /**
   * Get max campaign invoice PDF URLs
   */
  private async getMaxCampaignInvoicePdfUrls(
    search?: string,
    startDate?: string,
    endDate?: string,
    paymentMethod?: string,
  ): Promise<Array<{ invoiceUrl: string; invoiceNumber: string; profileName: string; maxxType: string }>> {
    const whereClause: any = {
      paymentStatus: 'paid',
    };

    if (startDate || endDate) {
      whereClause.paidAt = {};
      if (startDate) whereClause.paidAt[Op.gte] = new Date(startDate);
      if (endDate) whereClause.paidAt[Op.lte] = new Date(endDate);
    }

    if (paymentMethod) {
      whereClause.paymentMethod = paymentMethod;
    }

    const brandWhere: any = {};
    if (search) {
      brandWhere[Op.or] = [
        { brandName: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const invoices = await this.maxCampaignInvoiceModel.findAll({
      where: whereClause,
      include: [
        {
          model: Brand,
          as: 'brand',
          required: true,
          where: Object.keys(brandWhere).length > 0 ? brandWhere : undefined,
          attributes: ['brandName', 'username'],
        },
        {
          model: Campaign,
          as: 'campaign',
          required: true,
          attributes: ['name'],
        },
      ],
      attributes: ['invoiceUrl', 'invoiceNumber'],
    });

    return invoices
      .filter((invoice) => invoice.brand && invoice.invoiceUrl)
      .map((invoice) => ({
        invoiceUrl: invoice.invoiceUrl,
        invoiceNumber: invoice.invoiceNumber,
        profileName: invoice.brand.brandName,
        maxxType: 'Maxx Campaign',
      }));
  }

  /**
   * Format payment method for display
   */
  private formatPaymentMethod(method: string): string {
    if (!method) return 'Credit Card';
    if (method.toLowerCase().includes('upi')) return 'UPI Transfer';
    if (method.toLowerCase().includes('razorpay')) return 'Credit Card';
    return method;
  }

  /**
   * Calculate growth percentage
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const growth = ((current - previous) / previous) * 100;
    return Math.round(growth * 10) / 10;
  }
}
