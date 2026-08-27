import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ShopId } from '../common/decorators/shop-id.decorator.js';
import { UploadService } from './upload.service.js';

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /uploads/images
   * multipart/form-data:
   *   - files: 1-10 file ảnh (JPEG/PNG/WEBP/HEIC)
   * shopId lấy từ auth context (@ShopId), không nhận qua body nữa.
   */
  @Post('images')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: {
        files: 10,
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadImages(
    @ShopId() shopId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const urls = await this.uploadService.saveImages(shopId, files);
    return { urls };
  }
}
