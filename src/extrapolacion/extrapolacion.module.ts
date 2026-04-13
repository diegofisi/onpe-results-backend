import { Module } from '@nestjs/common';
import { OnpeModule } from '../onpe/onpe.module';
import { ExtrapolacionService } from './extrapolacion.service';
import { ExtrapolacionController } from './extrapolacion.controller';

@Module({
  imports: [OnpeModule],
  providers: [ExtrapolacionService],
  controllers: [ExtrapolacionController],
})
export class ExtrapolacionModule {}
