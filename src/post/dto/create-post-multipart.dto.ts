import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, Length } from 'class-validator';

export class CreatePostMultipartDto {
  @ApiProperty({
    description: 'Post content text',
    example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
  })
  @IsNotEmpty({ message: 'Post content is required' })
  @IsString()
  @Length(1, 5000, {
    message: 'Post content must be between 1 and 5000 characters',
  })
  content: string;

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
