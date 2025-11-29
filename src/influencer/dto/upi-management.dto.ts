import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsInt } from 'class-validator';

export class AddUpiIdDto {
  @ApiProperty({
    description: 'UPI ID to add',
    example: '9876543210@paytm',
  })
  @IsNotEmpty()
  @IsString()
  upiId: string;

  @ApiProperty({
    description: 'Set this UPI as selected for current transaction',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  setAsSelected?: boolean;
}

export class SelectUpiIdDto {
  @ApiProperty({
    description: 'UPI ID record ID to select for current transaction',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  upiIdRecordId: number;
}

export class UpiIdDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: '9876543210@paytm' })
  upiId: string;

  @ApiProperty({
    example: true,
    description: 'Only present when true - indicates this UPI is selected for current redemption',
    required: false,
  })
  isSelectedForCurrentTransaction?: boolean;

  @ApiProperty({ example: '2025-11-28T10:00:00.000Z', nullable: true })
  lastUsedAt: Date | null;

  @ApiProperty({ example: '2025-11-20T10:00:00.000Z' })
  createdAt: Date;
}

export class GetUpiIdsResponseDto {
  @ApiProperty({ type: [UpiIdDto] })
  upiIds: UpiIdDto[];

  @ApiProperty({ example: 3 })
  total: number;
}
