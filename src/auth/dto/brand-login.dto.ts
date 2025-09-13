import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class BrandLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}