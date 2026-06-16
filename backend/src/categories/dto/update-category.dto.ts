import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/** All create fields are optional on update; setting `parentId` to null promotes to root. */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
