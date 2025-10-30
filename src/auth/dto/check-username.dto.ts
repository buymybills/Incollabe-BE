import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ToLowercase } from '../../shared/decorators/to-lowercase.decorator';

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
  @MinLength(3, { message: 'Username too short (min 3 characters)' })
  @MaxLength(30, { message: 'Username too long (max 30 characters)' })
  @Matches(/^[a-z0-9._]+$/, {
    message: 'Username can only contain lowercase letters (a-z), numbers (0-9), dots (.) and underscores (_). No spaces or special characters like hyphens are allowed',
  })
  @Matches(/^[a-z0-9]/, {
    message: 'Username must start with a letter or number',
  })
  @Matches(/[a-z0-9]$/, {
    message: 'Username must end with a letter or number',
  })
  @Matches(/^(?!.*\.\..*$).*$/, {
    message: 'Username cannot contain consecutive dots (..)',
  })
  @Matches(/^(?!.*__.*$).*$/, {
    message: 'Username cannot contain consecutive underscores (__)',
  })
  @ToLowercase()
  username: string;
}
