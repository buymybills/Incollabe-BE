import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePostMultipartDto {
  @ApiProperty({
    description: 'Post content text (required if no media files provided)',
    example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
    required: false,
  })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @Length(1, 5000, {
    message: 'Post content must be between 1 and 5000 characters',
  })
  content?: string;

  @ApiProperty({
    description:
      'Media files - supports both images and videos. Allowed formats: Images (jpg, jpeg, png, webp), Videos (mp4, mov, avi). Max 10 files, 50MB per file.',
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
