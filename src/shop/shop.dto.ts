export interface CreateShopDto {
  name: string;
  description?: string;
  id_shopify: string;
  client_id: string;
  secret_key: string;
}

export interface UpdateShopDto {
  name?: string;
  description?: string;
  id_shopify?: string;
  client_id?: string;
  secret_key?: string;
  default_prompt_template_id?: string | null;
}