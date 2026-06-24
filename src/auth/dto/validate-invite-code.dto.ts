import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateInviteCodeDto {
  @ApiProperty({
    description: 'HYPE invite code (e.g. HYPE-XYZ9)',
    example: 'HYPE-XYZ9',
  })
  @IsNotEmpty()
  @IsString()
  code: string;
}
