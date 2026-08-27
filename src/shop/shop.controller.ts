import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ShopService } from './shop.service.js';
import type { CreateShopDto, UpdateShopDto } from './shop.dto.js';

@Controller('shops')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  /**
   * GET /shops
   */
  @Get()
  async findAll() {
    return this.shopService.findAll();
  }

  /**
   * GET /shops/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.shopService.findOne(id);
  }

  /**
   * POST /shops
   * Body: { name, description?, id_shopify, client_id, secret_key }
   */
  @Post()
  async create(@Body() dto: CreateShopDto) {
    return this.shopService.create(dto);
  }

  /**
   * PATCH /shops/:id
   * Body: any subset of { name, description, id_shopify, client_id, secret_key }
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateShopDto) {
    return this.shopService.update(id, dto);
  }

  /**
   * DELETE /shops/:id
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.shopService.remove(id);
  }
}
