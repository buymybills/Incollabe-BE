import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, Length } from 'class-validator';
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

  @ApiProperty({
    description:
      'Pre-uploaded media URL(s) from S3 (for chunked uploads). Can be a single URL string or array of URLs.',
    required: false,
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' } }
    ],
    example: 'https://incollabstaging.s3.ap-south-1.amazonaws.com/posts/videos/influencer-11-1234567890-12345.mp4',
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Convert single string to array for consistency
    if (typeof value === 'string') {
      return [value];
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];
}
