export interface SaveCompany {
  company_name: string;
  address?: string;
  pincode?: string;
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
  address: string | null;
  pincode: string | null;
  logo_img_path: string | null;
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
