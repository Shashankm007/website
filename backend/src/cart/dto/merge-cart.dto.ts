import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Body for `POST /cart/merge` — fold a guest cart into the logged-in user's cart. */
export class MergeCartDto {
  @ApiProperty({ description: 'The guest cart token previously returned as CartView.token.' })
  @IsString()
  guestToken!: string;
}
