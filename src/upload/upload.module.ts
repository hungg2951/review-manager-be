import { Module } from '@nestjs/common';
import { ShopModule } from '../shop/shop.module.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';

@Module({
  imports: [ShopModule], 
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}