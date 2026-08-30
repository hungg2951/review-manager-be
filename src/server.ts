import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { AppModule } from './app.module';
import { checkSystemHealth } from './health/health-check';

async function bootstrap() {
  const PORT = process.env.PORT ?? 3000;

  await checkSystemHealth();

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // ─── CORS cho App Proxy (/apps/*) ─────────────────────────────────
  // Request tới các route này đến từ storefront của BẤT KỲ shop nào đã
  // cài app (domain khác nhau tuỳ merchant, không thể whitelist cứng).
  // Bảo mật thực sự nằm ở verifyAppProxySignature() trong controller,
  // nên ở đây chỉ cần cho qua để browser không tự chặn trước khi request
  // kịp tới hàm verify signature.
  app.use(
    '/apps',
    cors({
      origin: true, // reflect lại đúng Origin của request, cho phép mọi domain
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-shop-id'],
    }),
  );

  // ─── CORS strict cho phần còn lại (admin dashboard, API nội bộ...) ─
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
