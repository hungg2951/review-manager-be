export interface CreateShopDto {
  name: string;
  description?: string;
  id_shopify: string;

}

export interface UpdateShopDto {
  name?: string;
  description?: string;
  id_shopify?: string;
  is_active?: boolean;
}