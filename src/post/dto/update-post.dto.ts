import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, Length } from 'class-validator';

export class UpdatePostDto {
  @ApiProperty({
    description: 'Post content text',
    required: false,
    example: 'Updated lorem ipsum dolor sit amet...',
  })
  @IsOptional()
  @IsString()
  @Length(1, 5000, {
    message: 'Post content must be between 1 and 5000 characters',
  })
  content?: string;

  @ApiProperty({
    description: 'Array of media URLs (images/videos)',
    required: false,
    type: [String],
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/video1.mp4',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];
}
