import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ShopId } from '../common/decorators/shop-id.decorator.js';
import { ReviewService } from './review.service.js';
import type { CreateReviewDto, UpdateReviewDto } from './review.dto.js';
import type { FindAllReviewsQuery } from './review.service.js';
import { CurrentUser } from '../common/decorators/user.decorator.js';
import type { JwtPayload } from '../common/decorators/user.decorator.js';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * GET /reviews?shopify_product_id=&status=&sync_status=
   * shopId lấy từ auth context (@ShopId), không nhận qua query nữa.
   */
  @Get()
  async findAll(@ShopId() shopId: string, @Query() query: FindAllReviewsQuery) {
    return this.reviewService.findAll(shopId, query);
  }

  /**
   * GET /reviews/:id
   */
  @Get(':id')
  async findOne(@ShopId() shopId: string, @Param('id') id: string) {
    return this.reviewService.findOne(shopId, id);
  }

  /**
   * POST /reviews
   * Body: { shopify_product_id, rating, status?, verified?,
   *         author_name?, author_email?, title?, body, source? }
   */
  @Post()
  async create(@ShopId() shopId: string, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(shopId, dto);
  }

  /**
   * PATCH /reviews/:id
   */
  @Patch(':id')
  async update(
    @ShopId() shopId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewService.update(shopId, id, dto);
  }

  /**
+  * POST /reviews/:id/resync
+  * Trigger lại sync mà không đổi nội dung review.
+  */
  @Post(':id/resync')
  async resync(@ShopId() shopId: string, @Param('id') id: string) {
    return this.reviewService.resync(shopId, id);
  }

  /**
   * DELETE /reviews/:id
   */
  @Delete(':id')
  async remove(@ShopId() shopId: string, @Param('id') id: string) {
    return this.reviewService.remove(shopId, id);
  }
}
