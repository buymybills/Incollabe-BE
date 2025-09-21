import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class UpdateBrandNichesDto {
  @ApiProperty({
    description: 'Array of niche IDs',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one niche must be selected' })
  @ArrayMaxSize(10, { message: 'Maximum 10 niches can be selected' })
  @IsNumber({}, { each: true, message: 'Each niche ID must be a number' })
  nicheIds: number[];
}
