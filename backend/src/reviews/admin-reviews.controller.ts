import { Controller, Ip, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ReviewsService } from './reviews.service';

@ApiTags('admin/reviews')
@Roles(Role.ADMIN)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly audit: AuditService,
  ) {}

  /** Approve a (previously hidden) review and recompute the product aggregate. */
  @Patch(':id/approve')
  async approve(@CurrentUser('id') actorId: string, @Param('id') id: string, @Ip() ip: string) {
    const review = await this.reviews.setApproval(id, true);
    await this.audit.log({
      actorId,
      action: 'review.approve',
      entity: 'Review',
      entityId: id,
      metadata: { productId: review.productId },
      ip,
    });
    return review;
  }
}
