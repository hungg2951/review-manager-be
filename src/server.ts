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

  const corsOptions = {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-shop-id'],
  };

  // ─── CORS cho App Proxy (/apps/*) — permissive ─────────────────────
  // Request đến từ storefront của bất kỳ shop nào đã cài app (domain
  // khác nhau tuỳ merchant). Bảo mật thực sự nằm ở verifyAppProxySignature()
  // trong controller, nên ở đây cho qua mọi origin.
  app.use(
    '/apps',
    cors({
      ...corsOptions,
      origin: true,
    }),
  );

  // ─── CORS strict cho phần còn lại (admin dashboard, API nội bộ...) ──
  app.use((req, res, next) => {
    if (req.path.startsWith('/apps')) {
      return next();  
    }
    return cors({
      ...corsOptions,
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${requestOrigin} is not allowed by CORS`));
        }
      },
    })(req, res, next);
  });

  await app.listen(PORT);

  console.log(`🚀 Server running on port: ${PORT}`);
}

bootstrap().catch((error) => {
  console.error('❌ Server startup error:', error);
});
