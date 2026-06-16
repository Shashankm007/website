import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';

/** Public storefront catalog. All routes are anonymous-accessible. */
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List ACTIVE products as cards (search/filter/sort)' })
  @ApiOkResponse({ description: 'Paginated product cards' })
  findAll(@Query() query: ProductQueryDto) {
    return this.products.findAll(query);
  }

  // NOTE: must be declared before ':slug' so "featured" isn't treated as a slug.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('featured')
  @ApiOperation({ summary: 'Curated "star" products for the landing page (ordered)' })
  findFeatured() {
    return this.products.findFeatured();
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  @ApiOperation({ summary: 'Full product detail by slug + related products' })
  findBySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }
}
