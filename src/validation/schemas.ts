import { z } from 'zod';
import { WEBHOOK_EVENT_TYPES } from '../models/types.js';

// Request bodies and query strings. Parsing errors become invalid_request errors whose `param` is the
// dotted path of the bad field (see middleware/errorHandler.ts).

const countryCode = z
  .string()
  .length(2, 'use a two-letter ISO country code, such as US')
  .transform(code => code.toUpperCase());

export const addressSchema = z.object({
  name: z.string().min(1).max(100),
  company: z.string().max(100).optional(),
  street1: z.string().min(1).max(100),
  street2: z.string().max(100).optional(),
  city: z.string().min(1).max(60),
  state: z.string().max(30).optional(),
  zip: z.string().min(2).max(12),
  country: countryCode,
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
});

export const parcelSchema = z.object({
  preset: z.string().max(40).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  dimension_unit: z.enum(['in', 'cm']).optional(),
  weight: z.number().positive(),
  weight_unit: z.enum(['lb', 'oz', 'kg', 'g']),
});

export const createShipmentSchema = z.object({
  to_address: addressSchema,
  from_address: addressSchema,
  parcels: z.array(parcelSchema).min(1).max(10),
  order_id: z.string().startsWith('ord_').optional(),
  options: z
    .object({
      signature: z.boolean().optional(),
      insurance_amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'use a decimal amount such as "120.00"').optional(),
      label_format: z.enum(['pdf', 'zpl']).optional(),
    })
    .default({}),
});

export const buyLabelSchema = z.object({
  rate_id: z.string().startsWith('rate_', 'use a rate ID from the shipment, such as rate_2Wd8Lq5Zn7'),
});

export const createReturnSchema = z.object({
  order_id: z.string().startsWith('ord_'),
  reason: z.string().min(1).max(500),
  resolution: z.enum(['refund', 'store_credit', 'exchange']).default('refund'),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        exchange_sku: z.string().min(1).optional(),
      }),
    )
    .min(1),
});

export const createWebhookEndpointSchema = z.object({
  url: z
    .string()
    .url()
    .refine(url => url.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url), {
      message: 'webhook URLs must use HTTPS (plain HTTP is allowed for localhost only)',
    }),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
});

export const createPickupSchema = z.object({
  shipment_ids: z.array(z.string().startsWith('shp_')).min(1).max(50),
  pickup_window: z.object({
    start: z.number().int().positive(),
    end: z.number().int().positive(),
  }),
  /** Defaults to the sender address of the first shipment */
  address: addressSchema.optional(),
  instructions: z.string().max(200).optional(),
});

export const shipmentStatusSchema = z
  .enum(['rated', 'purchased', 'in_transit', 'delivered', 'exception', 'returned', 'voided'])
  .optional();

export const orderStatusSchema = z.enum(['unfulfilled', 'partially_fulfilled', 'fulfilled', 'cancelled']).optional();

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type CreatePickupInput = z.infer<typeof createPickupSchema>;
