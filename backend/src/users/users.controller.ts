import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser('id') userId: string) {
    return this.users.getProfile(userId);
  }

  @Patch('me')
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(userId, dto);
  }

  @Get('me/addresses')
  listAddresses(@CurrentUser('id') userId: string) {
    return this.users.listAddresses(userId);
  }

  @Post('me/addresses')
  addAddress(@CurrentUser('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.users.addAddress(userId, dto);
  }

  @Patch('me/addresses/:id')
  updateAddress(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.users.updateAddress(userId, id, dto);
  }

  @Delete('me/addresses/:id')
  @HttpCode(204)
  deleteAddress(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.users.deleteAddress(userId, id);
  }

  @Post('me/addresses/:id/default')
  setDefaultAddress(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.users.setDefaultAddress(userId, id);
  }
}
