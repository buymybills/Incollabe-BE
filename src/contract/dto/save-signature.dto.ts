import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveSignatureDto {
  @ApiProperty({
    description: 'Base64-encoded PNG of the drawn signature OR an S3 URL if the frontend uploads directly',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  @IsString()
  @IsNotEmpty()
  signatureData: string;
}
