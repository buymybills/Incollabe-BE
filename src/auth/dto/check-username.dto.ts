import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CheckUsernameDto {
  @ApiProperty({
    description: 'Username to check availability for',
    example: 'dhruv_1109',
    pattern: '^[a-zA-Z0-9_]+$',
    minLength: 3,
    maxLength: 30,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 30, { message: 'Username must be between 3 and 30 characters' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;
}