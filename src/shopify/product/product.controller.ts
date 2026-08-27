import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Patch,
    Query
} from '@nestjs/common';
import { ShopId } from '../../common/decorators/shop-id.decorator.js';
import type { UpdateProductInput } from './product.service';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async getProducts(
    @ShopId() shopId: string,
    @Query('limit') limit?: string,
    @Query('after') after?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;

    return this.productService.getProducts(shopId, {
      limit:
        parsedLimit && !Number.isNaN(parsedLimit) ? parsedLimit : undefined,
      after,
    });
  }

  @Get('search')
  async getProductByTitle(
    @ShopId() shopId: string,
    @Query('title') title: string,
  ) {
    return this.productService.getProductByTitle(shopId, title);
  }

  @Get(':id')
  async getProductById(@ShopId() shopId: string, @Param('id') id: string) {
    const product = await this.productService.getProductById(shopId, id);

    if (!product) {
      throw new NotFoundException(`No product found with id "${id}"`);
    }

    return product;
  }

  @Patch(':id')
  async updateProduct(
    @ShopId() shopId: string,
    @Param('id') id: string,
    @Body() body: UpdateProductInput,
  ) {
    return this.productService.updateProduct(shopId, id, body);
  }

  /**
   * GET /products/:id/images
   * Dedicated endpoint for the image-management dialog — returns reliable,
   * deletable MediaImage GIDs via REST. Call this only when the user opens
   * the image manager for a specific product.
   */
  @Get(':id/images')
  async getProductImages(@ShopId() shopId: string, @Param('id') id: string) {
    return this.productService.getProductImagesViaRest(shopId, id);
  }
}
