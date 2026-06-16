import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/** Update payload — every field of CreateProductDto is optional. */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
