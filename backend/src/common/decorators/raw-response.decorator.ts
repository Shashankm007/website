import { SetMetadata } from '@nestjs/common';
import { RAW_RESPONSE_KEY } from '../interceptors/transform.interceptor';

/** Opt a route out of the success-envelope wrapping (webhooks, file streams). */
export const Raw = () => SetMetadata(RAW_RESPONSE_KEY, true);
