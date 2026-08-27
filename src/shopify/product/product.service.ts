import { Injectable } from '@nestjs/common';
import { ShopifyAuthService } from '../shopify-auth.service';

export interface GetProductsParams {
  /** Number of products to return. Defaults to 10. */
  limit?: number;
  /** Cursor to fetch the next page (value comes from the previous page's `endCursor`). */
  after?: string;
}

export interface UpdateProductInput {
  description?: string;
  metaDescription?: string;
  shortDescription?: string;
  designNumber?: string;
  sizeChartPageId?: string; // GID, vd: gid://shopify/OnlineStorePage/123
  mixAndMatchProductIds?: string[]; // mảng GID product
}

export interface DuplicateProductOptions {
  /** Tiêu đề cho sản phẩm mới. Mặc định: "Copy of <tên cũ>". */
  newTitle?: string;
}

@Injectable()
export class ProductService {
  constructor(private readonly authService: ShopifyAuthService) {}

  /**
   * Fetch products from Shopify Admin GraphQL API, sorted by newest created first.
   * Supports cursor-based pagination (limit + after).
   * Always returns an array (empty array if there are no products).
   */
  async getProducts(
    shopId: string,
    params: GetProductsParams = {},
  ): Promise<any> {
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const after = params.after;

    const token = await this.authService.getAccessToken(shopId);
    const graphqlUrl = await this.authService.getGraphqlUrl(shopId);

    const query = `
    query GetProducts($first: Int!, $after: String, $sortKey: ProductSortKeys!, $reverse: Boolean!) {
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
        edges {
          cursor
          node {
            id
            title
            handle
            status
            vendor
            productType
            createdAt
            media(first: 250) {
              edges {
                node {
                  ... on MediaImage {
                    id
                    image {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
          startCursor
        }
      }
    }
  `;

    const variables = {
      first: limit,
      after: after || null,
      sortKey: 'CREATED_AT',
      reverse: true,
    };

    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ProductService] Failed to query GraphQL API (HTTP ${response.status}): ${errorText}`,
        );
        throw new Error(
          `Shopify GraphQL API request failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const result = await response.json();

      if (result.errors) {
        console.error(
          '[ProductService] GraphQL errors returned:',
          JSON.stringify(result.errors, null, 2),
        );
        throw new Error(
          `Shopify GraphQL query errors: ${JSON.stringify(result.errors)}`,
        );
      }

      const edges = result?.data?.products?.edges || [];
      const pageInfo = result?.data?.products?.pageInfo || {
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: null,
        startCursor: null,
      };

      const products = edges.map((edge: any) => {
        const mediaEdges = edge.node.media?.edges || [];
        const images = mediaEdges
          .filter((m: any) => m.node?.id && m.node?.image)
          .map((m: any) => ({
            id: m.node.id,
            url: m.node.image.url,
            altText: m.node.image.altText,
          }));

        const { media, ...rest } = edge.node;
        return { ...rest, images };
      });

      return {
        products,
        pageInfo,
      };
    } catch (error: any) {
      console.error(`[ProductService] getProducts error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch a single product by its Shopify GID (e.g. gid://shopify/Product/123456789)
   */
  async getProductById(shopId: string, id: string): Promise<any> {
    const token = await this.authService.getAccessToken(shopId);
    const graphqlUrl = await this.authService.getGraphqlUrl(shopId);

    const query = `
      query GetProductById($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          status
          vendor
          productType
          createdAt
          descriptionHtml
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price
                sku
              }
            }
          }
        }
      }
    `;

    const variables = { id };

    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ProductService] Failed to query GraphQL API (HTTP ${response.status}): ${errorText}`,
        );
        throw new Error(
          `Shopify GraphQL API request failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const result = await response.json();

      if (result.errors) {
        console.error(
          '[ProductService] GraphQL errors returned:',
          JSON.stringify(result.errors, null, 2),
        );
        throw new Error(
          `Shopify GraphQL query errors: ${JSON.stringify(result.errors)}`,
        );
      }

      const product = result?.data?.product;
      if (!product) {
        return null;
      }

      return {
        ...product,
        images: (product.images?.edges || []).map((img: any) => img.node),
        variants: (product.variants?.edges || []).map((v: any) => v.node),
      };
    } catch (error: any) {
      console.error(`[ProductService] getProductById error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search for a product by title (partial, case-insensitive match) via
   * Shopify Admin GraphQL API. Returns null when nothing matches so the
   * controller can translate that into a 404 Not Found response.
   */
  /**
   * Search for all products whose title contains the given text
   * (partial, case-insensitive match) via Shopify Admin GraphQL API.
   * Always returns an array — empty array if nothing matches.
   */
  async getProductByTitle(shopId: string, title: string): Promise<any[]> {
    const token = await this.authService.getAccessToken(shopId);
    const graphqlUrl = await this.authService.getGraphqlUrl(shopId);

    const query = `
    query GetProductsByTitle($searchQuery: String!) {
      products(first: 20, query: $searchQuery) {
        edges {
          node {
            id
            title
            handle
            status
            vendor
            createdAt
            images(first: 5) {
              edges {
                node {
                  id
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  `;

    // Wildcards let this match any product whose title contains the given
    // text, instead of requiring an exact title match.
    const sanitizedTitle = title.replace(/["\\]/g, '');
    const variables = {
      searchQuery: `title:*${sanitizedTitle}*`,
    };

    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ProductService] Failed to query GraphQL API (HTTP ${response.status}): ${errorText}`,
        );
        throw new Error(
          `Shopify GraphQL API request failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const result = await response.json();

      if (result.errors) {
        console.error(
          '[ProductService] GraphQL errors returned:',
          JSON.stringify(result.errors, null, 2),
        );
        throw new Error(
          `Shopify GraphQL query errors: ${JSON.stringify(result.errors)}`,
        );
      }

      const edges = result?.data?.products?.edges || [];

      // Always an array — [] when nothing matches.
      return edges.map((edge: any) => ({
        ...edge.node,
        images: (edge.node.images?.edges || []).map((img: any) => img.node),
      }));
    } catch (error: any) {
      console.error(
        `[ProductService] getProductByTitle error: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Update a product's description and/or SEO meta description.
   * Requires the `write_products` scope on the access token.
   */
  async updateProduct(
    shopId: string,
    id: string,
    input: UpdateProductInput,
  ): Promise<any> {
    const token = await this.authService.getAccessToken(shopId);
    const graphqlUrl = await this.authService.getGraphqlUrl(shopId);

    const mutation = `
    mutation UpdateProduct($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
          handle
          descriptionHtml
          seo {
            title
            description
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

    const productInput: Record<string, any> = { id };

    if (input.description !== undefined) {
      productInput.descriptionHtml = input.description;
    }

    if (input.metaDescription !== undefined) {
      productInput.seo = { description: input.metaDescription };
    }

    const variables = { input: productInput };

    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ProductService] Failed to query GraphQL API (HTTP ${response.status}): ${errorText}`,
        );
        throw new Error(
          `Shopify GraphQL API request failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const result = await response.json();

      if (result.errors) {
        console.error(
          '[ProductService] GraphQL errors returned:',
          JSON.stringify(result.errors, null, 2),
        );
        throw new Error(
          `Shopify GraphQL query errors: ${JSON.stringify(result.errors)}`,
        );
      }

      const userErrors = result?.data?.productUpdate?.userErrors || [];
      if (userErrors.length > 0) {
        console.error(
          '[ProductService] productUpdate userErrors:',
          JSON.stringify(userErrors, null, 2),
        );
        throw new Error(
          `Shopify productUpdate errors: ${JSON.stringify(userErrors)}`,
        );
      }

      const product = result?.data?.productUpdate?.product;

      return {
        ...product,
      };
    } catch (error: any) {
      console.error(`[ProductService] updateProduct error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 1: Request a staged upload target from Shopify for a file.
   */
  private async createStagedUpload(
    shopId: string,
    filename: string,
    mimeType: string,
    fileSize: number,
  ): Promise<{
    url: string;
    resourceUrl: string;
    parameters: { name: string; value: string }[];
  }> {
    const token = await this.authService.getAccessToken(shopId);
    const graphqlUrl = await this.authService.getGraphqlUrl(shopId);

    const mutation = `
    mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

    const variables = {
      input: [
        {
          resource: 'IMAGE',
          filename,
          mimeType,
          fileSize: String(fileSize),
          httpMethod: 'POST',
        },
      ],
    };

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Shopify staged upload request failed (HTTP ${response.status}): ${errorText}`,
      );
    }

    const result = await response.json();
    const userErrors = result?.data?.stagedUploadsCreate?.userErrors || [];
    if (userErrors.length > 0) {
      throw new Error(`Staged upload errors: ${JSON.stringify(userErrors)}`);
    }

    const target = result?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) {
      throw new Error('Shopify did not return a staged upload target');
    }

    return target;
  }

  /**
   * Step 2: Upload the actual file bytes to the staged target URL.
   */
  private async uploadToStagedTarget(
    target: { url: string; parameters: { name: string; value: string }[] },
    file: Express.Multer.File,
  ): Promise<void> {
    const formData = new FormData();

    // Parameters must be appended BEFORE the file field, in the order Shopify returned them.
    for (const param of target.parameters) {
      formData.append(param.name, param.value);
    }

    formData.append(
      'file',
      new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );

    const response = await fetch(target.url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to upload file to staged target (HTTP ${response.status}): ${errorText}`,
      );
    }
  }

  /**
   * Step 3: Attach the uploaded file to a product as a new image.
   */
  private async attachMediaToProduct(
    shopId: string,
    productId: string,
    resourceUrl: string,
  ): Promise<any> {
    const token = await this.authService.getAccessToken(shopId);
    const graphqlUrl = await this.authService.getGraphqlUrl(shopId);

    const mutation = `
    mutation ProductCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          ... on MediaImage {
            id
            image {
              url
              altText
            }
          }
        }
        mediaUserErrors {
          field
          message
        }
      }
    }
  `;

    const variables = {
      productId,
      media: [
        {
          originalSource: resourceUrl,
          mediaContentType: 'IMAGE',
        },
      ],
    };

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `productCreateMedia request failed (HTTP ${response.status}): ${errorText}`,
      );
    }

    const result = await response.json();
    const mediaUserErrors =
      result?.data?.productCreateMedia?.mediaUserErrors || [];
    if (mediaUserErrors.length > 0) {
      throw new Error(
        `productCreateMedia errors: ${JSON.stringify(mediaUserErrors)}`,
      );
    }

    return result?.data?.productCreateMedia?.media?.[0] || null;
  }

  /**
   * Full flow: upload a local file and attach it as a new image on a product.
   */
  async addProductImage(
    shopId: string,
    productId: string,
    file: Express.Multer.File,
  ): Promise<any> {
    try {
      const target = await this.createStagedUpload(
        shopId,
        file.originalname,
        file.mimetype,
        file.size,
      );

      await this.uploadToStagedTarget(target, file);

      const media = await this.attachMediaToProduct(
        shopId,
        productId,
        target.resourceUrl,
      );

      return media;
    } catch (error: any) {
      console.error(`[ProductService] addProductImage error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete one or more images (media) from a product.
   */
  async deleteProductImages(
    shopId: string,
    productId: string,
    mediaIds: string[],
  ): Promise<{ deletedMediaIds: string[] }> {
    const token = await this.authService.getAccessToken(shopId);
    const storeDomain = await this.authService.getStoreDomain(shopId);
    const apiVersion = this.authService.getApiVersion();

    const numericProductId = productId.split('/').pop();

    const deleteOne = async (mediaId: string): Promise<string | null> => {
      const numericImageId = mediaId.split('/').pop();
      const url = `https://${storeDomain}/admin/api/${apiVersion}/products/${numericProductId}/images/${numericImageId}.json`;

      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': token },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[ProductService] Failed to delete image ${mediaId} (HTTP ${response.status}): ${errorText}`,
          );
          return null;
        }

        return mediaId;
      } catch (error: any) {
        console.error(
          `[ProductService] deleteProductImages error for ${mediaId}: ${error.message}`,
        );
        return null;
      }
    };

    // Run all deletions in parallel instead of one-by-one.
    const results = await Promise.all(mediaIds.map(deleteOne));

    return {
      deletedMediaIds: results.filter((id): id is string => id !== null),
    };
  }

  /**
   * Fetch product images via the REST Admin API, which (as of API version
   * 2025-01+) returns the true MediaImage GID for each image instead of the
   * legacy ProductImage GID that GraphQL's `media` field can still surface
   * for images created before Shopify's unified media model. Use this only
   * where deletable/mutable image IDs are actually needed (e.g. the image
   * management dialog) — not in list/detail views, to avoid an extra
   * request on every load.
   */
  async getProductImagesViaRest(
    shopId: string,
    productId: string,
  ): Promise<{ id: string; url: string; altText: string | null }[]> {
    const token = await this.authService.getAccessToken(shopId);
    const storeDomain = await this.authService.getStoreDomain(shopId);
    const apiVersion = this.authService.getApiVersion();

    const numericProductId = productId.split('/').pop();

    const url = `https://${storeDomain}/admin/api/${apiVersion}/products/${numericProductId}/images.json`;

    try {
      const response = await fetch(url, {
        headers: { 'X-Shopify-Access-Token': token },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ProductService] REST images request failed (HTTP ${response.status}): ${errorText}`,
        );
        throw new Error(
          `Shopify REST API request failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const result = await response.json();
      const images = result?.images || [];

      return images.map((img: any) => ({
        id: `gid://shopify/MediaImage/${img.id}`,
        url: img.src,
        altText: img.alt,
      }));
    } catch (error: any) {
      console.error(
        `[ProductService] getProductImagesViaRest error: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Duplicate a product: giữ nguyên toàn bộ data (mô tả, variants, SEO,
   * metafields...) nhưng bỏ media và luôn set status = DRAFT.
   */
  async duplicateProduct(
    shopId: string,
    id: string,
    options: DuplicateProductOptions = {},
  ): Promise<any> {
    const token = await this.authService.getAccessToken(shopId);
    const graphqlUrl = await this.authService.getGraphqlUrl(shopId);

    // productDuplicate yêu cầu newTitle bắt buộc -> nếu không truyền,
    // lấy title sản phẩm gốc để tự sinh "Copy of ..."
    let newTitle = options.newTitle;
    if (!newTitle) {
      const original = await this.getProductById(shopId, id);
      if (!original) {
        throw new Error(`Product not found: ${id}`);
      }
      newTitle = `Copy of ${original.title}`;
    }

    const mutation = `
    mutation ProductDuplicate($productId: ID!, $newTitle: String!, $newStatus: ProductStatus!, $includeImages: Boolean!) {
      productDuplicate(
        productId: $productId
        newTitle: $newTitle
        newStatus: $newStatus
        includeImages: $includeImages
      ) {
        newProduct {
          id
          title
          handle
          status
          vendor
          productType
          createdAt
          descriptionHtml
          seo {
            title
            description
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

    const variables = {
      productId: id,
      newTitle,
      newStatus: 'DRAFT',
      includeImages: false,
    };

    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query: mutation, variables }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ProductService] Failed to query GraphQL API (HTTP ${response.status}): ${errorText}`,
        );
        throw new Error(
          `Shopify GraphQL API request failed with HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const result = await response.json();

      if (result.errors) {
        console.error(
          '[ProductService] GraphQL errors returned:',
          JSON.stringify(result.errors, null, 2),
        );
        throw new Error(
          `Shopify GraphQL query errors: ${JSON.stringify(result.errors)}`,
        );
      }

      const userErrors = result?.data?.productDuplicate?.userErrors || [];
      if (userErrors.length > 0) {
        console.error(
          '[ProductService] productDuplicate userErrors:',
          JSON.stringify(userErrors, null, 2),
        );
        throw new Error(
          `Shopify productDuplicate errors: ${JSON.stringify(userErrors)}`,
        );
      }

      const newProduct = result?.data?.productDuplicate?.newProduct;

      return {
        ...newProduct,
      };
    } catch (error: any) {
      console.error(
        `[ProductService] duplicateProduct error: ${error.message}`,
      );
      throw error;
    }
  }
}
