import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ShopService } from '../shop/shop.service.js';

interface CloudinaryUploadResponse {
  secure_url?: string;
  public_id?: string;
}

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

// Magic bytes cho các định dạng ảnh phổ biến từ khách hàng (điện thoại
// thường xuất HEIC/PNG, không chỉ JPEG).
const IMAGE_SIGNATURES: Array<{
  mimetype: string;
  matches: (buf: Buffer) => boolean;
}> = [
  {
    mimetype: 'image/jpeg',
    matches: (b) =>
      b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mimetype: 'image/png',
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47,
  },
  {
    mimetype: 'image/webp',
    matches: (b) =>
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    mimetype: 'image/heic',
    matches: (b) =>
      b.length >= 12 &&
      b.toString('ascii', 4, 8) === 'ftyp' &&
      /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(b.toString('ascii', 8, 12)),
  },
];

@Injectable()
export class UploadService {
  constructor(private readonly shopService: ShopService) {}

  /**
   * Upload ảnh cho 1 shop cụ thể. shopId giờ lấy từ @ShopId() decorator ở
   * controller (auth context) — không còn tin giá trị client tự gửi.
   * Vẫn gọi ShopService.findOne để đảm bảo shop trong token chưa bị xoá.
   */
  async saveImages(
    shopId: string,
    files: Express.Multer.File[],
  ): Promise<string[]> {
    await this.shopService.findOne(shopId); // 404 nếu shop không còn tồn tại

    if (!files?.length) {
      throw new BadRequestException('At least one image is required');
    }
    if (files.length > 10) {
      throw new BadRequestException('A review can contain at most 10 images');
    }

    for (const file of files) {
      const detectedType = this.detectImageType(file);
      if (!detectedType) {
        throw new BadRequestException(
          `File "${file.originalname}" is not a supported image type (JPEG, PNG, WEBP, HEIC only)`,
        );
      }
    }

    const config = this.getCloudinaryConfig();
    const urls: string[] = [];

    for (const file of files) {
      const uploaded = await this.uploadToCloudinary(shopId, file, config);
      if (!uploaded.secure_url) {
        throw new ServiceUnavailableException(
          'Cloudinary did not return a secure image URL',
        );
      }
      urls.push(uploaded.secure_url);
    }

    return urls;
  }

  private async uploadToCloudinary(
    shopId: string,
    file: Express.Multer.File,
    config: CloudinaryConfig,
  ): Promise<CloudinaryUploadResponse> {
    const timestamp = Math.floor(Date.now() / 1000);
    const baseFolder = process.env.CLOUDINARY_FOLDER || 'reviews';
    const folder = `${baseFolder}/${shopId}`;
    const signature = this.createSignature(
      { folder, timestamp: String(timestamp) },
      config.apiSecret,
    );

    const form = new FormData();
    const imageBuffer = new ArrayBuffer(file.buffer.byteLength);
    new Uint8Array(imageBuffer).set(file.buffer);
    form.append(
      'file',
      new Blob([imageBuffer], { type: file.mimetype }),
      file.originalname || 'image',
    );
    form.append('api_key', config.apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', folder);
    form.append('signature', signature);

    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
        { method: 'POST', body: form },
      );
    } catch {
      throw new ServiceUnavailableException(
        'Could not connect to Cloudinary upload API',
      );
    }

    let data: CloudinaryUploadResponse & { error?: { message?: string } } = {};
    try {
      data = (await response.json()) as typeof data;
    } catch {
      // Keep the generic HTTP error below when Cloudinary returns no JSON.
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        data.error?.message ||
          `Cloudinary upload failed with HTTP ${response.status}`,
      );
    }

    return data;
  }

  private createSignature(
    params: Record<string, string>,
    apiSecret: string,
  ): string {
    const serialized = Object.entries(params)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return createHash('sha1').update(`${serialized}${apiSecret}`).digest('hex');
  }

  private getCloudinaryConfig(): CloudinaryConfig {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Cloudinary upload is not configured on the server',
      );
    }
    return { cloudName, apiKey, apiSecret };
  }

  private detectImageType(file: Express.Multer.File): string | null {
    const signature = IMAGE_SIGNATURES.find((sig) => sig.matches(file.buffer));
    return signature?.mimetype ?? null;
  }
}
