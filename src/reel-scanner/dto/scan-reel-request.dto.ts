import { IsString, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanReelRequestDto {
  @ApiProperty({
    description:
      'URL to scan — direct image (jpg/png/webp), Instagram post, or any page with og:image',
    example: 'https://www.instagram.com/p/xyz123/',
  })
  @IsString()
  @IsNotEmpty()
  url: string;
}
