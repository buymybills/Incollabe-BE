import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsObject,
  ValidateNested,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BotEventType } from '../models/bot-event.model';

export class TrackBotEventDto {
  @IsEnum(BotEventType)
  eventType: BotEventType;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  userKey?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  productSlug?: string;

  @IsOptional()
  @IsString()
  productTitle?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsNumber()
  priceInr?: number;

  @IsOptional()
  @IsNumber()
  valueInr?: number;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  faqCategory?: string;

  @IsOptional()
  @IsBoolean()
  answered?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/** The bot may flush several events from one conversation turn in a single call. */
export class TrackBotEventsBatchDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrackBotEventDto)
  events: TrackBotEventDto[];
}
