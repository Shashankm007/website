import { PartialType } from '@nestjs/swagger';
import { CreateAddressDto } from './create-address.dto';

/** Partial update of an existing address (all fields optional). */
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
