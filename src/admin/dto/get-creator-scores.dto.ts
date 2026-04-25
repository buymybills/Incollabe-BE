import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const CREATOR_GRADES = ['Strong Profile', 'Good Profile', 'Average Profile', 'Weak Profile', 'Not Scored'] as const;
export type CreatorGrade = typeof CREATOR_GRADES[number];

export class GetCreatorScoresDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search by name, username or Instagram username' })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiPropertyOptional({ description: 'Filter by Instagram connected date (start)', example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by Instagram connected date (end)', example: '2025-10-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by grade',
    enum: CREATOR_GRADES,
    example: 'Strong Profile',
  })
  @IsOptional()
  @IsIn(CREATOR_GRADES)
  grade?: CreatorGrade;
}

export class GetCreatorScoresDashboardDto {
  @ApiPropertyOptional({ description: 'Period start date', example: '2025-09-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Period end date', example: '2025-10-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
