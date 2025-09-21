import { ApiProperty } from '@nestjs/swagger';

export class CompanyTypeDto {
  @ApiProperty({
    description: 'Company type ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Company type name',
    example: 'Private Limited Company (Pvt. Ltd.)',
  })
  name: string;

  @ApiProperty({
    description: 'Company type description',
    example:
      'A company limited by shares that offers limited liability to its shareholders',
  })
  description: string;

  @ApiProperty({
    description: 'Whether the company type is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Sort order for display',
    example: 1,
  })
  sortOrder: number;
}
