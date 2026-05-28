import { IsBoolean, Equals } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignContractDto {
  @ApiProperty({
    description: 'User must tick this checkbox — "I have read and agree to the above. I authorise use of my saved signature."',
    example: true,
  })
  @IsBoolean()
  @Equals(true, { message: 'You must agree to the contract to proceed.' })
  agreed: boolean;
}
