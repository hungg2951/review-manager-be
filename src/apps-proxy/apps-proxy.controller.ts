import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Body } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { ShopifyOAuthService } from '../shopify/shopify-oauth.service.js';
import { ShopService } from '../shop/shop.service.js';
import { ReviewService } from '../review/review.service.js';
import { ReviewImageService } from '../review-image/review-image.service.js';
import { UploadService } from '../upload/upload.service.js';
import { ReviewSource, ReviewSyncStatus } from '../review/review.dto.js';

interface SubmitReviewBody {
  shopify_product_id: string;
  rating: string;
  author_name?: string;
  author_email?: string;
  title?: string;
  body: string;
}

@Public()
@Controller('apps/reviews')
export class AppsProxyController {
  constructor(
    private readonly oauthService: ShopifyOAuthService,
    private readonly shopService: ShopService,
    private readonly reviewService: ReviewService,
    private readonly reviewImageService: ReviewImageService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * POST /apps/reviews/submit
   * Gọi qua App Proxy: https://{shop}/apps/reviews/submit
   * Khách hàng tự gửi review từ storefront — không cần đăng nhập.
   * Query params đã được Shopify tự thêm & ký (shop, signature, timestamp...).
   */
  @Post('submit')
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: memoryStorage(),
      limits: { files: 5, fileSize: 10 * 1024 * 1024 },
    }),
  )
  async submitReview(
    @Query() query: Record<string, string>,
    @Body() body: SubmitReviewBody,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!this.oauthService.verifyAppProxySignature(query)) {
      throw new UnauthorizedException('Invalid proxy signature');
    }

    const shopDomain = query.shop;
    if (!shopDomain) {
      throw new BadRequestException('Missing shop parameter');
    }

    const shop = await this.shopService.findByShopifyDomain(shopDomain);
    if (!shop) {
      throw new BadRequestException('Shop not found or inactive');
    }

    const rating = Number(body.rating);
    if (!body.shopify_product_id || !body.body || !rating || rating < 1 || rating > 5) {
      throw new BadRequestException('Missing or invalid required fields');
    }

    // Review từ khách luôn ở trạng thái "pending" — chờ merchant duyệt
    // trước khi hiển thị public, tránh spam/nội dung xấu.
    const review = await this.reviewService.create(shop.id, {
      shopify_product_id: body.shopify_product_id,
      rating,
      body: body.body,
      title: body.title || undefined,
      author_name: body.author_name || undefined,
      author_email: body.author_email || undefined,
      status: 'published' as any,
      verified: true,
      source: ReviewSource.STOREFRONT,
    });

    // Upload ảnh kèm theo (nếu có), gắn vào review vừa tạo
    if (files?.length) {
      const urls = await this.uploadService.saveImages(shop.id, files);
      for (let i = 0; i < urls.length; i++) {
        await this.reviewImageService.create(shop.id, review.id, {
          url: urls[i],
          position: i,
        });
      }
    }

    return { success: true, message: 'Review submitted for approval' };
  }
}