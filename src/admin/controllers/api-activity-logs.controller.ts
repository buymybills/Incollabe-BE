import { Controller, Get, Query, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { ApiActivityLog } from '../../shared/models/api-activity-log.model';
import { GetApiActivityLogsDto, ApiActivityLogStatsDto, LogFilterStatus } from '../dto/api-activity-log.dto';

@ApiTags('Admin - API Activity Logs')
@Controller('admin/api-logs')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class ApiActivityLogsController {
  constructor(
    @InjectModel(ApiActivityLog)
    private apiActivityLogModel: typeof ApiActivityLog,
  ) {}

  /**
   * GET /admin/api-logs
   * Get all API activity logs with filtering
   */
  @Get()
  @ApiOperation({
    summary: 'Get all API activity logs',
    description: 'Retrieve API logs with comprehensive filtering, sorting, and pagination. Monitor all API requests, responses, errors, and performance metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'API logs retrieved successfully',
    schema: {
      example: {
        success: true,
        logs: [
          {
            id: 1,
            method: 'POST',
            endpoint: '/api/campaigns',
            statusCode: 201,
            responseTimeMs: 234,
            userId: 123,
            userType: 'brand',
            userEmail: 'brand@example.com',
            ipAddress: '192.168.1.1',
            isError: false,
            isSlow: false,
            createdAt: '2026-03-31T10:30:00Z',
          },
        ],
        total: 1500,
        page: 1,
        limit: 50,
        totalPages: 30,
        stats: {
          totalRequests: 1500,
          successRate: 95.2,
          errorRate: 4.8,
          avgResponseTime: 456,
        },
      },
    },
  })
  async getApiLogs(@Query() dto: GetApiActivityLogsDto) {
    const { page = 1, limit: rawLimit = 50 } = dto;
    const limit = Math.min(rawLimit, 200); // Max 200 per page
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (dto.method) {
      where.method = dto.method;
    }

    if (dto.endpoint) {
      where.endpoint = { [Op.like]: `%${dto.endpoint}%` };
    }

    if (dto.userType) {
      where.userType = dto.userType;
    }

    if (dto.userId) {
      where.userId = dto.userId;
    }

    if (dto.statusCode) {
      where.statusCode = dto.statusCode;
    }

    if (dto.status) {
      switch (dto.status) {
        case LogFilterStatus.SUCCESS:
          where.statusCode = { [Op.between]: [200, 299] };
          break;
        case LogFilterStatus.CLIENT_ERROR:
          where.statusCode = { [Op.between]: [400, 499] };
          break;
        case LogFilterStatus.SERVER_ERROR:
          where.statusCode = { [Op.gte]: 500 };
          break;
      }
    }

    if (dto.errorsOnly) {
      where.isError = true;
    }

    if (dto.slowOnly) {
      where.isSlow = true;
    }

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) {
        where.createdAt[Op.gte] = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.createdAt[Op.lte] = new Date(dto.endDate);
      }
    }

    if (dto.ipAddress) {
      where.ipAddress = dto.ipAddress;
    }

    if (dto.search) {
      where[Op.or] = [
        { endpoint: { [Op.like]: `%${dto.search}%` } },
        { errorMessage: { [Op.like]: `%${dto.search}%` } },
        { userEmail: { [Op.like]: `%${dto.search}%` } },
      ];
    }

    // Fetch logs
    const { rows: logs, count: total } = await this.apiActivityLogModel.findAndCountAll({
      where,
      limit,
      offset,
      order: [[dto.sortBy || 'createdAt', dto.sortOrder || 'DESC']],
      attributes: [
        'id',
        'method',
        'endpoint',
        'fullUrl',
        'queryParams',
        'statusCode',
        'responseTimeMs',
        'userId',
        'userType',
        'userEmail',
        'username',
        'ipAddress',
        'userAgent',
        'isError',
        'isSlow',
        'errorMessage',
        'controllerName',
        'actionName',
        'createdAt',
      ],
    });

    // Calculate stats
    const stats = await this.calculateStats(where);

    return {
      success: true,
      logs: logs.map(log => log.toJSON()),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
    };
  }

  /**
   * GET /admin/api-logs/:id
   * Get detailed log entry
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get detailed API log',
    description: 'Retrieve full details of a specific API log including request/response bodies, headers, and error stack traces.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed log retrieved',
  })
  async getLogDetail(@Param('id', ParseIntPipe) id: number) {
    const log = await this.apiActivityLogModel.findByPk(id);

    if (!log) {
      return {
        success: false,
        message: 'Log not found',
      };
    }

    return {
      success: true,
      log: log.toJSON(),
    };
  }

  /**
   * GET /admin/api-logs/stats/summary
   * Get API statistics summary
   */
  @Get('stats/summary')
  @ApiOperation({
    summary: 'Get API statistics',
    description: 'Get aggregated statistics including request counts, success rates, performance metrics, and error rates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved',
    schema: {
      example: {
        success: true,
        stats: {
          totalRequests: 15000,
          successRate: 95.2,
          errorRate: 4.8,
          avgResponseTime: 456,
          slowRequests: 120,
          topEndpoints: [
            { endpoint: '/api/campaigns', count: 2500 },
            { endpoint: '/api/influencers', count: 1800 },
          ],
          topErrors: [
            { statusCode: 404, count: 350 },
            { statusCode: 401, count: 200 },
          ],
          requestsByUserType: {
            influencer: 8000,
            brand: 6000,
            admin: 1000,
          },
          requestsByMethod: {
            GET: 9000,
            POST: 4500,
            PUT: 1000,
            DELETE: 500,
          },
        },
      },
    },
  })
  async getStats(@Query() dto: ApiActivityLogStatsDto) {
    const where: any = {};

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) {
        where.createdAt[Op.gte] = new Date(dto.startDate);
      }
      if (dto.endDate) {
        where.createdAt[Op.lte] = new Date(dto.endDate);
      }
    }

    if (dto.userType) {
      where.userType = dto.userType;
    }

    // Total requests
    const totalRequests = await this.apiActivityLogModel.count({ where });

    // Success/Error counts
    const successCount = await this.apiActivityLogModel.count({
      where: { ...where, statusCode: { [Op.between]: [200, 299] } },
    });

    const errorCount = await this.apiActivityLogModel.count({
      where: { ...where, isError: true },
    });

    // Slow requests
    const slowRequests = await this.apiActivityLogModel.count({
      where: { ...where, isSlow: true },
    });

    // Average response time
    const avgResponseTime = await this.apiActivityLogModel.findOne({
      where,
      attributes: [
        [this.apiActivityLogModel.sequelize!.fn('AVG', this.apiActivityLogModel.sequelize!.col('response_time_ms')), 'avg'],
      ],
      raw: true,
    });

    // Top endpoints
    const topEndpoints = await this.apiActivityLogModel.findAll({
      where,
      attributes: [
        'endpoint',
        [this.apiActivityLogModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      group: ['endpoint'],
      order: [[this.apiActivityLogModel.sequelize!.fn('COUNT', '*'), 'DESC']],
      limit: 10,
      raw: true,
    });

    // Top errors
    const topErrors = await this.apiActivityLogModel.findAll({
      where: { ...where, isError: true },
      attributes: [
        'statusCode',
        'errorMessage',
        [this.apiActivityLogModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      group: ['statusCode', 'errorMessage'],
      order: [[this.apiActivityLogModel.sequelize!.fn('COUNT', '*'), 'DESC']],
      limit: 10,
      raw: true,
    });

    // Requests by user type
    const byUserType = await this.apiActivityLogModel.findAll({
      where,
      attributes: [
        'userType',
        [this.apiActivityLogModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      group: ['userType'],
      raw: true,
    });

    // Requests by method
    const byMethod = await this.apiActivityLogModel.findAll({
      where,
      attributes: [
        'method',
        [this.apiActivityLogModel.sequelize!.fn('COUNT', '*'), 'count'],
      ],
      group: ['method'],
      raw: true,
    });

    return {
      success: true,
      stats: {
        totalRequests,
        successRate: totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(2) : 0,
        errorRate: totalRequests > 0 ? ((errorCount / totalRequests) * 100).toFixed(2) : 0,
        avgResponseTime: Math.round((avgResponseTime as any)?.avg || 0),
        slowRequests,
        topEndpoints: topEndpoints.map((e: any) => ({
          endpoint: e.endpoint,
          count: parseInt(e.count),
        })),
        topErrors: topErrors.map((e: any) => ({
          statusCode: e.statusCode,
          errorMessage: e.errorMessage,
          count: parseInt(e.count),
        })),
        requestsByUserType: byUserType.reduce((acc: any, item: any) => {
          acc[item.userType || 'unknown'] = parseInt(item.count);
          return acc;
        }, {}),
        requestsByMethod: byMethod.reduce((acc: any, item: any) => {
          acc[item.method] = parseInt(item.count);
          return acc;
        }, {}),
      },
    };
  }

  /**
   * GET /admin/api-logs/user/:userId
   * Get logs for specific user
   */
  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get logs for specific user',
    description: 'Retrieve all API activity for a specific user (influencer, brand, or admin)',
  })
  async getUserLogs(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() dto: GetApiActivityLogsDto,
  ) {
    dto.userId = userId;
    return this.getApiLogs(dto);
  }

  /**
   * Helper: Calculate basic stats
   */
  private async calculateStats(where: any) {
    const totalRequests = await this.apiActivityLogModel.count({ where });

    if (totalRequests === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        errorRate: 0,
        avgResponseTime: 0,
      };
    }

    const successCount = await this.apiActivityLogModel.count({
      where: { ...where, statusCode: { [Op.between]: [200, 299] } },
    });

    const errorCount = await this.apiActivityLogModel.count({
      where: { ...where, isError: true },
    });

    const avgResponseTime = await this.apiActivityLogModel.findOne({
      where,
      attributes: [
        [this.apiActivityLogModel.sequelize!.fn('AVG', this.apiActivityLogModel.sequelize!.col('response_time_ms')), 'avg'],
      ],
      raw: true,
    });

    return {
      totalRequests,
      successRate: parseFloat(((successCount / totalRequests) * 100).toFixed(2)),
      errorRate: parseFloat(((errorCount / totalRequests) * 100).toFixed(2)),
      avgResponseTime: Math.round((avgResponseTime as any)?.avg || 0),
    };
  }
}
