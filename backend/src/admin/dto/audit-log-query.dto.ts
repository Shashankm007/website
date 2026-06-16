import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

/** Query params for `GET /admin/audit-logs` (paginated + optional filters). */
export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by entity name, e.g. "Product".' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({ description: 'Filter by the acting user id.' })
  @IsOptional()
  @IsString()
  actorId?: string;
}
