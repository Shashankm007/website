import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Raw } from '../common/decorators/raw-response.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order from the current cart' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    return this.orders.createFromCart(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the current user’s orders' })
  async list(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.orders.listForUser(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the current user’s orders' })
  async getOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.orders.getForUser(userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a pending order' })
  async cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.orders.cancel(userId, id);
  }

  @Get(':id/invoice')
  @Raw()
  @ApiOperation({ summary: 'Download a PDF invoice (owner or admin)' })
  async invoice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const pdf = await this.orders.generateInvoicePdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${id}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  }
}
