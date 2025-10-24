import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ToLowercase } from '../../shared/decorators/to-lowercase.decorator';
import { IsValidUsername } from '../../shared/validators/is-valid-username.validator';

export class CheckUsernameDto {
  @ApiProperty({
    description:
      'Username to check availability for. Must be 3-30 characters, lowercase, and can only contain letters, numbers, dots, and underscores. Cannot start/end with dot or underscore, and cannot have consecutive dots or underscores.',
    example: 'john_doe',
    pattern: '^[a-z0-9._]+$',
    minLength: 3,
    maxLength: 30,
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString({ message: 'Username must be a string' })
  @ToLowercase()
  @IsValidUsername()
  username: string;
}
