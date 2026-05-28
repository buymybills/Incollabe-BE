import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTemplateDto {
  @ApiProperty({
    description: 'Full template body text using {{placeholderName}} tokens for dynamic values',
    example: 'This agreement is between {{brandName}} and Collabkaroo...',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: 'Optional note describing what changed in this version',
    example: 'Updated penalty clause to INR 75,000 as per legal review',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
