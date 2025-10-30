import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';

export class CreatePostMultipartDto {
  @ApiProperty({
    description: 'Post content text (required if no media files provided)',
    example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 5000, {
    message: 'Post content must be between 1 and 5000 characters',
  })
  content?: string;

  @ApiProperty({
    description: 'Media files (images/videos)',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    required: false,
  })
  @IsOptional()
  media?: any[];
}
