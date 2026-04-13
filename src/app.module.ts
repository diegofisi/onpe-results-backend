import { Module } from '@nestjs/common';
import { ExtrapolacionModule } from './extrapolacion/extrapolacion.module';

@Module({
  imports: [ExtrapolacionModule],
})
export class AppModule {}
