import { z } from 'zod';

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const mobileRegex = /^[6-9][0-9]{9}$/;

export const saveCompanySchema = z.object({
  company_name: z.string().min(1, { message: 'The field company_name is required' }),
  address: z.string().optional().default(''),
  pincode: z.string().max(10, { message: 'The field pincode must have at most 10 characters' }).optional().default(''),
});

export const saveSocialMediaReqSchema = z.object({
  social_media_id: z.number({ required_error: 'The field social_media_id is required' }),
  social_media: z.string().min(1, { message: 'The field social_media is required' }),
});

export const saveSocialMediaBatchSchema = z.object({
  social_media: z.array(saveSocialMediaReqSchema)
    .min(1, { message: 'The field social_media must have at least 1 item' }),
});

export const saveCompanySupportContactDetailsSchema = z.object({
  support_email: z.string()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'The field support_email must be a valid email',
    })
    .optional()
    .nullable(),
  support_phone: z.string()
    .refine((val) => !val || (val.length >= 10 && val.length <= 15 && mobileRegex.test(val.slice(-10))), {
      message: 'The field support_phone must be a valid mobile number',
    })
    .optional()
    .nullable(),
});

export const saveCompanySalesContactDetailsSchema = z.object({
  sales_email: z.string()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'The field sales_email must be a valid email',
    })
    .optional()
    .nullable(),
  sales_phone: z.string()
    .refine((val) => !val || (val.length >= 10 && val.length <= 15 && mobileRegex.test(val.slice(-10))), {
      message: 'The field sales_phone must be a valid mobile number',
    })
    .optional()
    .nullable(),
});
