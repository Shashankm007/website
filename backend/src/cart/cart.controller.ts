import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { CartContext, CartService } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** Build the cart context from the principal (if any) and the x-cart-token header. */
  private ctx(user: AuthUser | undefined, req: Request): CartContext {
    return { userId: user?.id, guestToken: req.header('x-cart-token') ?? undefined };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  getCart(@CurrentUser() user: AuthUser | undefined, @Req() req: Request) {
    return this.cart.getCart(this.ctx(user, req));
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('items')
  addItem(@CurrentUser() user: AuthUser | undefined, @Req() req: Request, @Body() dto: AddItemDto) {
    return this.cart.addItem(this.ctx(user, req), dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('items/:id')
  updateItem(
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.cart.updateItem(this.ctx(user, req), id, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete('items/:id')
  removeItem(@CurrentUser() user: AuthUser | undefined, @Req() req: Request, @Param('id') id: string) {
    return this.cart.removeItem(this.ctx(user, req), id);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete()
  clear(@CurrentUser() user: AuthUser | undefined, @Req() req: Request) {
    return this.cart.clear(this.ctx(user, req));
  }

  /** Merge a guest cart into the authenticated user's cart (auth required). */
  @HttpCode(200)
  @Post('merge')
  merge(@CurrentUser('id') userId: string, @Body() dto: MergeCartDto) {
    return this.cart.mergeGuestIntoUser(userId, dto.guestToken);
  }
}
