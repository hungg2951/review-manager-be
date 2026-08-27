import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { checkSystemHealth } from './health/health-check';

async function bootstrap() {
  const PORT = process.env.PORT ?? 3000;

  // Run health checks for database dependencies
  await checkSystemHealth();

  // Initialize server
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  await app.listen(PORT);

  console.log(`🚀 Server running on port: ${PORT}`);
}

bootstrap().catch((error) => {
  console.error('❌ Server startup error:', error);
});
