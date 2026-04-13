import { Module } from '@nestjs/common';
import { OnpeService } from './onpe.service';

@Module({
  providers: [OnpeService],
  exports: [OnpeService],
})
export class OnpeModule {}
