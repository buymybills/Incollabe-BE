import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { IsValidUsername } from '../validators/is-valid-username.validator';

/**
 * Username validation decorator with all required rules:
 * - 3-30 characters
 * - Only lowercase letters, numbers, dots, and underscores
 * - Cannot start/end with dot or underscore
 * - No consecutive dots or underscores
 * - Not in reserved list
 * - Auto-converts to lowercase and trims whitespace
 */
export function Username(options?: { required?: boolean; example?: string }) {
  const { required = true, example = 'john_doe' } = options || {};

  const decorators = [
    ApiProperty({
      description:
        'Username (3-30 characters, lowercase letters, numbers, dots, underscores)',
      example,
      minLength: 3,
      maxLength: 30,
      pattern: '^[a-z0-9._]+$',
    }),
    IsString(),
    Length(3, 30, { message: 'Username must be between 3 and 30 characters' }),
    Matches(/^[a-z0-9._]+$/, {
      message:
        'Username can only contain lowercase letters, numbers, dots, and underscores',
    }),
    Matches(/^(?![_.])(?!.*[_.]{2})[a-z0-9._]+(?<![_.])$/, {
      message:
        'Username cannot start/end with dot or underscore, and cannot have consecutive dots or underscores',
    }),
    IsValidUsername(),
    Transform(({ value }) => value?.toLowerCase().trim()),
  ];

  if (required) {
    decorators.unshift(IsNotEmpty({ message: 'Username is required' }));
  } else {
    decorators.unshift(IsOptional());
  }

  return applyDecorators(...decorators);
}
