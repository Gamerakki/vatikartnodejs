import { z } from 'zod';

export const renewSubscriptionSchema = z.object({
  company_id: z.string().min(1, { message: 'The field company_id is required' }),
  plan_name: z.enum(['FREE', 'PREMIUM', 'ENTERPRISE'], {
    errorMap: () => ({ message: 'The plan_name must be FREE, PREMIUM, or ENTERPRISE' }),
  }),
  duration_months: z.number().int().positive({ message: 'duration_months must be a positive integer' }),
  price_paid: z.number().nonnegative({ message: 'price_paid must be a non-negative number' }),
});

export const getStoreInsightsSchema = z.object({
  companyId: z.string().min(1, { message: 'The param companyId is required' }),
});
