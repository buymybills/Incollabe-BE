import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { MaxCampaignInvoice, InvoiceStatus } from '../../campaign/models/max-campaign-invoice.model';
import { InviteOnlyCampaignInvoice } from '../../campaign/models/invite-only-campaign-invoice.model';
import { Campaign } from '../../campaign/models/campaign.model';
import { Brand } from '../../brand/model/brand.model';
import {
  MaxSubscriptionBrandStatisticsDto,
  GetMaxPurchasesDto,
  MaxPurchasesResponseDto,
  MaxPurchaseItemDto,
  MaxPurchaseTypeFilter,
  MaxCampaignStatusFilter,
} from '../dto/max-subscription-brand.dto';

@Injectable()
export class MaxSubscriptionBrandService {
  constructor(
    @InjectModel(MaxCampaignInvoice)
    private readonly maxCampaignInvoiceModel: typeof MaxCampaignInvoice,
    @InjectModel(InviteOnlyCampaignInvoice)
    private readonly inviteOnlyCampaignInvoiceModel: typeof InviteOnlyCampaignInvoice,
  ) {}

  /**
   * Get Max Subscription Brand statistics with month-over-month growth
   */
  async getStatistics(): Promise<MaxSubscriptionBrandStatisticsDto> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Total Maxx Profile (all paid max campaign invoices)
    const totalMaxxProfile = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
    });

    const lastMonthTotalMaxxProfile = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
    });

    const totalMaxxProfileGrowth = this.calculateGrowth(
      totalMaxxProfile,
      lastMonthTotalMaxxProfile,
    );

    // 2. Active Maxx Profiles (campaigns that are active)
    const activeMaxxProfiles = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: 'active',
          },
          required: true,
        },
      ],
    });

    const lastMonthActiveMaxxProfiles = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: 'active',
          },
          required: true,
        },
      ],
    });

    const activeMaxxProfilesGrowth = this.calculateGrowth(
      activeMaxxProfiles,
      lastMonthActiveMaxxProfiles,
    );

    // 3. Inactive Maxx Profiles (campaigns that are completed/paused)
    const inactiveMaxxProfiles = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: {
              [Op.in]: ['completed', 'paused'],
            },
          },
          required: true,
        },
      ],
    });

    const lastMonthInactiveMaxxProfiles = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: {
              [Op.in]: ['completed', 'paused'],
            },
          },
          required: true,
        },
      ],
    });

    const inactiveMaxxProfilesGrowth = this.calculateGrowth(
      inactiveMaxxProfiles,
      lastMonthInactiveMaxxProfiles,
    );

    // 4. Subscription Cancelled (campaigns that are cancelled)
    const subscriptionCancelled = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: 'cancelled',
          },
          required: true,
        },
      ],
    });

    const lastMonthSubscriptionCancelled = await this.maxCampaignInvoiceModel.count({
      where: {
        paymentStatus: InvoiceStatus.PAID,
        createdAt: {
          [Op.lt]: currentMonthStart,
        },
      },
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: {
            isMaxCampaign: true,
            status: 'cancelled',
          },
          required: true,
        },
      ],
    });

    const subscriptionCancelledGrowth = this.calculateGrowth(
      subscriptionCancelled,
      lastMonthSubscriptionCancelled,
    );

    return {
      totalMaxxProfile,
      totalMaxxProfileGrowth,
      activeMaxxProfiles,
      activeMaxxProfilesGrowth,
      inactiveMaxxProfiles,
      inactiveMaxxProfilesGrowth,
      subscriptionCancelled,
      subscriptionCancelledGrowth,
    };
  }

  /**
   * Get paginated list of max campaign purchases with filters
   */
  async getMaxPurchases(
    filters: GetMaxPurchasesDto,
  ): Promise<MaxPurchasesResponseDto> {
    const {
      page = 1,
      limit = 20,
      purchaseType,
      status,
      search,
      startDate,
      endDate,
      paymentMethod,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = filters;

    let allInvoices: MaxPurchaseItemDto[] = [];

    // Fetch invite-only campaign invoices if needed
    if (!purchaseType || purchaseType === MaxPurchaseTypeFilter.ALL || purchaseType === MaxPurchaseTypeFilter.INVITE_CAMPAIGN) {
      const inviteOnlyInvoices = await this.getInviteOnlyPurchases({
        search,
        startDate,
        endDate,
        paymentMethod,
        status,
      });
      allInvoices = [...allInvoices, ...inviteOnlyInvoices];
    }

    // Fetch max campaign invoices if needed
    if (!purchaseType || purchaseType === MaxPurchaseTypeFilter.ALL || purchaseType === MaxPurchaseTypeFilter.MAXX_CAMPAIGN) {
      const maxCampaignInvoices = await this.getMaxCampaignPurchases({
        search,
        startDate,
        endDate,
        paymentMethod,
        status,
      });
      allInvoices = [...allInvoices, ...maxCampaignInvoices];
    }

    // Sort combined results
    allInvoices.sort((a, b) => {
      if (sortBy === 'amount') {
        return sortOrder === 'ASC' ? a.amount - b.amount : b.amount - a.amount;
      }
      // Sort by date (parse purchaseDateTime)
      const dateA = new Date(a.purchaseDateTime.split(' | ')[1]);
      const dateB = new Date(b.purchaseDateTime.split(' | ')[1]);
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
   * Get invite-only campaign purchases
   */
  private async getInviteOnlyPurchases(filters: {
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    status?: MaxCampaignStatusFilter;
  }): Promise<MaxPurchaseItemDto[]> {
    const { search, startDate, endDate, paymentMethod, status } = filters;

    // Build where clause for invoices
    const invoiceWhereClause: any = {
      paymentStatus: 'paid',
    };

    // Date filtering
    if (startDate || endDate) {
      invoiceWhereClause.paidAt = {};
      if (startDate) {
        invoiceWhereClause.paidAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        invoiceWhereClause.paidAt[Op.lte] = endDateTime;
      }
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      if (paymentMethod === 'upi') {
        invoiceWhereClause.paymentMethod = { [Op.iLike]: '%upi%' };
      } else if (paymentMethod === 'credit_card') {
        invoiceWhereClause.paymentMethod = {
          [Op.or]: [
            { [Op.iLike]: '%card%' },
            { [Op.iLike]: '%credit%' },
          ],
        };
      } else if (paymentMethod === 'razorpay') {
        invoiceWhereClause.paymentMethod = { [Op.iLike]: '%razorpay%' };
      }
    }

    // Build where clause for campaigns
    const campaignWhereClause: any = {};

    // Status filter for campaigns
    if (status && status !== MaxCampaignStatusFilter.ALL) {
      if (status === MaxCampaignStatusFilter.ACTIVE) {
        campaignWhereClause.status = 'active';
      } else if (status === MaxCampaignStatusFilter.INACTIVE) {
        campaignWhereClause.status = {
          [Op.in]: ['completed', 'paused'],
        };
      } else if (status === MaxCampaignStatusFilter.CANCELLED) {
        campaignWhereClause.status = 'cancelled';
      }
    }

    const invoices = await this.inviteOnlyCampaignInvoiceModel.findAll({
      where: invoiceWhereClause,
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: Object.keys(campaignWhereClause).length > 0
            ? campaignWhereClause
            : undefined,
          attributes: ['id', 'name', 'status', 'createdAt'],
          required: true,
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brandName', 'username'],
          required: true,
        },
      ],
      order: [['paidAt', 'DESC']],
      subQuery: false,
    });

    // Calculate search priority helper function
    // Prioritizes matches by field (brand name first, then username, then campaign name), then by position
    const calculateSearchPriority = (
      brandName: string,
      username: string,
      campaignName: string,
      searchTerm: string,
    ): number => {
      if (!searchTerm) return 0;

      const lowerSearchTerm = searchTerm.toLowerCase();
      const lowerBrandName = brandName.toLowerCase();
      const lowerUsername = username.toLowerCase();
      const lowerCampaignName = campaignName.toLowerCase();

      const brandNameIndex = lowerBrandName.indexOf(lowerSearchTerm);
      const usernameIndex = lowerUsername.indexOf(lowerSearchTerm);
      const campaignNameIndex = lowerCampaignName.indexOf(lowerSearchTerm);

      // Priority tiers:
      // 1000-1999: Match in brand name
      // 2000-2999: Match in username
      // 3000-3999: Match in campaign name
      // 9999: No match

      if (brandNameIndex >= 0) {
        return 1000 + brandNameIndex;
      } else if (usernameIndex >= 0) {
        return 2000 + usernameIndex;
      } else if (campaignNameIndex >= 0) {
        return 3000 + campaignNameIndex;
      }

      return 9999;
    };

    const mappedInvoices = invoices
      .filter((invoice) => invoice.campaign && invoice.brand)
      .map((invoice) => {
        const campaign = invoice.campaign;
        const brand = invoice.brand;

        // Format date as "HH:MM AM/PM | MMM DD, YYYY" in IST
        const purchaseDate = new Date(invoice.paidAt);
        const time = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        }).format(purchaseDate);

        const date = new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        }).format(purchaseDate);

        const purchaseDateTime = `${time} | ${date}`;

        // Calculate search priority
        const searchPriority = calculateSearchPriority(
          brand.brandName,
          brand.username,
          campaign.name,
          search || '',
        );

        return {
          id: invoice.id,
          campaignId: campaign.id,
          brandName: brand.brandName,
          username: `@${brand.username}`,
          campaignName: campaign.name,
          maxxType: 'Invite Campaign',
          amount: invoice.totalAmount / 100, // Convert from paise to Rs
          purchaseDateTime,
          status: campaign.status,
          invoiceNumber: invoice.invoiceNumber,
          paymentMethod: invoice.paymentMethod || 'razorpay',
          searchPriority,
        };
      })
      .filter((item) => {
        // Filter by search if provided
        if (!search) return true;
        return item.searchPriority < 9999;
      });

    // Sort by search priority when search is active
    if (search) {
      mappedInvoices.sort((a, b) => a.searchPriority - b.searchPriority);
    }

    // Remove searchPriority from response
    return mappedInvoices.map(({ searchPriority, ...item }) => item);
  }

  /**
   * Get max campaign purchases (existing logic)
   */
  private async getMaxCampaignPurchases(filters: {
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    status?: MaxCampaignStatusFilter;
  }): Promise<MaxPurchaseItemDto[]> {
    const { search, startDate, endDate, paymentMethod, status } = filters;

    // Build where clause for invoices
    const invoiceWhereClause: any = {
      paymentStatus: InvoiceStatus.PAID,
    };

    // Date filtering
    if (startDate || endDate) {
      invoiceWhereClause.paidAt = {};
      if (startDate) {
        invoiceWhereClause.paidAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        invoiceWhereClause.paidAt[Op.lte] = endDateTime;
      }
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      if (paymentMethod === 'upi') {
        invoiceWhereClause.paymentMethod = { [Op.iLike]: '%upi%' };
      } else if (paymentMethod === 'credit_card') {
        invoiceWhereClause.paymentMethod = {
          [Op.or]: [
            { [Op.iLike]: '%card%' },
            { [Op.iLike]: '%credit%' },
          ],
        };
      } else if (paymentMethod === 'razorpay') {
        invoiceWhereClause.paymentMethod = { [Op.iLike]: '%razorpay%' };
      }
    }

    // Build where clause for campaigns
    const campaignWhereClause: any = {
      isMaxCampaign: true,
    };

    // Status filter
    if (status && status !== MaxCampaignStatusFilter.ALL) {
      if (status === MaxCampaignStatusFilter.ACTIVE) {
        campaignWhereClause.status = 'active';
      } else if (status === MaxCampaignStatusFilter.INACTIVE) {
        campaignWhereClause.status = {
          [Op.in]: ['completed', 'paused'],
        };
      } else if (status === MaxCampaignStatusFilter.CANCELLED) {
        campaignWhereClause.status = 'cancelled';
      }
    }

    // Get invoices with related campaign and brand details
    const invoices = await this.maxCampaignInvoiceModel.findAll({
      where: invoiceWhereClause,
      include: [
        {
          model: Campaign,
          as: 'campaign',
          where: Object.keys(campaignWhereClause).length > 1 // > 1 because isMaxCampaign is always there
            ? campaignWhereClause
            : undefined,
          attributes: ['id', 'name', 'status', 'createdAt'],
          required: true,
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brandName', 'username'],
          required: true,
        },
      ],
      order: [['paidAt', 'DESC']],
      subQuery: false,
    });

    // Calculate search priority helper function
    // Prioritizes matches by field (brand name first, then username, then campaign name), then by position
    const calculateSearchPriority = (
      brandName: string,
      username: string,
      campaignName: string,
      searchTerm: string,
    ): number => {
      if (!searchTerm) return 0;

      const lowerSearchTerm = searchTerm.toLowerCase();
      const lowerBrandName = brandName.toLowerCase();
      const lowerUsername = username.toLowerCase();
      const lowerCampaignName = campaignName.toLowerCase();

      const brandNameIndex = lowerBrandName.indexOf(lowerSearchTerm);
      const usernameIndex = lowerUsername.indexOf(lowerSearchTerm);
      const campaignNameIndex = lowerCampaignName.indexOf(lowerSearchTerm);

      // Priority tiers:
      // 1000-1999: Match in brand name
      // 2000-2999: Match in username
      // 3000-3999: Match in campaign name
      // 9999: No match

      if (brandNameIndex >= 0) {
        return 1000 + brandNameIndex;
      } else if (usernameIndex >= 0) {
        return 2000 + usernameIndex;
      } else if (campaignNameIndex >= 0) {
        return 3000 + campaignNameIndex;
      }

      return 9999;
    };

    const mappedInvoices = invoices.map((invoice) => {
      const campaign = invoice.campaign;
      const brand = invoice.brand;

      // Format date as "HH:MM AM/PM | MMM DD, YYYY" in IST
      const purchaseDate = new Date(invoice.paidAt);
      const time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      }).format(purchaseDate);

      const date = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(purchaseDate);

      const purchaseDateTime = `${time} | ${date}`;

      // Calculate search priority
      const searchPriority = calculateSearchPriority(
        brand.brandName,
        brand.username,
        campaign.name,
        search || '',
      );

      return {
        id: invoice.id,
        campaignId: campaign.id,
        brandName: brand.brandName,
        username: `@${brand.username}`,
        campaignName: campaign.name,
        maxxType: 'Maxx Campaign',
        amount: invoice.amount / 100, // Convert from paise to Rs
        purchaseDateTime,
        status: campaign.status,
        invoiceNumber: invoice.invoiceNumber,
        paymentMethod: invoice.paymentMethod || 'razorpay',
        searchPriority,
      };
    })
    .filter((item) => {
      // Filter by search if provided
      if (!search) return true;
      return item.searchPriority < 9999;
    });

    // Sort by search priority when search is active
    if (search) {
      mappedInvoices.sort((a, b) => a.searchPriority - b.searchPriority);
    }

    // Remove searchPriority from response
    return mappedInvoices.map(({ searchPriority, ...item }) => item);
  }

  /**
   * Helper function to calculate growth percentage
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const growth = ((current - previous) / previous) * 100;
    return Math.round(growth * 10) / 10; // Round to 1 decimal place
  }
}
