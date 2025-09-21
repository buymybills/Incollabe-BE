import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetPostsDto {
  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 1)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of posts per page',
    required: false,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 10)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    description: 'Filter by specific user type',
    required: false,
    enum: ['influencer', 'brand'],
    example: 'influencer',
  })
  @IsOptional()
  @IsString()
  userType?: string;

  @ApiProperty({
    description: 'Filter by specific user ID',
    required: false,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  userId?: number;
}
