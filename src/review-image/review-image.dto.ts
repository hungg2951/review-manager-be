import { IsInt, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

/**
 * Body cho POST /reviews/:reviewId/images
 * shop_id lấy từ review cha (service tự điền), không nhận trực tiếp từ client
 * để tránh trường hợp client gửi sai shop_id khác với review.
 */
export class CreateReviewImageDto {
  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/**
 * Body cho PATCH /reviews/:reviewId/images/:id
 */
export class UpdateReviewImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/**
 * Dùng nội bộ bởi sync worker để cập nhật trạng thái sync ảnh sau khi
 * upload lên Shopify Files (stagedUploadsCreate + fileCreate).
 */
export class UpdateReviewImageSyncStateDto {
  @IsString()
  sync_status!: 'not_synced' | 'pending' | 'synced' | 'sync_error';

  @IsOptional()
  @IsString()
  shopify_file_id?: string;

  @IsOptional()
  @IsString()
  sync_error_message?: string;
}

/**
 * Body cho PATCH /reviews/:reviewId/images/reorder
 * Cập nhật lại thứ tự hiển thị hàng loạt.
 */
export class ReorderReviewImagesDto {
  @IsUUID('4', { each: true })
  ordered_ids!: string[];
}