export function planPhase5(params: {
  upazillaStocks: ProductSupply[];
  localDemands: LocalDemandEntry[];
  getUpazillaCoords: (u: string) => { lat: number; lng: number };
  getLocalCoords: (l: string) => { lat: number; lng: number };
}): PhaseResult {
  const shipments: ShipmentPlan[] = [];
  const perProductOriginDelta: Record<string, Record<string, number>> = {};
  const perProductDestinationDelta: Record<string, Record<string, number>> = {};
  const unallocated: Record<string, number> = {};
  const summary: Record<string, any> = {};

  const demandByKey: Record<
    string,
    Array<LocalDemandEntry & { residual: number }>
  > = {};
  for (const d of params.localDemands) {
    if (d.effectiveDeficit <= 0) continue;
    const key = `${d.upazilla.toLowerCase()}::${d.productName.toLowerCase()}`;
    if (!demandByKey[key]) demandByKey[key] = [];
    demandByKey[key].push({ ...d, residual: d.effectiveDeficit });
  }

  const suppliesByUpazilla: Record<string, ProductSupply[]> = {};
  for (const s of params.upazillaStocks) {
    if (!suppliesByUpazilla[s.sellerId]) suppliesByUpazilla[s.sellerId] = [];
    suppliesByUpazilla[s.sellerId].push(s);
  }

  for (const upazillaId of Object.keys(suppliesByUpazilla)) {
    const hubSupplies = suppliesByUpazilla[upazillaId];
    if (hubSupplies.length === 0) continue;
    const hubUpazillaName = hubSupplies[0].upazilla;
    const hubCoords = params.getUpazillaCoords(hubUpazillaName);

    const suppliesByProduct: Record<string, ProductSupply[]> = {};
    for (const s of hubSupplies) {
      if (s.available <= 0) continue;
      if (!suppliesByProduct[s.productName]) suppliesByProduct[s.productName] = [];
      suppliesByProduct[s.productName].push(s);
    }

    for (const productName of Object.keys(suppliesByProduct)) {
      const productSupplies = suppliesByProduct[productName];
      let totalAvailable = productSupplies.reduce((sum, s) => sum + s.available, 0);
      if (totalAvailable <= 0) continue;

      const key = `${hubUpazillaName.toLowerCase()}::${productName.toLowerCase()}`;
      
      const candidates = demandByKey[key] ?? [];

      const scored = candidates.map((d) => {
        const distanceKm = haversineKm(
          hubCoords.lat,
          hubCoords.lng,
          d.lat,
          d.lng
        );
        const acoScore = calculateMultiProductACOScore({
          demandDeficit: d.residual,
          distanceKm,
          pheromoneScore: d.pheromoneScore,
          waitingDays: d.waitingDays,
        });
        return { ...d, distanceKm, acoScore, originalRef: d };
      });

      const valid = scored
        .filter((d) => d.acoScore > 0)
        .sort((a, b) => b.acoScore - a.acoScore);

      let supplyIdx = 0;
      const truckBuilder: Record<
        string,
        {
          destId: string;
          destName: string;
          distanceKm: number;
          lineItems: PlanLineItem[];
        }
      > = {};

      for (const dest of valid) {
        if (totalAvailable <= 0) break;
        const needed = dest.residual;
        if (needed <= 0) continue;

        let toFill = Math.min(totalAvailable, needed);
        const totalFillForDest = toFill;

        while (toFill > 0 && supplyIdx < productSupplies.length) {
          const currentSupply = productSupplies[supplyIdx];
          if (currentSupply.available <= 0) {
            supplyIdx++;
            continue;
          }

          const chunk = Math.min(toFill, currentSupply.available);
          const lineItem: PlanLineItem = {
            productName: currentSupply.productName,
            productCode: currentSupply.productCode,
            sellerProductId: currentSupply.sellerProductId,
            allocatedQty: chunk,
            acoScore: dest.acoScore,
            distanceKm: dest.distanceKm,
            demandAtTime: dest.residual,
            pheromoneScore: dest.pheromoneScore,
            allocationReason: "local_demand",
          };

          const truckKey = dest.localResellerId;
          if (!truckBuilder[truckKey]) {
            truckBuilder[truckKey] = {
              destId: dest.localResellerId,
              destName: dest.resellerCode,
              distanceKm: dest.distanceKm,
              lineItems: [],
            };
          }
          truckBuilder[truckKey].lineItems.push(lineItem);

          perProductOriginDelta[upazillaId] ??= {};
          perProductOriginDelta[upazillaId][currentSupply.productName] =
            (perProductOriginDelta[upazillaId][currentSupply.productName] ?? 0) + chunk;

          currentSupply.available -= chunk;
          totalAvailable -= chunk;
          toFill -= chunk;
        }

        dest.originalRef.residual -= totalFillForDest;

        perProductDestinationDelta[dest.localResellerId] ??= {};
        perProductDestinationDelta[dest.localResellerId][productName] =
          (perProductDestinationDelta[dest.localResellerId][productName] ?? 0) + totalFillForDest;
      }

      for (const truckKey of Object.keys(truckBuilder)) {
        const t = truckBuilder[truckKey];
        const ship = buildShipmentPlans({
          phase: 5 as any,
          fromType: "district_hub", 
          // Note: using district_hub to represent upazilla hub since "upazilla_hub" isn't a type
          fromId: upazillaId,
          fromName: hubUpazillaName,
          toType: "upazilla_reseller",
          // Note: toType="upazilla_reseller" actually means local reseller? In Phase 1 we use "upazilla" for upazilla hub.
          // Let's use "local_reseller"
          toId: t.destId,
          toName: t.destName,
          distanceKm: t.distanceKm,
          lineItems: t.lineItems,
        });
        if (ship) {
          ship.fromType = "upazilla_hub" as any;
          ship.toType = "local_reseller" as any;
          shipments.push(ship);
        }
      }

      if (totalAvailable > 0) {
        unallocated[productName] =
          (unallocated[productName] ?? 0) + totalAvailable;
        summary[productName] = {
          ...(summary[productName] ?? {}),
          phase5Surplus: totalAvailable,
        };
      }
    }
  }

  return {
    shipments,
    perProductOriginDelta,
    perProductDestinationDelta,
    unallocated,
    summary,
  };
}
