import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('admin/categories')
@Roles(Role.ADMIN)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  /** Create a category. */
  @Post()
  async create(@Body() dto: CreateCategoryDto, @CurrentUser('id') actorId: string) {
    const category = await this.categories.create(dto);
    await this.audit.log({
      actorId,
      action: 'category.create',
      entity: 'Category',
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug, parentId: category.parentId },
    });
    return category;
  }

  /** Update a category. */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser('id') actorId: string,
  ) {
    const category = await this.categories.update(id, dto);
    await this.audit.log({
      actorId,
      action: 'category.update',
      entity: 'Category',
      entityId: category.id,
      metadata: { changes: dto },
    });
    return category;
  }

  /** Delete a category (children are detached to root via `onDelete: SetNull`). */
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    const category = await this.categories.remove(id);
    await this.audit.log({
      actorId,
      action: 'category.delete',
      entity: 'Category',
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug },
    });
  }
}
