import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ShopId } from '../common/decorators/shop-id.decorator.js';
import { ReviewImageService } from './review-image.service.js';
import type {
  CreateReviewImageDto,
  ReorderReviewImagesDto,
  UpdateReviewImageDto,
} from './review-image.dto.js';

@Controller('reviews/:reviewId/images')
export class ReviewImageController {
  constructor(private readonly reviewImageService: ReviewImageService) {}

  /**
   * GET /reviews/:reviewId/images
   */
  @Get()
  async findAll(@ShopId() shopId: string, @Param('reviewId') reviewId: string) {
    return this.reviewImageService.findAllByReview(shopId, reviewId);
  }

  /**
   * GET /reviews/:reviewId/images/:id
   */
  @Get(':id')
  async findOne(@ShopId() shopId: string, @Param('id') id: string) {
    return this.reviewImageService.findOne(shopId, id);
  }

  /**
   * POST /reviews/:reviewId/images
   * Body: { url, position? }
   */
  @Post()
  async create(
    @ShopId() shopId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: CreateReviewImageDto,
  ) {
    return this.reviewImageService.create(shopId, reviewId, dto);
  }

  /**
   * PATCH /reviews/:reviewId/images/reorder
   * Đặt trước ':id' để tránh bị match nhầm route.
   */
  @Patch('reorder')
  async reorder(
    @ShopId() shopId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReorderReviewImagesDto,
  ) {
    return this.reviewImageService.reorder(shopId, reviewId, dto);
  }

  /**
   * PATCH /reviews/:reviewId/images/:id
   */
  @Patch(':id')
  async update(
    @ShopId() shopId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewImageDto,
  ) {
    return this.reviewImageService.update(shopId, id, dto);
  }

  /**
   * DELETE /reviews/:reviewId/images/:id
   */
  @Delete(':id')
  async remove(@ShopId() shopId: string, @Param('id') id: string) {
    return this.reviewImageService.remove(shopId, id);
  }
}
