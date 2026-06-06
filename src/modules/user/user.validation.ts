import { z } from 'zod';

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const mobileRegex = /^[6-9][0-9]{9}$/;

export const usernameSchema = z.string()
  .min(1, { message: 'The field username is required' })
  .refine((val) => emailRegex.test(val) || mobileRegex.test(val), {
    message: 'The field username must be either Email ID or Mobile No.',
  });

export const registerUserSchema = z.object({
  first_name: z.string().min(1, { message: 'The field first_name is required' }),
  last_name: z.string().min(1, { message: 'The field last_name is required' }),
  username: usernameSchema,
  password: z.string().min(1, { message: 'The field password is required' }),
});

export const loginUserSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, { message: 'The field password is required' }),
});
