export interface SaveCompany {
  company_name: string;
  tagline?: string;
  address?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  currency?: string;
  upi_id?: string;
}

export interface SaveSocialMediaReq {
  social_media_id: number;
  social_media: string;
}

export interface SaveSocialMediaBatchReq {
  social_media: SaveSocialMediaReq[];
}

export interface CompanyData {
  company_id: number;
  company_name: string;
  tagline: string | null;
  address: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  currency: string | null;
  upi_id: string | null;
  logo_img_path: string | null;
  subdomain?: string | null;
  watermark_enabled?: boolean;
  policies?: string | null;
  subscription_info?: {
    plan: string;
    products_used: number;
    max_products: number;
    categories_used: number;
    max_categories: number;
    users_used: number;
    max_users: number;
    access_control: boolean;
  };
}

export interface SaveCompanySupportContactDetailsReq {
  support_email?: string | null;
  support_phone?: string | null;
}

export interface CompanySupportContactDetailsRes {
  support_email: string | null;
  support_phone: string | null;
}

export interface SaveCompanySalesContactDetailsReq {
  sales_email?: string | null;
  sales_phone?: string | null;
}

export interface CompanySalesContactDetailsRes {
  sales_email: string | null;
  sales_phone: string | null;
}
