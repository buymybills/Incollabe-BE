import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class InviteInfluencersDto {
  @ApiProperty({
    description: 'Campaign ID to send invitations for',
    example: 1,
  })
  @IsNumber()
  @Type(() => Number)
  campaignId: number;

  @ApiProperty({
    description: 'Array of influencer IDs to invite',
    type: [Number],
    example: [1, 2, 3, 4, 5],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one influencer must be selected' })
  @IsNumber({}, { each: true })
  @Type(() => Number)
  influencerIds: number[];

  @ApiProperty({
    description: 'Optional personal message to include in the invitation',
    required: false,
    example:
      'We love your content and would like to collaborate with you on our summer campaign!',
  })
  @IsOptional()
  @IsString()
  personalMessage?: string;
}
