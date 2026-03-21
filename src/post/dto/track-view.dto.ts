import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsEnum, IsOptional, IsString, Min } from 'class-validator';

export class TrackViewDto {
  @ApiProperty({
    description: 'ID of the post being viewed',
    example: 123,
  })
  @IsInt()
  postId: number;

  @ApiPropertyOptional({
    description: 'How long the user viewed the post (in seconds)',
    example: 15,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  viewDuration?: number;

  @ApiPropertyOptional({
    description: 'Device type used to view the post',
    enum: ['mobile', 'desktop', 'tablet'],
    example: 'mobile',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['mobile', 'desktop', 'tablet'])
  deviceType?: string;
}

export class GetPostViewersDto {
  @ApiPropertyOptional({
    description: 'Number of viewers to return',
    example: 20,
    default: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of viewers to skip (for pagination)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
