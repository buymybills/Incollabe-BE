import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional, MinLength } from 'class-validator';

export class CreateTicketReplyDto {
  @ApiProperty({
    description: 'Reply message',
    example: 'We have received your request and will investigate this issue.',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  message: string;

  @ApiPropertyOptional({
    description: 'Array of image URLs for the reply',
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  imageUrls?: string[];
}
