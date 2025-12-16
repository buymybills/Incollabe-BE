import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateKeyBackupDto {
  @ApiProperty({
    description: 'Public key (PEM format)',
    example: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhki...\n-----END PUBLIC KEY-----',
  })
  @IsString()
  @IsNotEmpty()
  publicKey: string;

  @ApiProperty({
    description: 'Private key encrypted with password-derived key (base64)',
    example: 'U2FsdGVkX1...',
  })
  @IsString()
  @IsNotEmpty()
  encryptedPrivateKey: string;

  @ApiProperty({
    description: 'Salt for PBKDF2 key derivation (hex string)',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  salt: string;

  @ApiProperty({
    description: 'Optional device information',
    example: { deviceName: 'Chrome on MacOS', userAgent: 'Mozilla/5.0...' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  deviceInfo?: any;
}

export class UpdateKeyBackupDto {
  @ApiProperty({
    description: 'New encrypted private key',
    example: 'U2FsdGVkX1...',
  })
  @IsString()
  @IsNotEmpty()
  encryptedPrivateKey: string;

  @ApiProperty({
    description: 'New salt for PBKDF2 key derivation (hex string)',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  salt: string;

  @ApiProperty({
    description: 'New public key if changing keypair',
    required: false,
  })
  @IsOptional()
  @IsString()
  publicKey?: string;
}
