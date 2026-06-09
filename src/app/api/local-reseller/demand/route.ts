import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { CreateLocalDemandRequest, parseOr400 } from "@/lib/api-schemas";

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;

    const demands = await prisma.localDemand.findMany({
      where: {
        localResellerId: user.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(demands);
  } catch (error: any) {
    console.error("Failed to fetch local demands:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;
    const { hasRole, error: roleError } = await requireRole(user.id, "local_reseller");
    if (roleError) return roleError;

    const body = await req.json();
    const parsed = parseOr400(CreateLocalDemandRequest, body);
    if (parsed.kind === "error") return parsed.response;
    const { productCode, productName, demandQuantity: qty } = parsed.value;

    // Verify local reseller
    const localReseller = await prisma.localReseller.findUnique({
      where: { id: user.id }
    });

    if (!localReseller) {
      return NextResponse.json({ error: "Local reseller profile not found" }, { status: 404 });
    }

    // Find the upazilla reseller that covers this local reseller's upazilla.
    // Done outside the transaction because the answer is immutable for the
    // duration of the request and we want to fail fast with a 404 if none
    // exists.
    const upazillaReseller = await prisma.upazillaReseller.findFirst({
      where: {
        upazilla: localReseller.upazilla
      }
    });

    // All writes happen in a single transaction. If any step fails, the
    // entire operation is rolled back — no orphan local demand rows and
    // no inconsistent upazilla demand totals.
    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert the local demand. The DB-level
      //    `@@unique([localResellerId, productCode])` enforces "one active
      //    demand per product" so a triple-click cannot create three rows.
      //    The `where` for upsert requires the unique fields, so we look
      //    up the existing row by (localResellerId, productCode).
      const existingLocalDemand = await tx.localDemand.findUnique({
        where: {
          localResellerId_productCode: {
            localResellerId: user.id,
            productCode
          }
        }
      });

      const localDemand = existingLocalDemand
        ? await tx.localDemand.update({
            where: { id: existingLocalDemand.id },
            data: {
              // If the demand is already fulfilled, treat the new request as
              // a fresh demand; otherwise just bump the quantity.
              demandQuantity:
                existingLocalDemand.status === "fulfilled"
                  ? qty
                  : existingLocalDemand.demandQuantity + qty,
              status:
                existingLocalDemand.status === "fulfilled"
                  ? "pending"
                  : existingLocalDemand.status
            }
          })
        : await tx.localDemand.create({
            data: {
              localResellerId: user.id,
              productCode,
              productName,
              demandQuantity: qty
            }
          });

      // 2. Bubble up to the Upazilla Reseller demand. Skip silently if the
      //    local reseller's upazilla has no registered upazilla reseller —
      //    we don't want to fail the whole request in that case.
      if (upazillaReseller) {
        const existingUpazillaDemand = await tx.upazillaDemand.findUnique({
          where: {
            upazillaResellerId_productName: {
              upazillaResellerId: upazillaReseller.id,
              productName
            }
          }
        });

        if (existingUpazillaDemand) {
          await tx.upazillaDemand.update({
            where: { id: existingUpazillaDemand.id },
            data: {
              demandQuantity: existingUpazillaDemand.demandQuantity + qty
            }
          });
        } else {
          await tx.upazillaDemand.create({
            data: {
              upazillaResellerId: upazillaReseller.id,
              productName,
              demandQuantity: qty,
              enteredBy: user.id
            }
          });
        }
      }

      return { localDemand, bubbledToUpazilla: !!upazillaReseller };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to create local demand:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
