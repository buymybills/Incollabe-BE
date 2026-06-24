import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateInviteCodeDto {
  @ApiProperty({ description: 'Invite code (e.g. HYPE-XYZ9). If omitted, auto-generated.', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: 'Optional admin note', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Number of codes to generate when code not specified', required: false, default: 1 })
  @IsOptional()
  @IsInt()
  count?: number;
}
