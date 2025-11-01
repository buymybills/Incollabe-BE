import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePostMultipartDto {
  @ApiProperty({
    description: 'Post content text',
    example: 'Updated post content...',
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
      'Media files to add - supports both images and videos. Allowed formats: Images (jpg, jpeg, png, webp), Videos (mp4, mov, avi). Max 10 files, 50MB per file.',
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
      'Existing media URLs to keep (URLs to remove will be deleted). Can be sent as comma-separated string or array.',
    required: false,
    type: [String],
    example: ['https://example.com/image1.jpg'],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url);
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  existingMediaUrls?: string[];
}
