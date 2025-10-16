import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Username } from '../../shared/decorators/username.decorator';

export class CheckUsernameDto {
  @Username({ example: 'dhruv_1109' })
  username: string;
}
