import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './app-setup';
import { AppModule } from './app.module';
import { loadConfig } from './config';
import { loadEnv } from './load-env';

async function bootstrap(): Promise<void> {
  const config = loadConfig(loadEnv());
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), { bodyParser: false });
  configureApp(app, config);
  await app.listen(config.port);
}

void bootstrap();
