import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { ChatService } from './chat.service';
import { AdminChatQueryDto, AdminReplyDto, AdminUpdateChatDto, SendMessageDto } from './dto/chat.dto';

@ApiTags('chat')
@Controller()
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly audit: AuditService,
  ) {}

  /** Public chatbot endpoint (works for guests + logged-in users). */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('chat/message')
  send(@CurrentUser() user: AuthUser | undefined, @Body() dto: SendMessageDto) {
    return this.chat.sendMessage(user?.id, dto);
  }

  // --- Admin inbox ---------------------------------------------------------

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('admin/chats')
  list(@Query() query: AdminChatQueryDto) {
    return this.chat.adminList(query);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('admin/chats/:id')
  get(@Param('id') id: string) {
    return this.chat.adminGet(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('admin/chats/:id')
  async update(@Param('id') id: string, @Body() dto: AdminUpdateChatDto, @CurrentUser('id') actorId: string) {
    const conv = await this.chat.adminUpdate(id, dto);
    await this.audit.log({ actorId, action: 'chat.status.update', entity: 'ChatConversation', entityId: id, metadata: { status: dto.status } });
    return conv;
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('admin/chats/:id/reply')
  reply(@Param('id') id: string, @Body() dto: AdminReplyDto, @CurrentUser('id') actorId: string, @Req() req: Request) {
    void this.audit.log({ actorId, action: 'chat.reply', entity: 'ChatConversation', entityId: id, ip: req.ip });
    return this.chat.adminReply(id, dto);
  }
}
