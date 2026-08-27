import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { checkSystemHealth } from './health/health-check';
import * as express from 'express';

async function bootstrap() {
  const PORT = process.env.PORT ?? 3000;

  // Run health checks for database dependencies
  await checkSystemHealth();

  // Initialize server
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Lưu lại raw body cho webhook routes (cần để verify HMAC chính xác,
  // vì chữ ký Shopify tính trên raw bytes, không phải JSON đã parse).
  app.use(
    '/webhooks',
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

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
  });

  await app.listen(PORT);

  console.log(`🚀 Server running on port: ${PORT}`);
}

bootstrap().catch((error) => {
  console.error('❌ Server startup error:', error);
});
