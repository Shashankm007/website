import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { WishlistItemEntity } from './entities/wishlist-item.entity';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's wishlist" })
  @ApiOkResponse({ type: WishlistItemEntity, isArray: true })
  list(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.wishlist.list(userId, query);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add a product to the wishlist (idempotent)' })
  @ApiParam({ name: 'productId', description: 'CUID of the product to add' })
  @ApiOkResponse({ type: WishlistItemEntity })
  add(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.wishlist.add(userId, productId);
  }

  @Delete(':productId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  @ApiParam({ name: 'productId', description: 'CUID of the product to remove' })
  remove(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.wishlist.remove(userId, productId);
  }
}
