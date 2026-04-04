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
    description:
      'Retrieve API logs with comprehensive filtering, sorting, and pagination. Monitor all API requests, responses, errors, and performance metrics.\n\n' +
      '**Includes:**\n' +
      '- `requestBody`: Request payload sent (e.g., phone number, email) - helps debug cases like wrong phone number for OTP\n' +
      '- `responseBody`: API response returned\n' +
      '- `errorStack`: Full error stack trace for debugging (only for errors)\n' +
      '- `requestHeaders`: Request headers (sanitized)\n\n' +
      '**Use Case Example:** User waiting for OTP but entered wrong phone number. Check `requestBody.phoneNumber` to verify the number sent.',
  })
  @ApiResponse({
    status: 200,
    description: 'API logs retrieved successfully with request/response payloads and error details',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: 'Operation success status',
        },
        logs: {
          type: 'array',
          description: 'Array of API activity logs',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1, description: 'Log entry ID' },
              method: { type: 'string', example: 'POST', description: 'HTTP method' },
              endpoint: { type: 'string', example: '/api/auth/send-otp', description: 'API endpoint path' },
              fullUrl: { type: 'string', example: '/api/auth/send-otp?type=whatsapp', description: 'Full URL with query params' },
              queryParams: {
                type: 'object',
                example: { type: 'whatsapp' },
                description: 'URL query parameters parsed as object'
              },
              requestBody: {
                type: 'object',
                example: {
                  phoneNumber: '+919876543210',
                  countryCode: '+91'
                },
                description: '🔍 REQUEST PAYLOAD - What data was sent. Use this to debug issues like wrong phone number for OTP, wrong email, etc.'
              },
              requestHeaders: {
                type: 'object',
                example: {
                  'content-type': 'application/json',
                  'authorization': 'Bearer [REDACTED]',
                  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
                },
                description: 'Request headers (sensitive tokens are redacted)'
              },
              statusCode: { type: 'number', example: 200, description: 'HTTP status code (200=success, 400=client error, 500=server error)' },
              responseTimeMs: { type: 'number', example: 234, description: 'Response time in milliseconds' },
              responseBody: {
                type: 'object',
                example: {
                  success: true,
                  message: 'OTP sent successfully to +919876543210'
                },
                description: '📤 API RESPONSE - What was returned to client. Check if response matches expectation.'
              },
              responseSizeBytes: { type: 'number', example: 1024, description: 'Response size in bytes' },
              userId: { type: 'number', example: 123, description: 'ID of user who made the request' },
              userType: { type: 'string', example: 'influencer', description: 'Type: influencer, brand, admin, external' },
              userEmail: { type: 'string', example: 'user@example.com', description: 'Email of requesting user' },
              username: { type: 'string', example: 'john_doe', description: 'Username of requesting user' },
              ipAddress: { type: 'string', example: '192.168.1.1', description: 'Client IP address' },
              userAgent: { type: 'string', example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)', description: 'Browser/App user agent' },
              isError: { type: 'boolean', example: false, description: 'true if status code >= 400' },
              isSlow: { type: 'boolean', example: false, description: 'true if response time > 5 seconds' },
              errorMessage: { type: 'string', nullable: true, example: null, description: '❌ ERROR MESSAGE - Short error description (null if success)' },
              errorStack: { type: 'string', nullable: true, example: null, description: '🔧 ERROR STACK TRACE - Full stack trace for debugging (null if success)' },
              controllerName: { type: 'string', example: 'AuthController', description: 'Controller that handled request' },
              actionName: { type: 'string', example: 'sendOtp', description: 'Method/action that handled request' },
              createdAt: { type: 'string', example: '2026-03-31T10:30:00Z', description: 'Timestamp when log was created' },
            },
          },
        },
        total: { type: 'number', example: 1500, description: 'Total number of logs matching filters' },
        page: { type: 'number', example: 1, description: 'Current page number' },
        limit: { type: 'number', example: 50, description: 'Items per page' },
        totalPages: { type: 'number', example: 30, description: 'Total pages available' },
        stats: {
          type: 'object',
          description: 'Quick statistics for filtered logs',
          properties: {
            totalRequests: { type: 'number', example: 1500 },
            successRate: { type: 'number', example: 95.2, description: 'Percentage of successful requests (2xx)' },
            errorRate: { type: 'number', example: 4.8, description: 'Percentage of failed requests (4xx/5xx)' },
            avgResponseTime: { type: 'number', example: 456, description: 'Average response time in ms' },
          },
        },
      },
      examples: {
        successCase: {
          summary: '✅ SUCCESS CASE - OTP Sent Successfully',
          description: 'User received OTP. You can see phone number in requestBody and success response.',
          value: {
            success: true,
            logs: [
              {
                id: 1,
                method: 'POST',
                endpoint: '/api/auth/send-otp',
                fullUrl: '/api/auth/send-otp?type=whatsapp',
                queryParams: { type: 'whatsapp' },
                requestBody: {
                  phoneNumber: '+919876543210',
                  countryCode: '+91',
                },
                requestHeaders: {
                  'content-type': 'application/json',
                  'authorization': 'Bearer [REDACTED]',
                  'user-agent': 'CollabkarooApp/1.0 (iPhone; iOS 14.0)',
                },
                statusCode: 200,
                responseTimeMs: 234,
                responseBody: {
                  success: true,
                  message: 'OTP sent successfully to +919876543210',
                  expiresIn: 300,
                },
                responseSizeBytes: 1024,
                userId: 123,
                userType: 'influencer',
                userEmail: 'john@example.com',
                username: 'john_doe',
                ipAddress: '192.168.1.1',
                userAgent: 'CollabkarooApp/1.0 (iPhone; iOS 14.0)',
                isError: false,
                isSlow: false,
                errorMessage: null,
                errorStack: null,
                controllerName: 'AuthController',
                actionName: 'sendOtp',
                createdAt: '2026-03-31T10:30:00Z',
              },
            ],
            total: 1,
            page: 1,
            limit: 50,
            totalPages: 1,
            stats: {
              totalRequests: 1,
              successRate: 100,
              errorRate: 0,
              avgResponseTime: 234,
            },
          },
        },
        errorCase: {
          summary: '❌ ERROR CASE - Payment Failed',
          description: 'Payment failed due to insufficient credits. Check errorMessage and errorStack for debugging.',
          value: {
            success: true,
            logs: [
              {
                id: 2,
                method: 'POST',
                endpoint: '/api/payments/deduct',
                fullUrl: '/api/payments/deduct',
                queryParams: {},
                requestBody: {
                  amount: 10000,
                  campaignId: 789,
                  description: 'Campaign payment',
                },
                requestHeaders: {
                  'content-type': 'application/json',
                  'authorization': 'Bearer [REDACTED]',
                },
                statusCode: 400,
                responseTimeMs: 123,
                responseBody: {
                  success: false,
                  message: 'Insufficient credits in wallet',
                  currentBalance: 5000,
                  requiredAmount: 10000,
                },
                responseSizeBytes: 512,
                userId: 456,
                userType: 'brand',
                userEmail: 'brand@example.com',
                username: 'fashion_brand',
                ipAddress: '203.0.113.5',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                isError: true,
                isSlow: false,
                errorMessage: 'Insufficient credits in wallet. Current: 5000, Required: 10000',
                errorStack:
                  'BadRequestException: Insufficient credits in wallet\n' +
                  '    at WalletService.deductCredits (/app/src/wallet/wallet.service.ts:234)\n' +
                  '    at PaymentService.processPayment (/app/src/payment/payment.service.ts:123)\n' +
                  '    at PaymentController.deduct (/app/src/payment/payment.controller.ts:45)\n' +
                  '    at /app/node_modules/@nestjs/core/router/router-execution-context.js:38:29',
                controllerName: 'PaymentController',
                actionName: 'deductCredits',
                createdAt: '2026-03-31T11:15:00Z',
              },
            ],
            total: 1,
            page: 1,
            limit: 50,
            totalPages: 1,
            stats: {
              totalRequests: 1,
              successRate: 0,
              errorRate: 100,
              avgResponseTime: 123,
            },
          },
        },
        wrongPhoneCase: {
          summary: '⚠️ DEBUG CASE - OTP Sent to Wrong Number',
          description: 'User complains not receiving OTP. API returned 200 OK, but check requestBody.phoneNumber - user entered wrong number!',
          value: {
            success: true,
            logs: [
              {
                id: 3,
                method: 'POST',
                endpoint: '/api/auth/send-otp',
                fullUrl: '/api/auth/send-otp?type=whatsapp',
                queryParams: { type: 'whatsapp' },
                requestBody: {
                  phoneNumber: '+919999999999',
                  countryCode: '+91',
                  comment: '❌ User entered wrong number! Their actual number is +919876543210',
                },
                requestHeaders: {
                  'content-type': 'application/json',
                  'user-agent': 'CollabkarooApp/1.0',
                },
                statusCode: 200,
                responseTimeMs: 189,
                responseBody: {
                  success: true,
                  message: 'OTP sent successfully to +919999999999',
                  expiresIn: 300,
                },
                responseSizeBytes: 1024,
                userId: 789,
                userType: 'influencer',
                userEmail: 'sarah@example.com',
                username: 'sarah_influencer',
                ipAddress: '198.51.100.23',
                userAgent: 'CollabkarooApp/1.0 (Android 12)',
                isError: false,
                isSlow: false,
                errorMessage: null,
                errorStack: null,
                controllerName: 'AuthController',
                actionName: 'sendOtp',
                createdAt: '2026-03-31T12:00:00Z',
              },
            ],
            total: 1,
            page: 1,
            limit: 50,
            totalPages: 1,
            stats: {
              totalRequests: 1,
              successRate: 100,
              errorRate: 0,
              avgResponseTime: 189,
            },
          },
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
        'requestBody',        // ✅ Show request payload (e.g., phone number sent)
        'requestHeaders',     // ✅ Show headers (sanitized)
        'statusCode',
        'responseTimeMs',
        'responseBody',       // ✅ Show API response
        'responseSizeBytes',
        'userId',
        'userType',
        'userEmail',
        'username',
        'ipAddress',
        'userAgent',
        'isError',
        'isSlow',
        'errorMessage',
        'errorStack',         // ✅ Show full error stack trace for debugging
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
    summary: 'Get detailed API log by ID',
    description:
      'Retrieve complete details of a specific API log entry.\n\n' +
      '**Full Details Include:**\n' +
      '- Complete request payload (requestBody) - See exactly what data was sent\n' +
      '- Complete response payload (responseBody) - See what was returned\n' +
      '- Full error stack trace (errorStack) - Debug errors with complete stack\n' +
      '- All request headers (requestHeaders) - Debug auth/content-type issues\n' +
      '- Performance metrics - Response time, size\n' +
      '- User context - Who made the request, from where\n\n' +
      '**Use Cases:**\n' +
      '- Deep dive into specific failed request\n' +
      '- Verify exact payload sent by user\n' +
      '- Get full error stack for debugging\n' +
      '- Audit specific user action',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed log retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        log: {
          type: 'object',
          description: 'Complete API log entry with all fields',
          properties: {
            id: { type: 'number', example: 1 },
            method: { type: 'string', example: 'POST' },
            endpoint: { type: 'string', example: '/api/auth/send-otp' },
            fullUrl: { type: 'string', example: '/api/auth/send-otp?type=whatsapp' },
            queryParams: { type: 'object', example: { type: 'whatsapp' } },
            requestBody: {
              type: 'object',
              example: { phoneNumber: '+919876543210', countryCode: '+91' },
              description: '🔍 Complete request payload - See exactly what was sent'
            },
            requestHeaders: {
              type: 'object',
              example: { 'content-type': 'application/json', 'authorization': 'Bearer [REDACTED]' },
              description: 'All request headers (auth tokens redacted for security)'
            },
            statusCode: { type: 'number', example: 200 },
            responseTimeMs: { type: 'number', example: 234 },
            responseBody: {
              type: 'object',
              example: { success: true, message: 'OTP sent successfully' },
              description: '📤 Complete response payload - See what was returned to client'
            },
            responseSizeBytes: { type: 'number', example: 1024 },
            userId: { type: 'number', example: 123 },
            userType: { type: 'string', example: 'influencer' },
            userEmail: { type: 'string', example: 'user@example.com' },
            username: { type: 'string', example: 'john_doe' },
            ipAddress: { type: 'string', example: '192.168.1.1' },
            userAgent: { type: 'string', example: 'CollabkarooApp/1.0 (iPhone; iOS 14.0)' },
            isError: { type: 'boolean', example: false },
            isSlow: { type: 'boolean', example: false },
            errorMessage: {
              type: 'string',
              nullable: true,
              example: null,
              description: '❌ Short error message (null if success)'
            },
            errorStack: {
              type: 'string',
              nullable: true,
              example: null,
              description: '🔧 Full error stack trace for debugging (null if success)'
            },
            controllerName: { type: 'string', example: 'AuthController' },
            actionName: { type: 'string', example: 'sendOtp' },
            tags: { type: 'array', items: { type: 'string' }, example: ['auth', 'otp'] },
            notes: { type: 'string', nullable: true, example: null },
            createdAt: { type: 'string', example: '2026-03-31T10:30:00Z' },
            updatedAt: { type: 'string', example: '2026-03-31T10:30:00Z' },
          },
        },
      },
      examples: {
        successExample: {
          summary: '✅ Successful Request - OTP Sent',
          value: {
            success: true,
            log: {
              id: 1,
              method: 'POST',
              endpoint: '/api/auth/send-otp',
              fullUrl: '/api/auth/send-otp?type=whatsapp',
              queryParams: { type: 'whatsapp' },
              requestBody: {
                phoneNumber: '+919876543210',
                countryCode: '+91',
              },
              requestHeaders: {
                'content-type': 'application/json',
                'authorization': 'Bearer [REDACTED]',
                'user-agent': 'CollabkarooApp/1.0 (iPhone; iOS 14.0)',
                'accept': 'application/json',
              },
              statusCode: 200,
              responseTimeMs: 234,
              responseBody: {
                success: true,
                message: 'OTP sent successfully to +919876543210',
                expiresIn: 300,
              },
              responseSizeBytes: 1024,
              userId: 123,
              userType: 'influencer',
              userEmail: 'john@example.com',
              username: 'john_doe',
              ipAddress: '192.168.1.1',
              userAgent: 'CollabkarooApp/1.0 (iPhone; iOS 14.0)',
              isError: false,
              isSlow: false,
              errorMessage: null,
              errorStack: null,
              controllerName: 'AuthController',
              actionName: 'sendOtp',
              tags: ['auth', 'otp', 'whatsapp'],
              notes: null,
              createdAt: '2026-03-31T10:30:00Z',
              updatedAt: '2026-03-31T10:30:00Z',
            },
          },
        },
        errorExample: {
          summary: '❌ Failed Request - Server Error with Stack Trace',
          value: {
            success: true,
            log: {
              id: 2,
              method: 'POST',
              endpoint: '/api/campaigns/apply',
              fullUrl: '/api/campaigns/apply',
              queryParams: {},
              requestBody: {
                campaignId: 999,
                coverLetter: 'I would love to join this campaign!',
              },
              requestHeaders: {
                'content-type': 'application/json',
                'authorization': 'Bearer [REDACTED]',
              },
              statusCode: 500,
              responseTimeMs: 567,
              responseBody: {
                success: false,
                message: 'Internal server error',
                error: 'Campaign not found',
              },
              responseSizeBytes: 512,
              userId: 456,
              userType: 'influencer',
              userEmail: 'sarah@example.com',
              username: 'sarah_influencer',
              ipAddress: '203.0.113.45',
              userAgent: 'CollabkarooApp/1.0 (Android 12)',
              isError: true,
              isSlow: false,
              errorMessage: 'NotFoundException: Campaign with id 999 not found',
              errorStack:
                'NotFoundException: Campaign with id 999 not found\n' +
                '    at CampaignService.findByPk (/app/src/campaign/campaign.service.ts:123)\n' +
                '    at InfluencerService.applyToCampaign (/app/src/influencer/influencer.service.ts:456)\n' +
                '    at InfluencerController.applyCampaign (/app/src/influencer/influencer.controller.ts:78)\n' +
                '    at /app/node_modules/@nestjs/core/router/router-execution-context.js:38:29\n' +
                '    at InterceptorsConsumer.intercept (/app/node_modules/@nestjs/core/interceptors/interceptors-consumer.js:11:17)\n' +
                '    at /app/node_modules/@nestjs/core/router/router-execution-context.js:46:60',
              controllerName: 'InfluencerController',
              actionName: 'applyCampaign',
              tags: ['campaign', 'application', 'error'],
              notes: 'User tried to apply to deleted campaign',
              createdAt: '2026-03-31T11:45:00Z',
              updatedAt: '2026-03-31T11:45:00Z',
            },
          },
        },
        debugExample: {
          summary: '⚠️ Debug Case - Wrong Phone Number',
          description: 'Request succeeded (200 OK) but user not receiving OTP. Check requestBody to find wrong phone number.',
          value: {
            success: true,
            log: {
              id: 3,
              method: 'POST',
              endpoint: '/api/auth/send-otp',
              fullUrl: '/api/auth/send-otp?type=whatsapp',
              queryParams: { type: 'whatsapp' },
              requestBody: {
                phoneNumber: '+919999999999',
                countryCode: '+91',
                note: 'User entered wrong number - actual number is +919876543210',
              },
              requestHeaders: {
                'content-type': 'application/json',
                'authorization': 'Bearer [REDACTED]',
              },
              statusCode: 200,
              responseTimeMs: 189,
              responseBody: {
                success: true,
                message: 'OTP sent successfully to +919999999999',
                expiresIn: 300,
              },
              responseSizeBytes: 1024,
              userId: 789,
              userType: 'influencer',
              userEmail: 'mike@example.com',
              username: 'mike_creator',
              ipAddress: '198.51.100.67',
              userAgent: 'CollabkarooApp/1.0 (Android 12)',
              isError: false,
              isSlow: false,
              errorMessage: null,
              errorStack: null,
              controllerName: 'AuthController',
              actionName: 'sendOtp',
              tags: ['auth', 'otp', 'whatsapp', 'wrong-number'],
              notes: 'AdminNote: User contacted support saying OTP not received. Found wrong number in request payload.',
              createdAt: '2026-03-31T12:15:00Z',
              updatedAt: '2026-03-31T12:20:00Z',
            },
          },
        },
      },
    },
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
    summary: 'Get API statistics and analytics',
    description:
      'Get comprehensive API statistics and analytics dashboard data.\n\n' +
      '**Analytics Provided:**\n' +
      '- **Overview Metrics**: Total requests, success/error rates, avg response time\n' +
      '- **Top Endpoints**: Most frequently called APIs\n' +
      '- **Top Errors**: Most common error types and status codes\n' +
      '- **User Type Distribution**: Requests by influencer, brand, admin\n' +
      '- **HTTP Method Distribution**: GET, POST, PUT, DELETE breakdown\n' +
      '- **Slow Requests Count**: Requests taking > 5 seconds\n\n' +
      '**Filters:**\n' +
      '- `startDate`: Get stats from specific date\n' +
      '- `endDate`: Get stats until specific date\n' +
      '- `userType`: Filter by user type\n\n' +
      '**Use Cases:**\n' +
      '- Monitor API health and performance\n' +
      '- Identify problematic endpoints\n' +
      '- Track error patterns\n' +
      '- Analyze user activity trends\n' +
      '- Generate reports for specific time periods',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        stats: {
          type: 'object',
          description: 'Aggregated statistics',
          properties: {
            totalRequests: {
              type: 'number',
              example: 15000,
              description: 'Total number of API requests in selected period',
            },
            successRate: {
              type: 'number',
              example: 95.2,
              description: 'Percentage of successful requests (2xx status codes)',
            },
            errorRate: {
              type: 'number',
              example: 4.8,
              description: 'Percentage of failed requests (4xx/5xx status codes)',
            },
            avgResponseTime: {
              type: 'number',
              example: 456,
              description: 'Average response time in milliseconds',
            },
            slowRequests: {
              type: 'number',
              example: 120,
              description: 'Number of slow requests (response time > 5 seconds)',
            },
            topEndpoints: {
              type: 'array',
              description: 'Top 10 most called endpoints',
              items: {
                type: 'object',
                properties: {
                  endpoint: { type: 'string', example: '/api/campaigns' },
                  count: { type: 'number', example: 2500 },
                },
              },
            },
            topErrors: {
              type: 'array',
              description: 'Top 10 most common errors',
              items: {
                type: 'object',
                properties: {
                  statusCode: { type: 'number', example: 404 },
                  errorMessage: { type: 'string', example: 'Campaign not found' },
                  count: { type: 'number', example: 350 },
                },
              },
            },
            requestsByUserType: {
              type: 'object',
              description: 'Request distribution by user type',
              example: {
                influencer: 8000,
                brand: 6000,
                admin: 1000,
              },
            },
            requestsByMethod: {
              type: 'object',
              description: 'Request distribution by HTTP method',
              example: {
                GET: 9000,
                POST: 4500,
                PUT: 1000,
                DELETE: 500,
              },
            },
          },
        },
      },
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
            { endpoint: '/api/influencers/search', count: 1800 },
            { endpoint: '/api/posts', count: 1500 },
            { endpoint: '/api/auth/login', count: 1200 },
            { endpoint: '/api/wallet/transactions', count: 1000 },
            { endpoint: '/api/profile', count: 900 },
            { endpoint: '/api/campaigns/apply', count: 850 },
            { endpoint: '/api/auth/send-otp', count: 700 },
            { endpoint: '/api/notifications', count: 650 },
            { endpoint: '/api/chat/messages', count: 600 },
          ],
          topErrors: [
            {
              statusCode: 404,
              errorMessage: 'Campaign not found',
              count: 350,
            },
            {
              statusCode: 401,
              errorMessage: 'Unauthorized - Invalid token',
              count: 200,
            },
            {
              statusCode: 400,
              errorMessage: 'Insufficient credits in wallet',
              count: 150,
            },
            {
              statusCode: 500,
              errorMessage: 'Database connection timeout',
              count: 75,
            },
            {
              statusCode: 403,
              errorMessage: 'Forbidden - Profile not verified',
              count: 50,
            },
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
