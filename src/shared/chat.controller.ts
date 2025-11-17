import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { S3Service } from './s3.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { RequestWithUser } from '../types/request.types';
import {
  CreateConversationDto,
  SendMessageDto,
  GetConversationsDto,
  GetMessagesDto,
  MarkAsReadDto,
  MarkAsReadBodyDto,
} from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard)
export class ChatController {
  // Allowed file types and sizes
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  private readonly ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
  ];
  private readonly ALLOWED_AUDIO_TYPES = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'audio/m4a',
    'audio/x-m4a',
  ];
  private readonly ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (increased for video/audio)

  constructor(
    private readonly chatService: ChatService,
    private readonly s3Service: S3Service,
  ) {}

  @Post('chat/conversations')
  @ApiOperation({ summary: 'Create or get conversation with another user' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created or retrieved',
  })
  async createOrGetConversation(
    @Req() req: RequestWithUser,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createOrGetConversation(
      req.user.id,
      req.user.userType,
      dto,
    );
    return {
      success: true,
      data: conversation,
      message: 'Conversation ready',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('chat/conversations')
  @ApiOperation({ summary: 'Get all conversations for current user' })
  @ApiResponse({ status: 200, description: 'Conversations retrieved' })
  async getConversations(
    @Req() req: RequestWithUser,
    @Query() dto: GetConversationsDto,
  ) {
    const result = await this.chatService.getConversations(
      req.user.id,
      req.user.userType,
      dto,
    );
    return {
      success: true,
      data: result,
      message: 'Conversations retrieved',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('chat/conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiResponse({ status: 200, description: 'Messages retrieved' })
  async getMessages(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query() query: GetMessagesDto,
  ) {
    const dto: GetMessagesDto = {
      ...query,
      conversationId,
    };
    const result = await this.chatService.getMessages(
      req.user.id,
      req.user.userType,
      dto,
    );
    return {
      success: true,
      data: result,
      message: 'Messages retrieved',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('chat/messages')
  @ApiOperation({
    summary: 'Send a message',
    description:
      "Send a message in a conversation. You can either provide conversationId OR (otherPartyId + otherPartyType). If using otherPartyId + otherPartyType, the conversation will be automatically created if it doesn't exist.",
  })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(@Req() req: RequestWithUser, @Body() dto: SendMessageDto) {
    const message = await this.chatService.sendMessage(
      req.user.id,
      req.user.userType,
      dto,
    );
    return {
      success: true,
      data: message,
      message: 'Message sent',
      timestamp: new Date().toISOString(),
    };
  }

  @Put('chat/conversations/:id/read')
  @ApiOperation({
    summary: 'Mark messages as read',
    description:
      'Marks unread messages as read. Leave body empty to mark all unread messages, or provide messageId to mark up to that message.',
  })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() body: MarkAsReadBodyDto,
  ) {
    const dto: MarkAsReadDto = {
      conversationId,
      messageId: body?.messageId,
    };
    const result = await this.chatService.markAsRead(
      req.user.id,
      req.user.userType,
      dto,
    );
    return {
      success: true,
      data: result,
      message: 'Messages marked as read',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('chat/unread-count')
  @ApiOperation({ summary: 'Get total unread message count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  async getUnreadCount(@Req() req: RequestWithUser) {
    const result = await this.chatService.getUnreadCount(
      req.user.id,
      req.user.userType,
    );
    return {
      success: true,
      data: result,
      message: 'Unread count retrieved',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('chat/conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  async deleteConversation(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    const result = await this.chatService.deleteConversation(
      req.user.id,
      req.user.userType,
      conversationId,
    );
    return {
      success: true,
      data: result,
      message: 'Conversation deleted',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('chat/upload')
  @ApiOperation({
    summary: 'Upload file for chat (image, video, audio, or document)',
    description:
      'Upload a file to share in chat. Supports images (JPEG, PNG, GIF, WebP), videos (MP4, MOV, AVI, WebM, MKV), audio (MP3, WAV, WebM, OGG, AAC, M4A), and documents (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV). Max size: 50MB',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (max 50MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example:
                'https://bucket.s3.region.amazonaws.com/chat/file-123456.jpg',
            },
            fileName: { type: 'string', example: 'vacation-photo.jpg' },
            fileSize: { type: 'number', example: 2048576 },
            fileType: { type: 'string', example: 'image/jpeg' },
            uploadedBy: { type: 'string', example: 'influencer' },
            uploadedById: { type: 'number', example: 11 },
          },
        },
        message: { type: 'string', example: 'File uploaded successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Validate file type
    const allAllowedTypes = [
      ...this.ALLOWED_IMAGE_TYPES,
      ...this.ALLOWED_VIDEO_TYPES,
      ...this.ALLOWED_AUDIO_TYPES,
      ...this.ALLOWED_DOCUMENT_TYPES,
    ];
    if (!allAllowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: Images (JPEG, PNG, GIF, WebP), Videos (MP4, MOV, AVI, WebM, MKV), Audio (MP3, WAV, WebM, OGG, AAC, M4A), and Documents (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV)`,
      );
    }

    // Determine file category and folder
    let category: string;
    let folder: string;

    if (this.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      category = 'image';
      folder = 'chat/images';
    } else if (this.ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      category = 'video';
      folder = 'chat/videos';
    } else if (this.ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
      category = 'audio';
      folder = 'chat/audio';
    } else {
      category = 'document';
      folder = 'chat/documents';
    }

    // Upload to S3
    const fileUrl = await this.s3Service.uploadFileToS3(
      file,
      folder,
      `${req.user.userType}-${req.user.id}`,
    );

    return {
      success: true,
      data: {
        url: fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        category,
        uploadedBy: req.user.userType,
        uploadedById: req.user.id,
      },
      message: 'File uploaded successfully',
      timestamp: new Date().toISOString(),
    };
  }

  // E2EE Key Management Endpoints

  @Put('e2ee/public-key')
  @ApiOperation({
    summary: 'Set or update public key for E2EE',
    description:
      "Store or update the user's public key for end-to-end encrypted messaging. The private key should NEVER be sent to the server.",
  })
  @ApiResponse({ status: 200, description: 'Public key updated successfully' })
  async setPublicKey(
    @Req() req: RequestWithUser,
    @Body() body: { publicKey: string },
  ) {
    const result = await this.chatService.setPublicKey(
      req.user.id,
      req.user.userType,
      body.publicKey,
    );
    return {
      success: true,
      data: result,
      message: 'Public key updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('e2ee/public-key/:userType/:userIdentifier')
  @ApiOperation({
    summary: 'Get public key of another user',
    description:
      'Retrieve the public key of another user to encrypt messages for them. Required for E2EE messaging. You can use either numeric user ID or username.',
  })
  @ApiResponse({ status: 200, description: 'Public key retrieved' })
  async getPublicKey(
    @Req() req: RequestWithUser,
    @Param('userType') userType: 'influencer' | 'brand',
    @Param('userIdentifier') userIdentifier: string,
  ) {
    const result = await this.chatService.getPublicKeyByIdentifier(
      userIdentifier,
      userType,
    );
    return {
      success: true,
      data: result,
      message: 'Public key retrieved',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('e2ee/my-public-key')
  @ApiOperation({
    summary: 'Get my own public key',
    description:
      'Retrieve the currently stored public key for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Public key retrieved' })
  async getMyPublicKey(@Req() req: RequestWithUser) {
    const result = await this.chatService.getPublicKey(
      req.user.id,
      req.user.userType,
    );
    return {
      success: true,
      data: result,
      message: 'Public key retrieved',
      timestamp: new Date().toISOString(),
    };
  }
}
