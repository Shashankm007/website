import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { SetUserRoleDto } from './dto/set-user-role.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('admin/users')
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: AdminUserQueryDto) {
    return this.users.adminList(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.users.adminFindById(id);
  }

  @Patch(':id/status')
  async setStatus(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: SetUserStatusDto) {
    const user = await this.users.adminSetStatus(id, dto.status);
    await this.audit.log({
      actorId,
      action: 'user.status.update',
      entity: 'User',
      entityId: id,
      metadata: { status: dto.status },
    });
    return user;
  }

  @Patch(':id/role')
  async setRole(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() dto: SetUserRoleDto) {
    const user = await this.users.adminSetRole(id, dto.role);
    await this.audit.log({
      actorId,
      action: 'user.role.update',
      entity: 'User',
      entityId: id,
      metadata: { role: dto.role },
    });
    return user;
  }
}
