import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateDisplayOrderDto {
  @ApiProperty({
    description:
      'Display order number (lower number = higher priority in list). Default is 999999.',
    example: 1,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  displayOrder: number;
}
