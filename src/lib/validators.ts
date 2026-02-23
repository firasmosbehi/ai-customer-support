import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(80),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().min(2).max(80),
});
