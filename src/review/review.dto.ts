import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum ReviewStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ReviewSource {
  MANUAL = 'manual',
  IMPORT = 'import',
}

export enum ReviewSyncStatus {
  NOT_SYNCED = 'not_synced',
  PENDING = 'pending',
  SYNCED = 'synced',
  SYNC_ERROR = 'sync_error',
}

/**
 * Body cho POST /reviews
 * shop_id KHÔNG có ở đây (lấy từ @ShopId). author_name/author_email lấy
 * trực tiếp từ body do client gửi lên.
 */
export class CreateReviewDto {
  @IsString()
  @MaxLength(255)
  shopify_product_id!: string; // GID đầy đủ, vd: gid://shopify/Product/1234567890

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  author_name?: string;

  @IsOptional()
  @IsEmail()
  author_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsEnum(ReviewSource)
  source?: ReviewSource;
}

/**
 * Body cho PATCH /reviews/:id
 */
export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  author_name?: string;

  @IsOptional()
  @IsEmail()
  author_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}

/**
 * Dùng nội bộ bởi sync worker (BullMQ) — không đi qua HTTP.
 */
export class UpdateReviewSyncStateDto {
  @IsEnum(ReviewSyncStatus)
  sync_status!: ReviewSyncStatus;

  @IsOptional()
  @IsString()
  shopify_metaobject_id?: string;

  @IsOptional()
  @IsString()
  shopify_metaobject_handle?: string;

  @IsOptional()
  @IsString()
  sync_error_message?: string;
}
