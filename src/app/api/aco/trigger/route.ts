import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import {
  calculatePhase1Allocation,
  calculatePhase2Allocations,
  calculatePhase3Allocations,
} from "@/lib/aco-engine";
import {
  getUpazillaCoords,
  getDistrictCoords,
  getUpazillasInDistrict,
  getDistrictForUpazilla,
} from "@/lib/aco-distance";

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const sellerProductId = body.sellerProductId;
    const triggerType = body.triggerType || "manual";

    if (!sellerProductId) {
      return NextResponse.json(
        { error: "sellerProductId is required" },
        { status: 400 }
      );
    }

    // Run inside an interactive transaction to guarantee ACID properties
    const result = await prisma.$transaction(
      async (tx) => {
        // SETUP
        const sellerProduct = await tx.sellerProduct.findUnique({
          where: { id: sellerProductId },
          include: {
            seller: true,
            globalProduct: true,
          },
        });

        if (!sellerProduct) {
          throw new Error("Seller product not found");
        }
        if (sellerProduct.status !== "approved") {
          throw new Error("Seller product must be approved to route");
        }
        if (sellerProduct.stock <= 0) {
          throw new Error("Seller product has no stock to route");
        }

        const sellerStock = sellerProduct.stock;
        // Edge Case 57: Fallback to Upazilla Centroid if seller lat/lng is unset
        let sellerLat = sellerProduct.seller.lat;
        let sellerLng = sellerProduct.seller.lng;
        if ((!sellerLat || sellerLat === 0) && (!sellerLng || sellerLng === 0)) {
          const fallback = getUpazillaCoords(sellerProduct.seller.upazilla);
          sellerLat = fallback.lat;
          sellerLng = fallback.lng;
        }

        const sellerUpazilla = sellerProduct.seller.upazilla;
        const sellerCity = sellerProduct.seller.city;
        const sellerDistrict = sellerCity || getDistrictForUpazilla(sellerUpazilla) || "";
        
        // Edge Case 58: Validate Upazilla exists in database
        if (!sellerDistrict) {
          throw new Error(`Seller upazilla '${sellerUpazilla}' not found in geographic database. Cannot route stock.`);
        }
        
        const productName = sellerProduct.customName || sellerProduct.globalProduct?.name || "Unknown Product";

        const upazillaReseller = await tx.upazillaReseller.findFirst({
          where: { 
            upazilla: { equals: sellerUpazilla, mode: "insensitive" },
            city: { equals: sellerCity, mode: "insensitive" }
          },
        });

        if (!upazillaReseller) {
          throw new Error(
            `No upazilla reseller registered for seller's upazilla (${sellerUpazilla})`
          );
        }

        // Verify caller
        if (
          user.id !== upazillaReseller.id &&
          user.id !== sellerProduct.sellerId
        ) {
          throw new Error(
            "Unauthorized: Only the seller or their local upazilla reseller can trigger ACO"
          );
        }

        // Edge Case 65: Rate Limit (max 10 ACO triggers per hour per user)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentJobsCount = await tx.aCORoutingJob.count({
          where: {
            triggeredBy: user.id,
            startedAt: { gte: oneHourAgo }
          }
        });

        if (recentJobsCount >= 10) {
          throw new Error("RATE_LIMIT_EXCEEDED");
        }

        // RULE 9: Concurrent ACO jobs check
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(12345)`;

        const runningGlobal = await tx.aCOGlobalJob.findFirst({
          where: { status: { in: ["running", "planning", "executing"] } }
        });
        if (runningGlobal) {
          throw new Error("A Global ACO Job is already running.");
        }

        const runningJob = await tx.aCORoutingJob.findFirst({
          where: {
            productScope: { has: productName },
            status: { in: ["running", "planning", "executing"] }
          }
        });

        if (runningJob) {
          // Edge Case 46: Stale job detection (crashed mid-transaction)
          const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
          if (runningJob.startedAt < fiveMinsAgo) {
            await tx.aCORoutingJob.update({
              where: { id: runningJob.id },
              data: { status: "timeout", completedAt: new Date() }
            });
            console.warn(`Recovered stale ACO job ${runningJob.id} for ${productName}`);
          } else {
            throw new Error(`ACO job already running for ${productName}. Wait for it to complete.`);
          }
        }

        const upazillaCoords = getUpazillaCoords(sellerUpazilla);

        const job = await tx.aCORoutingJob.create({
          data: {
            triggeredBy: user.id,
            triggerType: triggerType,
            sellerProductId: sellerProduct.id,
            sourceUpazilla: sellerUpazilla,
            sourceSellerId: sellerProduct.sellerId,
            productScope: [productName],
            totalForecastedStock: { [productName]: sellerStock },
            status: "running",
          },
        });

        const allocations = [];
        let remaining = sellerStock;

        // =====================================
        // PHASE 1: INTRA-UPAZILLA
        // =====================================
        const demand = await tx.upazillaDemand.findFirst({
          where: {
            upazillaResellerId: upazillaReseller.id,
            productName: {
              equals: productName,
              mode: "insensitive",
            },
            status: { not: "fulfilled" },
          },
        });

        const currentUpazillaStockRecord = await tx.upazillaStockItem.findFirst(
          {
            where: {
              upazillaResellerId: upazillaReseller.id,
              productName: {
                equals: productName,
                mode: "insensitive",
              },
            },
          }
        );
        const currentUpazillaStock = currentUpazillaStockRecord?.quantity ?? 0;

        const demandDeficit = demand
          ? demand.demandQuantity - demand.fulfilledQuantity
          : 0;

        const phase1 = calculatePhase1Allocation({
          sellerStock: remaining,
          upazillaDemandRemaining: demandDeficit,
          upazillaCurrentStock: currentUpazillaStock,
        });

        if (phase1.localFill > 0) {
          const newFulfilled =
            (demand?.fulfilledQuantity ?? 0) + phase1.localFill;
          const demandQty = demand?.demandQuantity ?? 0;

          if (demand) {
            await tx.upazillaDemand.update({
              where: { id: demand.id },
              data: {
                fulfilledQuantity: newFulfilled,
                status:
                  newFulfilled >= demandQty
                    ? "fulfilled"
                    : "partially_fulfilled",
              },
            });
          }

          const existingStockItem = await tx.upazillaStockItem.findFirst({
            where: {
              upazillaResellerId: upazillaReseller.id,
              productName: { equals: productName, mode: "insensitive" },
            },
          });

          if (existingStockItem) {
            await tx.upazillaStockItem.update({
              where: { id: existingStockItem.id },
              data: {
                quantity: { increment: phase1.localFill },
              },
            });
          } else {
            await tx.upazillaStockItem.create({
              data: {
                upazillaResellerId: upazillaReseller.id,
                productName: productName,
                quantity: phase1.localFill,
              },
            });
          }

          const districtResellerForUpazilla = await tx.districtReseller.findUnique({
            where: { district: sellerDistrict },
          });

          if (districtResellerForUpazilla) {
            const districtDemand = await tx.districtDemand.findFirst({
              where: {
                districtResellerId: districtResellerForUpazilla.id,
                productName: { equals: productName, mode: "insensitive" },
              },
            });
            if (districtDemand) {
              const newRem = Math.max(0, districtDemand.remainingDemand - phase1.localFill);
              await tx.districtDemand.update({
                where: { id: districtDemand.id },
                data: {
                  remainingDemand: newRem,
                  status: newRem === 0 ? "fulfilled" : "partially_fulfilled",
                },
              });
            }
          }

          const phase1Alloc = await tx.aCOAllocation.create({
            data: {
              jobId: job.id,
              phase: 1,
              fromType: "seller",
              fromId: sellerProduct.sellerId,
              fromName: sellerProduct.seller.storeName,
              toType: "upazilla",
              toId: upazillaReseller.id,
              toName: sellerUpazilla,
              productName: productName,
              quantity: phase1.localFill,
              acoScore: 999.0,
              distanceKm: 0.1,
              demandAtTime: demandQty,
              pheromoneScore: 1.0,
              allocationReason: "local_demand",
              status: "executed",
              executedAt: new Date(),
            },
          });
          allocations.push(phase1Alloc);
        }

        remaining -= phase1.localFill;
        let phase1Allocated = phase1.localFill;
        let phase2Allocated = 0;
        let phase3Allocated = 0;
        let phase2Total = 0;
        const phase3OpportunitiesResult = [];

        if (remaining > 0) {
          const districtUpazillas = getUpazillasInDistrict(sellerDistrict).filter(
            (u) => u.toLowerCase() !== sellerUpazilla.toLowerCase()
          );

          const phase2DestinationsRaw = [];

          for (const uName of districtUpazillas) {
            const uReseller = await tx.upazillaReseller.findFirst({
              where: {
                upazilla: { equals: uName, mode: "insensitive" },
                city: { equals: sellerDistrict, mode: "insensitive" },
              },
            });
            if (!uReseller) continue;

            const uDemand = await tx.upazillaDemand.findFirst({
              where: {
                upazillaResellerId: uReseller.id,
                productName: { equals: productName, mode: "insensitive" },
                status: { not: "fulfilled" },
              },
            });
            if (!uDemand) continue;

            const uDeficit = uDemand.demandQuantity - uDemand.fulfilledQuantity;

            // Edge Case 35: Auto-fix pending status if deficit is 0
            if (uDeficit <= 0) {
              if (uDemand.status !== "fulfilled") {
                await tx.upazillaDemand.update({
                  where: { id: uDemand.id },
                  data: { status: "fulfilled" }
                });
              }
              continue;
            }

            // Edge Case 31: Subtract pending inbound transfers from effective demand
            const pendingTransfers = await tx.districtTransfer.aggregate({
              where: {
                upazillaResellerId: uReseller.id,
                productName: { equals: productName, mode: "insensitive" },
                status: "pending"
              },
              _sum: { quantity: true }
            });
            const pendingQty = pendingTransfers._sum.quantity || 0;
            const effectiveDeficit = uDeficit - pendingQty;

            if (effectiveDeficit <= 0) continue;

            const pheromone = await tx.demandPheromone.findFirst({
              where: {
                entityType: "upazilla",
                entityId: uReseller.id,
                productName: { equals: productName, mode: "insensitive" },
              },
            });

            const waitingDays = Math.floor(
              (Date.now() - new Date(uDemand.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            const uCoords = getUpazillaCoords(uName);

            phase2DestinationsRaw.push({
              upazillaResellerId: uReseller.id,
              upazilla: uName,
              lat: uCoords.lat,
              lng: uCoords.lng,
              demandDeficit: effectiveDeficit,
              waitingDays: waitingDays < 0 ? 0 : waitingDays,
              pheromoneScore: pheromone?.score ?? 1.0,
            });
          }

          const districtReseller = await tx.districtReseller.findUnique({
            where: { district: sellerDistrict },
          });

          if (phase2DestinationsRaw.length === 0 && districtReseller) {
            const existingDistStock = await tx.districtStockItem.findFirst({
              where: {
                districtResellerId: districtReseller.id,
                productName: { equals: productName, mode: "insensitive" },
              },
            });

            if (existingDistStock) {
              await tx.districtStockItem.update({
                where: { id: existingDistStock.id },
                data: { quantity: { increment: remaining } },
              });
            } else {
              await tx.districtStockItem.create({
                data: {
                  districtResellerId: districtReseller.id,
                  productName: productName,
                  quantity: remaining,
                },
              });
            }

            const alloc = await tx.aCOAllocation.create({
              data: {
                jobId: job.id,
                phase: 2,
                fromType: "seller",
                fromId: sellerProduct.sellerId,
                fromName: sellerProduct.seller.storeName,
                toType: "district_hub",
                toId: districtReseller.id,
                toName: sellerDistrict,
                productName: productName,
                quantity: remaining,
                acoScore: 0,
                distanceKm: 0,
                demandAtTime: 0,
                pheromoneScore: 0,
                allocationReason: "surplus_reserve",
                status: "executed",
                executedAt: new Date(),
              },
            });
            allocations.push(alloc);
            phase2Total = remaining;
          } else if (phase2DestinationsRaw.length > 0 && districtReseller) {
            const phase2Results = calculatePhase2Allocations({
              surplus: remaining,
              sourceUpazilla: sellerUpazilla,
              sourceLat: sellerLat,
              sourceLng: sellerLng,
              destinations: phase2DestinationsRaw,
            });

            for (const res of phase2Results) {
              if (res.allocatedQuantity <= 0) continue;

              await tx.districtTransfer.create({
                data: {
                  districtResellerId: districtReseller.id,
                  upazillaResellerId: res.upazillaResellerId,
                  productName: productName,
                  quantity: res.allocatedQuantity,
                  status: "pending",
                },
              });

              const uDemand = await tx.upazillaDemand.findFirst({
                where: {
                  upazillaResellerId: res.upazillaResellerId,
                  productName: { equals: productName, mode: "insensitive" },
                },
              });
              if (uDemand) {
                 const newF = uDemand.fulfilledQuantity + res.allocatedQuantity;
                 await tx.upazillaDemand.update({
                   where: { id: uDemand.id },
                   data: {
                     fulfilledQuantity: newF,
                     status: newF >= uDemand.demandQuantity ? "fulfilled" : "partially_fulfilled"
                   }
                 });
              }

              const alloc = await tx.aCOAllocation.create({
                data: {
                  jobId: job.id,
                  phase: 2,
                  fromType: "district_hub",
                  fromId: districtReseller.id,
                  fromName: sellerDistrict,
                  toType: "upazilla",
                  toId: res.upazillaResellerId,
                  toName: res.upazilla,
                  productName: productName,
                  quantity: res.allocatedQuantity,
                  acoScore: res.acoScore,
                  distanceKm: res.distanceKm,
                  demandAtTime: phase2DestinationsRaw.find((d) => d.upazilla === res.upazilla)?.demandDeficit ?? 0,
                  pheromoneScore: phase2DestinationsRaw.find((d) => d.upazilla === res.upazilla)?.pheromoneScore ?? 1.0,
                  allocationReason: "intra_district_aco",
                  status: "executed",
                  executedAt: new Date(),
                },
              });
              allocations.push(alloc);

              const existingRoute = await tx.routePheromone.findFirst({
                where: {
                  fromEntity: sellerUpazilla,
                  toEntity: res.upazilla,
                  productName: productName,
                },
              });
              if (existingRoute) {
                await tx.routePheromone.update({
                  where: { id: existingRoute.id },
                  data: {
                    successCount: { increment: 1 },
                    totalRouted: { increment: res.allocatedQuantity },
                  },
                });
              } else {
                await tx.routePheromone.create({
                  data: {
                    fromEntity: sellerUpazilla,
                    toEntity: res.upazilla,
                    productName: productName,
                    successCount: 1,
                    totalRouted: res.allocatedQuantity,
                  },
                });
              }

              phase2Total += res.allocatedQuantity;
            }

            const phase2Remainder = remaining - phase2Total;

            if (phase2Remainder > 0) {
              const existingDistStock = await tx.districtStockItem.findFirst({
                where: {
                  districtResellerId: districtReseller.id,
                  productName: { equals: productName, mode: "insensitive" },
                },
              });
              if (existingDistStock) {
                await tx.districtStockItem.update({
                  where: { id: existingDistStock.id },
                  data: { quantity: { increment: phase2Remainder } },
                });
              } else {
                await tx.districtStockItem.create({
                  data: {
                    districtResellerId: districtReseller.id,
                    productName: productName,
                    quantity: phase2Remainder,
                  },
                });
              }
              
              const alloc = await tx.aCOAllocation.create({
                data: {
                  jobId: job.id,
                  phase: 2,
                  fromType: "seller",
                  fromId: sellerProduct.sellerId,
                  fromName: sellerProduct.seller.storeName,
                  toType: "district_hub",
                  toId: districtReseller.id,
                  toName: sellerDistrict,
                  productName: productName,
                  quantity: phase2Remainder,
                  acoScore: 0,
                  distanceKm: 0,
                  demandAtTime: 0,
                  pheromoneScore: 0,
                  allocationReason: "surplus_reserve",
                  status: "executed",
                  executedAt: new Date(),
                },
              });
              allocations.push(alloc);
            }
          }

          remaining -= phase2Total;
          phase2Allocated = phase2Total + (sellerStock - phase1Allocated - phase2Total); 
          
          if (districtReseller) {
            const currentDistDemand = await tx.districtDemand.findFirst({
              where: {
                districtResellerId: districtReseller.id,
                productName: { equals: productName, mode: "insensitive" },
              },
            });

            if (!currentDistDemand || currentDistDemand.remainingDemand === 0) {
              const currentDistStockItem = await tx.districtStockItem.findFirst({
                where: {
                  districtResellerId: districtReseller.id,
                  productName: { equals: productName, mode: "insensitive" },
                },
              });

              if (currentDistStockItem && currentDistStockItem.quantity > 0) {
                const districtSurplus = currentDistStockItem.quantity;
                const otherDistricts = await tx.districtReseller.findMany({
                  where: { id: { not: districtReseller.id } },
                });

                const phase3TargetsRaw = [];
                const dCoords = getDistrictCoords(sellerDistrict);

                for (const oDist of otherDistricts) {
                  const oDemand = await tx.districtDemand.findFirst({
                    where: {
                      districtResellerId: oDist.id,
                      productName: { equals: productName, mode: "insensitive" },
                      status: { not: "fulfilled" },
                    },
                  });
                  // Edge Case 35: Auto-fix pending status if deficit is 0
                  if (oDemand.remainingDemand <= 0) {
                    if (oDemand.status !== "fulfilled") {
                      await tx.districtDemand.update({
                        where: { id: oDemand.id },
                        data: { status: "fulfilled" }
                      });
                    }
                    continue;
                  }

                  // Edge Case 31: Account for pending inter-district inbound transfers
                  const pendingInters = await tx.interDistrictOpportunity.findMany({
                    where: {
                      targetDistrictId: oDist.id,
                      status: "pending_approval"
                    }
                  });
                  let pendingInterQty = 0;
                  for (const opp of pendingInters) {
                    const items = opp.lineItems as Array<{ productName: string, quantity: number }>;
                    if (items) {
                      for (const it of items) {
                        if (it.productName.toLowerCase() === productName.toLowerCase()) {
                          pendingInterQty += it.quantity;
                        }
                      }
                    }
                  }
                  const effectiveDistrictDeficit = oDemand.remainingDemand - pendingInterQty;

                  if (effectiveDistrictDeficit <= 0) continue;

                  // Edge Case 23: Circular Transfer Check
                  const pendingOppsToUs = await tx.interDistrictOpportunity.findMany({
                    where: {
                      sourceDistrictId: oDist.id,
                      targetDistrictId: districtReseller.id,
                      status: "pending_approval",
                    }
                  });
                  const existingOppToUs = pendingOppsToUs.find(opp => {
                    const items = opp.lineItems as Array<{ productName: string }>;
                    return items?.some(it => it.productName.toLowerCase() === productName.toLowerCase());
                  });
                  if (existingOppToUs) {
                    console.log(`Circular transfer detected and prevented: ${sellerDistrict} <-> ${oDist.district} for ${productName}`);
                    continue;
                  }

                  const pheromone = await tx.demandPheromone.findFirst({
                    where: {
                      entityType: "district",
                      entityId: oDist.id,
                      productName: { equals: productName, mode: "insensitive" },
                    },
                  });

                  const waitingDays = Math.floor(
                    (Date.now() - new Date(oDemand.createdAt).getTime()) /
                      (1000 * 60 * 60 * 24)
                  );
                  const oCoords = getDistrictCoords(oDist.district);

                  phase3TargetsRaw.push({
                    districtResellerId: oDist.id,
                    district: oDist.district,
                    lat: oCoords.lat,
                    lng: oCoords.lng,
                    totalDemandDeficit: effectiveDistrictDeficit,
                    avgWaitingDays: waitingDays < 0 ? 0 : waitingDays,
                    pheromoneScore: pheromone?.score ?? 1.0,
                  });
                }

                if (phase3TargetsRaw.length > 0) {
                  const phase3Results = calculatePhase3Allocations({
                    surplus: districtSurplus,
                    sourceDistrict: sellerDistrict,
                    sourceLat: dCoords.lat,
                    sourceLng: dCoords.lng,
                    destinations: phase3TargetsRaw,
                  });

                  for (const res of phase3Results) {
                    const expiresDate = new Date();
                    expiresDate.setHours(expiresDate.getHours() + 48);

                    const opp = await tx.interDistrictOpportunity.create({
                      data: {
                        jobId: job.id,
                        sourceDistrictId: districtReseller.id,
                        targetDistrictId: res.districtResellerId,
                        lineItems: [{ productName, quantity: res.allocatedQuantity, acoScore: res.acoScore }],
                        totalQuantity: res.allocatedQuantity,
                        overallAcoScore: res.acoScore,
                        distanceKm: res.distanceKm,
                        status: "pending_approval",
                        expiresAt: expiresDate,
                      },
                    });

                    const alloc = await tx.aCOAllocation.create({
                      data: {
                        jobId: job.id,
                        phase: 3,
                        fromType: "district_hub",
                        fromId: districtReseller.id,
                        fromName: sellerDistrict,
                        toType: "district",
                        toId: res.districtResellerId,
                        toName: res.district,
                        productName: productName,
                        quantity: res.allocatedQuantity,
                        acoScore: res.acoScore,
                        distanceKm: res.distanceKm,
                        demandAtTime: phase3TargetsRaw.find((d) => d.district === res.district)?.totalDemandDeficit ?? 0,
                        pheromoneScore: phase3TargetsRaw.find((d) => d.district === res.district)?.pheromoneScore ?? 1.0,
                        allocationReason: "inter_district_aco",
                        status: "pending",
                      },
                    });
                    allocations.push(alloc);
                    phase3OpportunitiesResult.push(opp);
                    phase3Allocated += res.allocatedQuantity;
                  }
                }
              }
            }
          }
        }

        const totalDeductFromSeller = phase1Allocated + phase2Allocated;
        if (totalDeductFromSeller > 0) {
          await tx.sellerProduct.update({
            where: { id: sellerProduct.id },
            data: { stock: { decrement: totalDeductFromSeller } },
          });
        }

        const finalStatus = phase3OpportunitiesResult.length > 0 ? "completed_pending_approval" : "completed";
        const unallocated = sellerStock - phase1Allocated - phase2Allocated;

        await tx.aCORoutingJob.update({
          where: { id: job.id },
          data: {
            status: finalStatus,
            phase1Summary: { allocated: phase1Allocated },
            phase2Summary: { allocated: phase2Allocated },
            phase3Summary: { allocated: phase3Allocated },
            phase4Summary: { unallocated },
            completedAt: new Date(),
          },
        });

        const logSummary = { totalStock: sellerStock, p1: phase1Allocated, p2: phase2Allocated, p3: phase3Allocated, unallocated: unallocated };
        await tx.aCOTriggerLog.create({
          data: { triggeredBy: user.id, triggerType: triggerType, productName: productName, jobId: job.id, result: "success", summary: logSummary },
        });

        return { jobId: job.id, status: finalStatus };
      },
      { timeout: 30000 } // RULE 8: 30 seconds timeout
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("ACO Trigger Error:", err);
    if (err instanceof Error) {
      if (err.message === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: "Rate limit exceeded. Maximum 10 ACO triggers per hour." }, { status: 429 });
      }
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to trigger ACO" },
      { status: err.message?.includes("Unauthorized") ? 401 : (err.message?.includes("No upazilla reseller") || err.message?.includes("already running") || err.message?.includes("Seller product") ? 400 : 500) }
    );
  }
}
