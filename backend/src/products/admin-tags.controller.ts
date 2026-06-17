import { Controller, Delete, Get, HttpCode, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ProductsService } from './products.service';

/** Admin-only tag management. RBAC enforced via @Roles(ADMIN). */
@ApiTags('admin/tags')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/tags')
export class AdminTagsController {
  constructor(
    private readonly products: ProductsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all tags with product counts' })
  list() {
    return this.products.listTagsAdmin();
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a tag (removes it from all products)' })
  async remove(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    const tag = await this.products.deleteTag(id);
    await this.audit.log({
      actorId,
      action: 'tag.delete',
      entity: 'Tag',
      entityId: tag.id,
      metadata: { name: tag.name, slug: tag.slug },
    });
  }
}
