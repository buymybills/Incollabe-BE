import { ApiProperty } from '@nestjs/swagger';

export class EnvironmentUrlsDto {
  @ApiProperty({
    description: 'Current environment (staging or production)',
    example: 'staging',
  })
  environment: string;

  @ApiProperty({
    description: 'Backend API URL based on environment',
    example: 'https://incollab.buymybills.in/api/docs#/',
  })
  backendUrl: string;

  @ApiProperty({
    description: 'Frontend URL based on environment',
    example: 'https://collabkaroo.co.in',
  })
  frontendUrl: string;
}
