import { z } from "zod";

/**
 * Shared Zod schemas for API request/response shapes.
 *
 * These are used to:
 *   1. Validate that the request body is well-formed at the route
 *      boundary, before any DB work.
 *   2. Give us typed `Response<T>` helpers so client components can
 *      stop typing everything as `any[]`.
 *
 * Naming convention:
 *   *<Name>Request*  — request body schema
 *   *<Name>Response* — response body schema (for a single item)
 *   *<Name>List*     — response body schema (for a list)
 */

// ---------- Demand schemas ----------

export const DemandStatus = z.enum([
  "pending",
  "partially_fulfilled",
  "fulfilled",
  "cancelled",
]);

export const LocalDemandResponse = z.object({
  id: z.string(),
  localResellerId: z.string(),
  productCode: z.string(),
  productName: z.string(),
  demandQuantity: z.number().int().nonnegative(),
  fulfilledQuantity: z.number().int().nonnegative(),
  status: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const LocalDemandList = z.array(LocalDemandResponse);

export const CreateLocalDemandRequest = z.object({
  productCode: z.string().min(1, "productCode is required"),
  productName: z.string().min(1, "productName is required"),
  // Accept string or number (form data sometimes serializes numbers as
  // strings), then validate the integer constraint. Using .preprocess keeps
  // the output type a plain `number` so z.infer and route code can use it
  // directly.
  demandQuantity: z.preprocess(
    (v) => (typeof v === "string" ? parseInt(v, 10) : v),
    z.number().int().positive("demandQuantity must be a positive integer")
  ),
});

export type LocalDemand = z.infer<typeof LocalDemandResponse>;
export type CreateLocalDemandBody = z.infer<typeof CreateLocalDemandRequest>;

// ---------- Transfer schemas ----------

export const TransferStatus = z.enum([
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "expired",
]);

export const StockTransferResponse = z.object({
  id: z.string(),
  localResellerId: z.string(),
  upazillaResellerId: z.string(),
  stockItemId: z.string().nullable().optional(),
  productName: z.string(),
  quantity: z.number().int().nonnegative(),
  status: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  upazillaReseller: z
    .object({
      email: z.string().nullable().optional(),
      upazilla: z.string().nullable().optional(),
    })
    .optional(),
  stockItem: z
    .object({
      productName: z.string().optional(),
      brand: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const StockTransferList = z.array(StockTransferResponse);

export type StockTransfer = z.infer<typeof StockTransferResponse>;

// ---------- Profile schemas ----------

export const LocalResellerProfileResponse = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  username: z.string(),
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  city: z.string(),
  upazilla: z.string(),
  resellerCode: z.string(),
  createdAt: z.union([z.string(), z.date()]),
});

export const LocalResellerProfileEnvelope = z.object({
  profile: LocalResellerProfileResponse,
  email: z.string().email().nullable(),
});

export type LocalResellerProfile = z.infer<typeof LocalResellerProfileResponse>;

// ---------- Stock item schemas ----------

export const ResellerStockItemResponse = z.object({
  id: z.string(),
  resellerId: z.string(),
  sellerProductId: z.string().nullable(),
  customName: z.string().nullable(),
  quantity: z.number().int().nonnegative(),
  assignedAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  isReserved: z.boolean().optional(),
  reservedQuantity: z.number().int().nonnegative().optional(),
  surplusQuantity: z.number().int().nonnegative().optional(),
});

export const ResellerStockItemList = z.array(ResellerStockItemResponse);

export type ResellerStockItem = z.infer<typeof ResellerStockItemResponse>;

/**
 * Helper for routes that need to return a 400 with a useful message
 * if the body doesn't match the expected schema.
 *
 * Usage:
 *   const parsed = parseOr400(MySchema, body);
 *   if (parsed.kind === "error") return parsed.response;
 *   // parsed.value is now typed as the schema's output
 */
export type ParseResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "error"; response: Response };

export function parseOr400<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown
): ParseResult<z.infer<S>> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
      .join("; ");
    return {
      kind: "error",
      response: new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  return { kind: "ok", value: result.data as z.infer<S> };
}
