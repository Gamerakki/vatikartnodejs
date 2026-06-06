import { z } from 'zod';

export const saveCatalogueSchema = z.object({
  catalogue_id: z.number().optional(),
  catalogue: z.string().min(1, { message: 'The field catalogue is required' }),
});

export const softDeleteRestoreCatalogueSchema = z.object({
  catalogue_ids: z.array(
    z.number().gt(0, { message: 'Catalogue ID must be greater than 0' })
  ).min(1, { message: 'The field catalogue_ids must have at least 1 item' }),
});
