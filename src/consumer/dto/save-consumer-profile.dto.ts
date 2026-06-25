import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, Length } from 'class-validator';

export class SaveConsumerProfileDto {
  @ApiProperty({ description: 'Full name', example: 'Rahul Sharma', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiProperty({ description: 'Date of birth (YYYY-MM-DD)', example: '1998-05-15', required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
