export const REVIEW_SYNC_QUEUE = 'review-sync';

export enum ReviewSyncJobName {
  SYNC_REVIEW = 'sync-review', // tự quyết định create hay update dựa vào shopify_metaobject_id hiện có
  DELETE_REVIEW = 'delete-review',
  SYNC_IMAGE = 'sync-image', // upload ảnh lên Shopify Files rồi refresh field images trên metaobject cha
  DELETE_IMAGE = 'delete-image',
}

// TODO: đổi khớp đúng "Type" (handle) của Metaobject definition đã tạo trên Shopify Admin
export const SHOPIFY_REVIEW_METAOBJECT_TYPE =
  process.env.SHOPIFY_REVIEW_METAOBJECT_TYPE || 'review';

// TODO: đổi khớp đúng "Key" của từng field trong Metaobject definition trên Shopify Admin
export const REVIEW_METAOBJECT_FIELD_KEYS = {
  rating: 'rating',
  status: 'status',
  verified: 'verified',
  authorName: 'author_name',
  authorEmail: 'author_email',
  title: 'title',
  body: 'body',
  source: 'source',
  product: 'product', // field kiểu product_reference
  images: 'images', // field kiểu list.file_reference
} as const;

export const REVIEW_SYNC_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

export const PRODUCT_REVIEWS_METAFIELD_NAMESPACE = 'custom';
export const PRODUCT_REVIEWS_METAFIELD_KEY = 'reviews';