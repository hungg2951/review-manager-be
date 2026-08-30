import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  REVIEW_METAOBJECT_FIELD_KEYS,
  REVIEW_SYNC_QUEUE,
  ReviewSyncJobName,
  SHOPIFY_REVIEW_METAOBJECT_TYPE,
  PRODUCT_REVIEWS_METAFIELD_NAMESPACE,
  PRODUCT_REVIEWS_METAFIELD_KEY,
} from './review-sync.constants.js';
import type {
  DeleteImageJobData,
  DeleteReviewJobData,
  ShopifyGraphqlResponse,
  ShopifyUserError,
  SyncImageJobData,
  SyncReviewJobData,
} from './review-sync.types.js';
import { ReviewService } from '../review/review.service.js';
import { ReviewSyncStatus } from '../review/review.dto.js';
import { ReviewImageService } from '../review-image/review-image.service.js';
import { ShopifyAuthService } from '../shopify/shopify-auth.service.js';

@Processor(REVIEW_SYNC_QUEUE)
export class ReviewSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewSyncProcessor.name);

  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewImageService: ReviewImageService,
    private readonly shopifyAuth: ShopifyAuthService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ReviewSyncJobName.SYNC_REVIEW:
        return this.handleSyncReview(job.data as SyncReviewJobData);
      case ReviewSyncJobName.DELETE_REVIEW:
        return this.handleDeleteReview(job.data as DeleteReviewJobData);
      case ReviewSyncJobName.SYNC_IMAGE:
        return this.handleSyncImage(job.data as SyncImageJobData);
      case ReviewSyncJobName.DELETE_IMAGE:
        return this.handleDeleteImage(job.data as DeleteImageJobData);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  // ─── Shopify GraphQL helper (dùng lại ShopifyAuthService có sẵn) ────────

  private async graphqlRequest<T>(
    shopId: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const [url, accessToken] = await Promise.all([
      this.shopifyAuth.getGraphqlUrl(shopId),
      this.shopifyAuth.getAccessToken(shopId),
    ]);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const json = (await response.json()) as ShopifyGraphqlResponse<T>;

    if (!response.ok || json.errors?.length) {
      const message =
        json.errors?.map((e) => e.message).join('; ') || response.statusText;
      throw new Error(`Shopify GraphQL error: ${message}`);
    }

    return json.data as T;
  }

  private assertNoUserErrors(userErrors: ShopifyUserError[]): void {
    if (userErrors.length > 0) {
      throw new Error(userErrors.map((e) => e.message).join('; '));
    }
  }

  private toProductGid(productId: string): string {
    return productId.startsWith('gid://')
      ? productId
      : `gid://shopify/Product/${productId}`;
  }

  private toMetaobjectPublishStatus(reviewStatus: string): 'ACTIVE' | 'DRAFT' {
    return reviewStatus === 'published' ? 'ACTIVE' : 'DRAFT';
  }

  // ─── Review sync (metaobjectCreate / metaobjectUpdate) ──────────────────

  private async handleSyncReview({
    shopId,
    reviewId,
  }: SyncReviewJobData): Promise<void> {
    const review = await this.reviewService.findOne(shopId, reviewId);
    const images = await this.reviewImageService.findAllByReview(
      shopId,
      reviewId,
    );
    const syncedImageFileIds = images
      .filter((img) => img.shopify_file_id)
      .map((img) => img.shopify_file_id as string);

    const fields = this.buildMetaobjectFields(review, syncedImageFileIds);

    try {
      if (review.shopify_metaobject_id) {
        await this.updateMetaobject(
          review.shop_id,
          review.shopify_metaobject_id,
          fields,
          this.toMetaobjectPublishStatus(review.status),
        );

        await this.addReviewToProductMetafield(
          review.shop_id,
          this.toProductGid(review.shopify_product_id),
          review.shopify_metaobject_id,
        );

        await this.reviewService.updateSyncState(reviewId, {
          sync_status: ReviewSyncStatus.SYNCED,
        });
      } else {
        const metaobject = await this.createMetaobject(
          review.shop_id,
          fields,
          this.toMetaobjectPublishStatus(review.status),
        );

        await this.addReviewToProductMetafield(
          review.shop_id,
          this.toProductGid(review.shopify_product_id),
          metaobject.id,
        );
        await this.reviewService.updateSyncState(reviewId, {
          sync_status: ReviewSyncStatus.SYNCED,
          shopify_metaobject_id: metaobject.id,
          shopify_metaobject_handle: metaobject.handle,
        });
      }
    } catch (error: any) {
      this.logger.error(`Sync review "${reviewId}" failed: ${error.message}`);
      await this.reviewService.updateSyncState(reviewId, {
        sync_status: ReviewSyncStatus.SYNC_ERROR,
        sync_error_message: error.message,
      });
      throw error; // ném lại để BullMQ tự retry theo attempts/backoff đã cấu hình ở producer
    }
  }

  private buildMetaobjectFields(
    review: any,
    syncedImageFileIds: string[],
  ): Array<{ key: string; value: string }> {
    const fields: Array<{ key: string; value: string }> = [
      {
        key: REVIEW_METAOBJECT_FIELD_KEYS.rating,
        value: String(review.rating),
      },
      { key: REVIEW_METAOBJECT_FIELD_KEYS.status, value: review.status },
      {
        key: REVIEW_METAOBJECT_FIELD_KEYS.verified,
        value: String(review.verified),
      },
      { key: REVIEW_METAOBJECT_FIELD_KEYS.body, value: review.body },
      { key: REVIEW_METAOBJECT_FIELD_KEYS.source, value: review.source },
      {
        key: REVIEW_METAOBJECT_FIELD_KEYS.product,
        value: this.toProductGid(review.shopify_product_id),
      },
      {
        key: REVIEW_METAOBJECT_FIELD_KEYS.createdAt,
        value: new Date(review.created_at).toISOString(),
      }
    ];

    if (review.author_name) {
      fields.push({
        key: REVIEW_METAOBJECT_FIELD_KEYS.authorName,
        value: review.author_name,
      });
    }
    if (review.author_email) {
      fields.push({
        key: REVIEW_METAOBJECT_FIELD_KEYS.authorEmail,
        value: review.author_email,
      });
    }
    if (review.title) {
      fields.push({
        key: REVIEW_METAOBJECT_FIELD_KEYS.title,
        value: review.title,
      });
    }
    // Chỉ gán field images nếu đã có ít nhất 1 ảnh sync xong; field
    // list.file_reference của Shopify nhận value là JSON array các GID.
    if (syncedImageFileIds.length > 0) {
      fields.push({
        key: REVIEW_METAOBJECT_FIELD_KEYS.images,
        value: JSON.stringify(syncedImageFileIds),
      });
    }

    return fields;
  }

  private async createMetaobject(
    shopId: string,
    fields: Array<{ key: string; value: string }>,
    status: 'ACTIVE' | 'DRAFT',
  ): Promise<{ id: string; handle: string }> {
    const mutation = `
      mutation CreateReviewMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id handle }
          userErrors { field message }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      metaobjectCreate: {
        metaobject: { id: string; handle: string } | null;
        userErrors: ShopifyUserError[];
      };
    }>(shopId, mutation, {
      metaobject: {
        type: SHOPIFY_REVIEW_METAOBJECT_TYPE,
        fields,
        capabilities: { publishable: { status } },
      },
    });

    this.assertNoUserErrors(data.metaobjectCreate.userErrors);
    if (!data.metaobjectCreate.metaobject) {
      throw new Error('metaobjectCreate returned no data');
    }

    return data.metaobjectCreate.metaobject;
  }

  private async updateMetaobject(
    shopId: string,
    metaobjectId: string,
    fields: Array<{ key: string; value: string }>,
    status: 'ACTIVE' | 'DRAFT',
  ): Promise<{ id: string; handle: string }> {
    const mutation = `
      mutation UpdateReviewMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject { id handle }
          userErrors { field message }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      metaobjectUpdate: {
        metaobject: { id: string; handle: string } | null;
        userErrors: ShopifyUserError[];
      };
    }>(shopId, mutation, {
      id: metaobjectId,
      metaobject: { fields, capabilities: { publishable: { status } } },
    });

    this.assertNoUserErrors(data.metaobjectUpdate.userErrors);
    if (!data.metaobjectUpdate.metaobject) {
      throw new Error('metaobjectUpdate returned no data');
    }

    return data.metaobjectUpdate.metaobject;
  }

  /**
   * Đọc metafield "reviews" hiện có trên product, thêm GID metaobject review
   * mới vào (nếu chưa có), GIỮ NGUYÊN các GID review khác đã có sẵn.
   */
  private async addReviewToProductMetafield(
    shopId: string,
    productGid: string,
    reviewMetaobjectGid: string,
  ): Promise<void> {
    const query = `
    query GetProductReviewsMetafield($id: ID!, $namespace: String!, $key: String!) {
      product(id: $id) {
        metafield(namespace: $namespace, key: $key) {
          value
        }
      }
    }
  `;

    const data = await this.graphqlRequest<{
      product: { metafield: { value: string } | null } | null;
    }>(shopId, query, {
      id: productGid,
      namespace: PRODUCT_REVIEWS_METAFIELD_NAMESPACE,
      key: PRODUCT_REVIEWS_METAFIELD_KEY,
    });

    const existingIds: string[] = data.product?.metafield?.value
      ? JSON.parse(data.product.metafield.value)
      : [];

    if (existingIds.includes(reviewMetaobjectGid)) {
      return; // đã có sẵn, không cần ghi lại
    }

    const updatedIds = [...existingIds, reviewMetaobjectGid];

    const mutation = `
    mutation SetProductReviewsMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }
  `;

    const result = await this.graphqlRequest<{
      metafieldsSet: {
        metafields: Array<{ id: string }>;
        userErrors: ShopifyUserError[];
      };
    }>(shopId, mutation, {
      metafields: [
        {
          ownerId: productGid,
          namespace: PRODUCT_REVIEWS_METAFIELD_NAMESPACE,
          key: PRODUCT_REVIEWS_METAFIELD_KEY,
          type: 'list.metaobject_reference',
          value: JSON.stringify(updatedIds),
        },
      ],
    });

    this.assertNoUserErrors(result.metafieldsSet.userErrors);
  }

  /**
   * Đọc metafield "reviews" hiện có trên product, gỡ đúng GID metaobject vừa
   * xoá ra khỏi list, GIỮ NGUYÊN các GID review khác.
   */
  private async removeReviewFromProductMetafield(
    shopId: string,
    productGid: string,
    reviewMetaobjectGid: string,
  ): Promise<void> {
    const query = `
    query GetProductReviewsMetafield($id: ID!, $namespace: String!, $key: String!) {
      product(id: $id) {
        metafield(namespace: $namespace, key: $key) {
          value
        }
      }
    }
  `;

    const data = await this.graphqlRequest<{
      product: { metafield: { value: string } | null } | null;
    }>(shopId, query, {
      id: productGid,
      namespace: PRODUCT_REVIEWS_METAFIELD_NAMESPACE,
      key: PRODUCT_REVIEWS_METAFIELD_KEY,
    });

    const existingIds: string[] = data.product?.metafield?.value
      ? JSON.parse(data.product.metafield.value)
      : [];

    if (!existingIds.includes(reviewMetaobjectGid)) {
      return; // đã không có trong list, khỏi cần ghi lại
    }

    const updatedIds = existingIds.filter((id) => id !== reviewMetaobjectGid);

    const mutation = `
    mutation SetProductReviewsMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }
  `;

    const result = await this.graphqlRequest<{
      metafieldsSet: {
        metafields: Array<{ id: string }>;
        userErrors: ShopifyUserError[];
      };
    }>(shopId, mutation, {
      metafields: [
        {
          ownerId: productGid,
          namespace: PRODUCT_REVIEWS_METAFIELD_NAMESPACE,
          key: PRODUCT_REVIEWS_METAFIELD_KEY,
          type: 'list.metaobject_reference',
          value: JSON.stringify(updatedIds),
        },
      ],
    });

    this.assertNoUserErrors(result.metafieldsSet.userErrors);
  }

  // ─── Review delete (metaobjectDelete) ────────────────────────────────────

  private async handleDeleteReview({
    shopId,
    shopifyMetaobjectId,
    shopifyProductId,
  }: DeleteReviewJobData): Promise<void> {
    const mutation = `
      mutation DeleteReviewMetaobject($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      metaobjectDelete: {
        deletedId: string | null;
        userErrors: ShopifyUserError[];
      };
    }>(shopId, mutation, { id: shopifyMetaobjectId });

    try {
      this.assertNoUserErrors(data.metaobjectDelete.userErrors);
      await this.removeReviewFromProductMetafield(
        shopId,
        this.toProductGid(shopifyProductId),
        shopifyMetaobjectId,
      );
    } catch (error: any) {
      this.logger.error(
        `Delete metaobject "${shopifyMetaobjectId}" failed: ${error.message}`,
      );
      throw error;
    }
  }

  // ─── Image sync — fileCreate trực tiếp từ URL, không cần staged upload ──
  // Shopify's fileCreate hỗ trợ `originalSource` là URL công khai, Shopify sẽ
  // tự tải ảnh về — không cần luồng stagedUploadsCreate + upload binary.

  private async handleSyncImage({
    shopId,
    imageId,
  }: SyncImageJobData): Promise<void> {
    const image = await this.reviewImageService.findOne(shopId, imageId);

    try {
      const shopifyFileId = await this.createFileFromUrl(
        image.shop_id,
        image.url,
      );

      await this.reviewImageService.updateSyncState(imageId, {
        sync_status: 'synced',
        shopify_file_id: shopifyFileId,
      });

      // Ảnh vừa có file id -> đồng bộ lại field images trên metaobject review cha
      await this.handleSyncReview({ shopId, reviewId: image.review_id });
    } catch (error: any) {
      this.logger.error(`Sync image "${imageId}" failed: ${error.message}`);
      await this.reviewImageService.updateSyncState(imageId, {
        sync_status: 'sync_error',
        sync_error_message: error.message,
      });
      throw error;
    }
  }

  private async createFileFromUrl(
    shopId: string,
    url: string,
  ): Promise<string> {
    const mutation = `
      mutation CreateReviewImageFile($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id }
          userErrors { field message }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      fileCreate: {
        files: Array<{ id: string }>;
        userErrors: ShopifyUserError[];
      };
    }>(shopId, mutation, {
      files: [{ originalSource: url, contentType: 'IMAGE' }],
    });

    this.assertNoUserErrors(data.fileCreate.userErrors);
    if (data.fileCreate.files.length === 0) {
      throw new Error('fileCreate returned no file');
    }

    return data.fileCreate.files[0].id;
  }

  // ─── Image delete (fileDelete) ───────────────────────────────────────────

  private async handleDeleteImage({
    shopId,
    shopifyFileId,
  }: DeleteImageJobData): Promise<void> {
    const mutation = `
      mutation DeleteReviewImageFile($fileIds: [ID!]!) {
        fileDelete(fileIds: $fileIds) {
          deletedFileIds
          userErrors { field message }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      fileDelete: { deletedFileIds: string[]; userErrors: ShopifyUserError[] };
    }>(shopId, mutation, { fileIds: [shopifyFileId] });

    try {
      this.assertNoUserErrors(data.fileDelete.userErrors);
    } catch (error: any) {
      this.logger.error(
        `Delete file "${shopifyFileId}" failed: ${error.message}`,
      );
      throw error;
    }
  }
}
