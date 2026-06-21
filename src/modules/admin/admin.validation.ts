import { z } from 'zod';

export const renewSubscriptionSchema = z.object({
  company_id: z.string().min(1, { message: 'The field company_id is required' }),
  plan_name: z.enum(['FREE', 'SILVER', 'GOLD', 'DIAMOND']),
  duration_months: z.number().int().nonnegative(),
  price_paid: z.number().nonnegative(),
  action: z.enum(['UPGRADE', 'DOWNGRADE', 'EXTEND', 'STOP']).default('UPGRADE'),
});

export const getStoreInsightsSchema = z.object({
  companyId: z.string().min(1, { message: 'The param companyId is required' }),
});
