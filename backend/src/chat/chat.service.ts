import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatRole, ChatStatus, Prisma } from '@prisma/client';
import { AppConfig } from '../config/configuration';
import { Paginated, paginate } from '../common/interfaces/api-response.interface';
import { sanitizePlain } from '../common/utils/sanitize';
import { PrismaService } from '../prisma/prisma.service';
import { AdminChatQueryDto, AdminReplyDto, AdminUpdateChatDto, SendMessageDto } from './dto/chat.dto';
import { BotAnswer, CHATBOT_SYSTEM_PROMPT, faqAnswer } from './faq';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly llm: AppConfig['chatbot'];

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.llm = config.get<AppConfig['chatbot']>('chatbot')!;
  }

  // --- Public chatbot ------------------------------------------------------

  /** Logs the user message, generates a bot reply, logs it, and returns the reply. */
  async sendMessage(userId: string | undefined, dto: SendMessageDto) {
    const content = sanitizePlain(dto.message).slice(0, 2000).trim();
    if (!content) throw new BadRequestException('Message is empty');

    let conversation = dto.conversationId
      ? await this.prisma.chatConversation.findUnique({ where: { id: dto.conversationId } })
      : null;
    if (!conversation) {
      conversation = await this.prisma.chatConversation.create({
        data: { userId: userId ?? null, visitorName: dto.name ? sanitizePlain(dto.name).slice(0, 120) : null },
      });
    }

    await this.prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: ChatRole.USER, content },
    });

    const { reply, needsHuman } = await this.generateReply(conversation.id, content);

    await this.prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: ChatRole.BOT, content: reply },
    });

    await this.prisma.chatConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        needsHuman: conversation.needsHuman || needsHuman,
        userId: conversation.userId ?? userId ?? undefined,
      },
    });

    return { conversationId: conversation.id, reply, needsHuman };
  }

  /** FAQ engine by default; optional OpenAI-compatible LLM when configured (falls back to FAQ). */
  private async generateReply(conversationId: string, message: string): Promise<BotAnswer> {
    const heuristic = faqAnswer(message);
    if (!this.llm.apiUrl) return heuristic;

    try {
      const history = await this.prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 12,
      });
      const messages = [
        { role: 'system', content: CHATBOT_SYSTEM_PROMPT },
        ...history.map((h) => ({ role: h.role === ChatRole.USER ? 'user' : 'assistant', content: h.content })),
      ];
      const res = await fetch(`${this.llm.apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.llm.apiKey ? { Authorization: `Bearer ${this.llm.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.llm.model || 'gpt-3.5-turbo',
          messages,
          temperature: 0.3,
          max_tokens: 220,
        }),
      });
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (res.ok && reply) return { reply, needsHuman: heuristic.needsHuman };
      this.logger.warn(`LLM returned no reply (status ${res.status}); using FAQ fallback`);
    } catch (e) {
      this.logger.warn(`LLM call failed, using FAQ fallback: ${(e as Error).message}`);
    }
    return heuristic;
  }

  // --- Admin inbox ---------------------------------------------------------

  async adminList(query: AdminChatQueryDto): Promise<Paginated<unknown>> {
    const { page, limit, skip } = query;
    const where: Prisma.ChatConversationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.needsHuman !== undefined ? { needsHuman: query.needsHuman } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          visitorName: true,
          status: true,
          needsHuman: true,
          lastMessageAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
          _count: { select: { messages: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { role: true, content: true, createdAt: true } },
        },
      }),
      this.prisma.chatConversation.count({ where }),
    ]);
    const rows = items.map(({ messages, ...c }) => ({ ...c, lastMessage: messages[0] ?? null }));
    return paginate(rows, total, page, limit);
  }

  async adminGet(id: string) {
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async adminUpdate(id: string, dto: AdminUpdateChatDto) {
    await this.ensureExists(id);
    return this.prisma.chatConversation.update({
      where: { id },
      data: {
        status: dto.status,
        // Clearing once an admin has actioned it.
        needsHuman: dto.status === ChatStatus.OPEN ? undefined : false,
      },
    });
  }

  /** Admin adds a reply to the conversation log (handled manually, e.g. via WhatsApp/email). */
  async adminReply(id: string, dto: AdminReplyDto) {
    await this.ensureExists(id);
    const message = await this.prisma.chatMessage.create({
      data: { conversationId: id, role: ChatRole.ADMIN, content: sanitizePlain(dto.message).slice(0, 2000) },
    });
    await this.prisma.chatConversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), needsHuman: false, status: ChatStatus.HANDLED },
    });
    return message;
  }

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.chatConversation.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Conversation not found');
  }
}
