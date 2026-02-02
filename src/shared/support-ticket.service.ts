import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  SupportTicket,
  TicketStatus,
  UserType,
  ReportType,
} from './models/support-ticket.model';
import {
  SupportTicketReply,
  ReplyAuthorType,
} from './models/support-ticket-reply.model';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { GetSupportTicketsDto } from './dto/get-support-tickets.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { SupportTicketCreationDto } from './dto/support-ticket-creation.dto';
import { CreateTicketReplyDto } from './dto/create-ticket-reply.dto';
import { Influencer } from '../auth/model/influencer.model';
import { Brand } from '../brand/model/brand.model';
import { Admin } from '../admin/models/admin.model';
import { Op, CreationAttributes } from 'sequelize';
import { ReportedUserDto } from './types/support-ticket.types';
import { EncryptionService } from './services/encryption.service';

@Injectable()
export class SupportTicketService {
  constructor(
    @InjectModel(SupportTicket)
    private supportTicketModel: typeof SupportTicket,
    @InjectModel(SupportTicketReply)
    private supportTicketReplyModel: typeof SupportTicketReply,
    @InjectModel(Influencer)
    private influencerModel: typeof Influencer,
    @InjectModel(Brand)
    private brandModel: typeof Brand,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create a support ticket (for influencers and brands)
   */
  async createTicket(
    createDto: CreateSupportTicketDto,
    userId: number,
    userType: UserType,
  ) {
    // Validate reported user if provided
    if (createDto.reportedUserId && createDto.reportedUserType) {
      const reportedUserExists = await this.validateUser(
        createDto.reportedUserId,
        createDto.reportedUserType,
      );
      if (!reportedUserExists) {
        throw new BadRequestException('Reported user not found');
      }
    }

    // Create ticket - build the creation attributes object
    const creationDto = new SupportTicketCreationDto();
    creationDto.userType = userType;
    creationDto.subject = createDto.subject;
    creationDto.description = createDto.description;
    creationDto.reportType = createDto.reportType;
    creationDto.status = TicketStatus.UNRESOLVED;

    if (userType === UserType.INFLUENCER) {
      creationDto.influencerId = userId;
    } else {
      creationDto.brandId = userId;
    }

    if (createDto.reportedUserType) {
      creationDto.reportedUserType = createDto.reportedUserType;
    }

    if (createDto.reportedUserId) {
      creationDto.reportedUserId = createDto.reportedUserId;
    }

    if (createDto.imageUrls && createDto.imageUrls.length > 0) {
      creationDto.imageUrls = createDto.imageUrls;
    }

    const ticket = await this.supportTicketModel.create(
      creationDto as CreationAttributes<SupportTicket>,
    );

    return {
      message: 'Support ticket created successfully',
      ticketId: ticket.id,
      status: ticket.status,
      createdAt: ticket.createdAt,
    };
  }

  /**
   * Get tickets for a specific user (influencer or brand)
   */
  async getMyTickets(
    userId: number,
    userType: UserType,
    filters: {
      status?: TicketStatus;
      reportType?: ReportType;
      searchQuery?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const {
      status,
      reportType,
      searchQuery,
      page = 1,
      limit = 20,
    } = filters;

    const whereClause: any = { userType };

    // User-specific filter
    if (userType === UserType.INFLUENCER) {
      whereClause.influencerId = userId;
    } else {
      whereClause.brandId = userId;
    }

    // Status filter
    if (status) {
      whereClause.status = status;
    }

    // Report type filter
    if (reportType) {
      whereClause.reportType = reportType;
    }

    // Search query (subject and description)
    if (searchQuery && searchQuery.trim()) {
      whereClause[Op.or] = [
        { subject: { [Op.iLike]: `%${searchQuery.trim()}%` } },
        { description: { [Op.iLike]: `%${searchQuery.trim()}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { rows: tickets, count: total } =
      await this.supportTicketModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Admin,
            as: 'assignedAdmin',
            attributes: ['id', 'name', 'email'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

    return {
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        description: ticket.description,
        reportType: ticket.reportType,
        status: ticket.status,
        resolution: ticket.resolution,
        resolvedAt: ticket.resolvedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        assignedAdmin: ticket.assignedAdmin
          ? {
              id: ticket.assignedAdmin.id,
              name: ticket.assignedAdmin.name,
            }
          : null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all tickets (admin only) with filters
   */
  async getAllTickets(filters: GetSupportTicketsDto) {
    const {
      status,
      reportType,
      userType,
      searchQuery,
      page = 1,
      limit = 20,
    } = filters;

    const whereClause: any = {};

    if (status) whereClause.status = status;
    if (reportType) whereClause.reportType = reportType;
    if (userType) whereClause.userType = userType;

    if (searchQuery && searchQuery.trim()) {
      whereClause[Op.or] = [
        { subject: { [Op.iLike]: `%${searchQuery.trim()}%` } },
        { description: { [Op.iLike]: `%${searchQuery.trim()}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { rows: tickets, count: total } =
      await this.supportTicketModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Influencer,
            as: 'influencer',
            attributes: [
              'id',
              'name',
              'username',
              'phone',
              'whatsappNumber',
              'profileImage',
            ],
          },
          {
            model: Brand,
            as: 'brand',
            attributes: [
              'id',
              'brandName',
              'username',
              'email',
              'pocContactNumber',
              'profileImage',
            ],
          },
          {
            model: Admin,
            as: 'assignedAdmin',
            attributes: ['id', 'name', 'email'],
          },
        ],
        order: [
          ['createdAt', 'DESC'], // Newest first
        ],
        limit,
        offset,
      });

    return {
      tickets: tickets.map((ticket) => this.formatTicketResponse(ticket)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        unresolvedTickets: await this.supportTicketModel.count({
          where: { status: TicketStatus.UNRESOLVED },
        }),
        resolvedTickets: await this.supportTicketModel.count({
          where: { status: TicketStatus.RESOLVED },
        }),
      },
    };
  }

  /**
   * Get single ticket details (admin only)
   */
  async getTicketById(ticketId: number) {
    const ticket = await this.supportTicketModel.findByPk(ticketId, {
      include: [
        {
          model: Influencer,
          as: 'influencer',
          attributes: [
            'id',
            'name',
            'username',
            'phone',
            'whatsappNumber',
            'profileImage',
          ],
        },
        {
          model: Brand,
          as: 'brand',
          attributes: [
            'id',
            'brandName',
            'username',
            'email',
            'pocContactNumber',
            'profileImage',
          ],
        },
        {
          model: Admin,
          as: 'assignedAdmin',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    // Get reported user details if exists
    let reportedUser: ReportedUserDto = null;
    if (ticket.reportedUserId && ticket.reportedUserType) {
      if (ticket.reportedUserType === UserType.INFLUENCER) {
        const influencer = await this.influencerModel.findByPk(
          ticket.reportedUserId,
          {
            attributes: [
              'id',
              'name',
              'username',
              'phone',
              'whatsappNumber',
              'profileImage',
            ],
          },
        );
        if (influencer) {
          reportedUser = {
            userType: UserType.INFLUENCER,
            id: influencer.id,
            name: influencer.name,
            username: influencer.username,
            phone: influencer.phone ? this.encryptionService.decrypt(influencer.phone) : undefined,
            whatsappNumber: influencer.whatsappNumber,
            profileImage: influencer.profileImage,
          };
        }
      } else {
        const brand = await this.brandModel.findByPk(ticket.reportedUserId, {
          attributes: [
            'id',
            'brandName',
            'username',
            'email',
            'pocContactNumber',
            'profileImage',
          ],
        });
        if (brand) {
          reportedUser = {
            userType: UserType.BRAND,
            id: brand.id,
            name: brand.brandName,
            username: brand.username,
            email: brand.email,
            pocContactNumber: brand.pocContactNumber ? this.encryptionService.decrypt(brand.pocContactNumber) : undefined,
            profileImage: brand.profileImage,
          };
        }
      }
    }

    return {
      ...this.formatTicketResponse(ticket),
      reportedUser,
      adminNotes: ticket.adminNotes,
    };
  }

  /**
   * Update ticket (admin only)
   */
  async updateTicket(
    ticketId: number,
    updateDto: UpdateSupportTicketDto,
    adminId: number,
  ) {
    const ticket = await this.supportTicketModel.findByPk(ticketId);

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const updateData: any = {};

    if (updateDto.status) {
      updateData.status = updateDto.status;

      // If marking as resolved, set resolvedAt
      if (updateDto.status === TicketStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
      }
    }

    if (updateDto.adminNotes) {
      updateData.adminNotes = updateDto.adminNotes;
    }

    if (updateDto.resolution) {
      updateData.resolution = updateDto.resolution;
    }

    // Assign admin if not already assigned
    if (!ticket.assignedToAdminId) {
      updateData.assignedToAdminId = adminId;
    }

    await ticket.update(updateData);

    return {
      message: 'Support ticket updated successfully',
      ticket: await this.getTicketById(ticketId),
    };
  }

  /**
   * Delete ticket (admin only)
   */
  async deleteTicket(ticketId: number) {
    const ticket = await this.supportTicketModel.findByPk(ticketId);

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    await ticket.destroy();

    return {
      message: 'Support ticket deleted successfully',
      ticketId,
    };
  }

  /**
   * Get ticket statistics (admin dashboard)
   */
  async getTicketStatistics() {
    const total = await this.supportTicketModel.count();
    const unresolved = await this.supportTicketModel.count({
      where: { status: TicketStatus.UNRESOLVED },
    });
    const resolved = await this.supportTicketModel.count({
      where: { status: TicketStatus.RESOLVED },
    });

    const byType = await Promise.all(
      Object.values(ReportType).map(async (type) => ({
        type,
        count: await this.supportTicketModel.count({
          where: { reportType: type },
        }),
      })),
    );

    return {
      total,
      byStatus: {
        unresolved,
        resolved,
      },
      byType,
    };
  }

  /**
   * Create a reply to a support ticket
   * Can be called by admin, or by the ticket creator (influencer/brand)
   */
  async createReply(
    ticketId: number,
    replyDto: CreateTicketReplyDto,
    userId: number,
    userType: 'admin' | 'influencer' | 'brand',
  ) {
    const ticket = await this.supportTicketModel.findByPk(ticketId);

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const ticketData = ticket.get({ plain: true });
    console.log('TICKET DATA:', JSON.stringify(ticketData, null, 2));

    // Validate that non-admin users can only reply to their own tickets
    if (userType !== 'admin') {
      if (userType === 'influencer' && ticket.influencerId !== userId) {
        throw new ForbiddenException(`You can only reply to your own tickets. Debug: userType=${userType}, userId=${userId}, ticket.influencerId=${ticket.influencerId}, ticket.brandId=${ticket.brandId}`);
      }
      if (userType === 'brand' && ticket.brandId !== userId) {
        throw new ForbiddenException(`You can only reply to your own tickets. Debug: userType=${userType}, userId=${userId}, ticket.influencerId=${ticket.influencerId}, ticket.brandId=${ticket.brandId}`);
      }
    }

    const replyData: any = {
      ticketId,
      message: replyDto.message,
      imageUrls: replyDto.imageUrls || [],
    };

    if (userType === 'admin') {
      replyData.authorType = ReplyAuthorType.ADMIN;
      replyData.adminId = userId;
    } else if (userType === 'influencer') {
      replyData.authorType = ReplyAuthorType.INFLUENCER;
      replyData.influencerId = userId;
    } else {
      replyData.authorType = ReplyAuthorType.BRAND;
      replyData.brandId = userId;
    }

    const reply = await this.supportTicketReplyModel.create(replyData);

    return {
      message: 'Reply added successfully',
      replyId: reply.id,
      createdAt: reply.createdAt,
    };
  }

  /**
   * Get all replies for a ticket
   * Users can only get replies for their own tickets, admins can get any
   */
  async getTicketReplies(
    ticketId: number,
    userId?: number,
    userType?: 'admin' | 'influencer' | 'brand',
  ) {
    const ticket = await this.supportTicketModel.findByPk(ticketId);

    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    // Validate that non-admin users can only get replies for their own tickets
    if (userType && userType !== 'admin') {
      if (userType === 'influencer' && ticket.influencerId !== userId) {
        throw new ForbiddenException(
          'You can only view replies to your own tickets',
        );
      }
      if (userType === 'brand' && ticket.brandId !== userId) {
        throw new ForbiddenException(
          'You can only view replies to your own tickets',
        );
      }
    }

    const replies = await this.supportTicketReplyModel.findAll({
      where: { ticketId },
      include: [
        {
          model: Admin,
          as: 'admin',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Influencer,
          as: 'influencer',
          attributes: ['id', 'name', 'username', 'profileImage'],
        },
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'brandName', 'username', 'profileImage'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    return {
      replies: replies.map((reply) => this.formatReplyResponse(reply)),
    };
  }

  // Helper methods
  private async validateUser(
    userId: number,
    userType: UserType,
  ): Promise<boolean> {
    if (userType === UserType.INFLUENCER) {
      const influencer = await this.influencerModel.findByPk(userId);
      return !!influencer;
    } else {
      const brand = await this.brandModel.findByPk(userId);
      return !!brand;
    }
  }

  private formatTicketResponse(ticket: SupportTicket) {
    const reporter =
      ticket.userType === UserType.INFLUENCER
        ? ticket.influencer
          ? {
              userType: UserType.INFLUENCER,
              id: ticket.influencer.id,
              name: ticket.influencer.name,
              username: ticket.influencer.username,
              phone: ticket.influencer.phone ? this.encryptionService.decrypt(ticket.influencer.phone) : undefined,
              whatsappNumber: ticket.influencer.whatsappNumber,
              profileImage: ticket.influencer.profileImage,
            }
          : null
        : ticket.brand
          ? {
              userType: UserType.BRAND,
              id: ticket.brand.id,
              name: ticket.brand.brandName,
              username: ticket.brand.username,
              email: ticket.brand.email,
              pocContactNumber: ticket.brand.pocContactNumber ? this.encryptionService.decrypt(ticket.brand.pocContactNumber) : undefined,
              profileImage: ticket.brand.profileImage,
            }
          : null;

    return {
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      imageUrls: ticket.imageUrls || [],
      reportType: ticket.reportType,
      status: ticket.status,
      reporter,
      reportedUserType: ticket.reportedUserType,
      reportedUserId: ticket.reportedUserId,
      resolution: ticket.resolution,
      resolvedAt: ticket.resolvedAt,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      assignedAdmin: ticket.assignedAdmin
        ? {
            id: ticket.assignedAdmin.id,
            name: ticket.assignedAdmin.name,
            email: ticket.assignedAdmin.email,
          }
        : null,
    };
  }

  private formatReplyResponse(reply: SupportTicketReply) {
    let author: any = null;

    if (reply.authorType === ReplyAuthorType.ADMIN && reply.admin) {
      author = {
        type: 'admin',
        id: reply.admin.id,
        name: reply.admin.name,
        email: reply.admin.email,
      };
    } else if (
      reply.authorType === ReplyAuthorType.INFLUENCER &&
      reply.influencer
    ) {
      author = {
        type: 'influencer',
        id: reply.influencer.id,
        name: reply.influencer.name,
        username: reply.influencer.username,
        profileImage: reply.influencer.profileImage,
      };
    } else if (reply.authorType === ReplyAuthorType.BRAND && reply.brand) {
      author = {
        type: 'brand',
        id: reply.brand.id,
        name: reply.brand.brandName,
        username: reply.brand.username,
        profileImage: reply.brand.profileImage,
      };
    }

    return {
      id: reply.id,
      message: reply.message,
      imageUrls: reply.imageUrls || [],
      author,
      createdAt: reply.createdAt,
    };
  }
}
