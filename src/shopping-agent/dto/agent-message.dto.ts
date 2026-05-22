import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AgentMessageDto {
  @ApiPropertyOptional({
    description:
      'Session ID to continue an existing conversation. Omit to start a new session.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({
    description: 'User message — can include a reel/image URL for product scanning',
    example:
      'I saw this outfit on Instagram https://www.instagram.com/p/abc123/ — can you find something similar?',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class AgentResponseDto {
  sessionId: string;
  reply: string;
  toolsUsed: string[];
  products?: any[];
}
