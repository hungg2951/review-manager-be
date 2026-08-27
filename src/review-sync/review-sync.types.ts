export interface SyncReviewJobData {
  shopId: string;
  reviewId: string;
}

export interface DeleteReviewJobData {
  shopId: string;
  shopifyMetaobjectId: string;
  shopifyProductId: string;
}

export interface SyncImageJobData {
  shopId: string;
  imageId: string;
}

export interface DeleteImageJobData {
  shopId: string;
  shopifyFileId: string;
}

export interface ShopifyUserError {
  field: string[];
  message: string;
}

export interface ShopifyGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}