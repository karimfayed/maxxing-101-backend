import { Module, type DynamicModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import type { AppConfig } from './config';
import { DreamMatchesModule } from './dream-matches/dream-matches.module';

@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return { module: AppModule, imports: [DreamMatchesModule.forRoot(config)] };
  }
}
