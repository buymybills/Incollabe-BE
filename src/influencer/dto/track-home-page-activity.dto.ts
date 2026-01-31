import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HomePageActionType } from '../models/home-page-history.model';

export class TrackHomePageActivityDto {
  @ApiProperty({
    enum: HomePageActionType,
    description: 'Type of action performed on home page',
    example: HomePageActionType.APP_OPEN,
    examples: {
      app_open: { value: 'app_open', description: 'User opened the app' },
      home_view: { value: 'home_view', description: 'User viewed home page' },
      tab_switch: { value: 'tab_switch', description: 'User switched to home tab' },
      pull_refresh: { value: 'pull_refresh', description: 'User pulled to refresh' },
      background: { value: 'background', description: 'App went to background' },
      foreground: { value: 'foreground', description: 'App came to foreground' },
    },
  })
  @IsEnum(HomePageActionType)
  actionType: HomePageActionType;

  @ApiPropertyOptional({
    description: 'Device identifier',
    example: 'device-abc-123',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'App version',
    example: '3.5.0',
  })
  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class TrackHomePageActivityResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Activity tracked successfully' })
  message: string;

  @ApiProperty({
    example: {
      id: 1,
      influencerId: 123,
      actionType: 'app_open',
      timestamp: '2026-01-28T10:30:00Z',
    },
  })
  data: {
    id: number;
    influencerId: number;
    actionType: string;
    timestamp: string;
  };
}
