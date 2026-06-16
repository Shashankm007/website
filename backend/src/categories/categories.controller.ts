import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Full category tree: roots with their children nested recursively, ordered by position. */
  @Public()
  @Get()
  findTree() {
    return this.categories.findTree();
  }

  /** A single category by slug with its immediate children and ancestor breadcrumb. */
  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categories.findBySlug(slug);
  }
}
