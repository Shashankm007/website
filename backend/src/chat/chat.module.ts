import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeService } from './knowledge.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, EmbeddingService, KnowledgeService],
  exports: [ChatService, KnowledgeService],
})
export class ChatModule {}
