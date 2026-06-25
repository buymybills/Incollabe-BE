import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BecomeInfluencerDto {
  @ApiProperty({ description: 'HYPE platform invite code', example: 'HYPE-6SH5' })
  @IsNotEmpty()
  @IsString()
  inviteCode: string;
}
