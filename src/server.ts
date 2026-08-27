import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { checkSystemHealth } from './health/health-check';

async function bootstrap() {
  const PORT = process.env.PORT ?? 3000;

  // Run health checks for database dependencies
  await checkSystemHealth();

  // Initialize server — rawBody: true để NestJS tự lưu raw body,
  // dùng cho verify HMAC webhook mà không cần tự chèn middleware Express
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${requestOrigin} is not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-shop-id'],
  });

  await app.listen(PORT);

  console.log(`🚀 Server running on port: ${PORT}`);
}

bootstrap().catch((error) => {
  console.error('❌ Server startup error:', error);
});
