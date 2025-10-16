import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { RESERVED_USERNAMES } from '../constants/reserved-usernames';

@ValidatorConstraint({ async: false })
export class IsValidUsernameConstraint implements ValidatorConstraintInterface {
  validate(username: string) {
    if (!username) return false;

    const lowercaseUsername = username.toLowerCase();

    // Check if username is reserved
    if (RESERVED_USERNAMES.includes(lowercaseUsername)) {
      return false;
    }

    return true;
  }

  defaultMessage() {
    return 'This username is reserved and cannot be used';
  }
}

export function IsValidUsername(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUsernameConstraint,
    });
  };
}
