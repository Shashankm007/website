import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

/** Time window for the analytics endpoint. */
export enum AnalyticsRange {
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
}

/** Query params for `GET /admin/analytics`. */
export class AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: AnalyticsRange, default: AnalyticsRange.THIRTY_DAYS })
  @IsOptional()
  @IsEnum(AnalyticsRange)
  range: AnalyticsRange = AnalyticsRange.THIRTY_DAYS;
}
