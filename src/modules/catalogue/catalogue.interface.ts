export interface SaveCatalogueReq {
  catalogue_id?: number;
  catalogue: string;
  privacy_level?: string;
}

export interface SaveCatalogueRes {
  catalogue_id: number;
  slug: string;
  added_date: Date;
}

export interface CatalogRes {
  catalogue_id: number;
  catalogue: string | null;
  added_date: Date;
  is_published: boolean;
  total_products_count: number;
  total_visitors: number;
  thumbnail_images: string;
  slug: string | null;
  privacy_level: string;
}

export interface CatalogueQueryParams {
  limit?: number;
  offset?: number;
  search_txt?: string;
}

export interface SoftDeleteRestoreCatalogueReq {
  catalogue_ids: number[];
}
