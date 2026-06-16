import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Public list of approved reviews for a product. */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('products/:productId/reviews')
  listForProduct(@Param('productId') productId: string, @Query() query: PaginationQueryDto) {
    return this.reviews.listForProduct(productId, query);
  }

  /** Whether the current (authenticated) user may review a product. */
  @Get('reviews/eligibility/:productId')
  eligibility(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.reviews.getEligibility(userId, productId);
  }

  /** Create a review for a product (verified buyers only, one per user per product). */
  @Post('reviews')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(userId, dto);
  }

  /** Update an owned review. */
  @Patch('reviews/:id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviews.update(userId, id, dto);
  }

  /** Delete a review (owner or ADMIN). */
  @Delete('reviews/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.reviews.remove(user, id);
  }
}
