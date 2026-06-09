export const ACO_CONSTANTS = {
  ALPHA: 2.0,
  BETA: 1.5,
  GAMMA: 1.2,
  DELTA: 0.8,
  EVAPORATION_RATE: 0.1,
  OVERFLOW_THRESHOLD: 1.5,
  MAX_PHASE2_DESTINATIONS: 10,
  MAX_PHASE3_DESTINATIONS: 5,
  INTER_DISTRICT_EXPIRY_HOURS: 48,
};

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (lat1 === lat2 && lng1 === lng2) return 0.1;

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Handle edge case: very close coordinates
  return distance < 0.1 ? 0.1 : distance;
}

export function calculateACOScore(params: {
  demandDeficit: number;
  distanceKm: number;
  pheromoneScore: number;
  waitingDays: number;
  alpha?: number;
  beta?: number;
  gamma?: number;
  delta?: number;
}): number {
  if (params.demandDeficit <= 0) return 0;

  const alpha = params.alpha ?? ACO_CONSTANTS.ALPHA;
  const beta = params.beta ?? ACO_CONSTANTS.BETA;
  const gamma = params.gamma ?? ACO_CONSTANTS.GAMMA;
  const delta = params.delta ?? ACO_CONSTANTS.DELTA;

  // Edge Case 39: Validate ALPHA
  if (alpha < 0.1) {
    throw new Error("ConfigError: ALPHA must be >= 0.1. Setting ALPHA to 0 ignores supply chain demand.");
  }

  // score = (demand^ALPHA) * (1/dist^BETA) * (pheromone^GAMMA) * (1/(days+1)^(-DELTA))
  // Note: 1 / (days+1)^(-DELTA) is mathematically (days+1)^DELTA
  const demandTerm = Math.pow(params.demandDeficit, alpha);
  const distanceTerm = Math.pow(1 / params.distanceKm, beta);
  const pheromoneTerm = Math.pow(params.pheromoneScore, gamma);
  const urgencyTerm = Math.pow(params.waitingDays + 1, delta);

  return demandTerm * distanceTerm * pheromoneTerm * urgencyTerm;
}

export function calculatePhase1Allocation(params: {
  sellerStock: number;
  upazillaDemandRemaining: number;
  upazillaCurrentStock: number;
}): {
  localFill: number;
  phase1Surplus: number;
  action: "full_fill" | "partial_fill" | "no_demand";
} {
  const localFill = Math.max(
    0,
    Math.min(params.sellerStock, params.upazillaDemandRemaining)
  );
  const phase1Surplus = Math.max(0, params.sellerStock - localFill);

  let action: "full_fill" | "partial_fill" | "no_demand" = "no_demand";
  if (localFill > 0) {
    if (localFill >= params.upazillaDemandRemaining) {
      action = "full_fill";
    } else {
      action = "partial_fill";
    }
  }

  return { localFill, phase1Surplus, action };
}

export function calculatePhase2Allocations(params: {
  surplus: number;
  sourceUpazilla: string;
  sourceLat: number;
  sourceLng: number;
  destinations: Array<{
    upazillaResellerId: string;
    upazilla: string;
    lat: number;
    lng: number;
    demandDeficit: number;
    waitingDays: number;
    pheromoneScore: number;
  }>;
}): Array<{
  upazillaResellerId: string;
  upazilla: string;
  allocatedQuantity: number;
  acoScore: number;
  distanceKm: number;
  rank: number;
}> {
  if (params.surplus <= 0) return [];

  // 1. Calculate scores
  const scoredDestinations = params.destinations.map((dest) => {
    const distanceKm = haversineKm(
      params.sourceLat,
      params.sourceLng,
      dest.lat,
      dest.lng
    );
    const score = calculateACOScore({
      demandDeficit: dest.demandDeficit,
      distanceKm,
      pheromoneScore: dest.pheromoneScore,
      waitingDays: dest.waitingDays,
    });
    return { ...dest, distanceKm, acoScore: score };
  });

  // 2. Filter & 3. Sort
  const validDestinations = scoredDestinations
    .filter((d) => d.acoScore > 0)
    .sort((a, b) => {
      if (b.acoScore !== a.acoScore) return b.acoScore - a.acoScore;
      // Deterministic tie-breaker: alphabetical by ID
      return a.upazillaResellerId.localeCompare(b.upazillaResellerId);
    });

  // 4. Allocate greedily
  let remaining = params.surplus;
  const allocations = [];

  for (let i = 0; i < validDestinations.length; i++) {
    const dest = validDestinations[i];
    const alloc = Math.min(remaining, dest.demandDeficit);

    if (alloc > 0) {
      allocations.push({
        upazillaResellerId: dest.upazillaResellerId,
        upazilla: dest.upazilla,
        allocatedQuantity: alloc,
        acoScore: dest.acoScore,
        distanceKm: dest.distanceKm,
        rank: i + 1,
      });
      remaining -= alloc;
    }

    if (remaining <= 0) break;
  }

  // 5. Return only with allocatedQty > 0 (already handled by if alloc > 0)
  return allocations;
}

export function calculatePhase3Allocations(params: {
  surplus: number;
  sourceDistrict: string;
  sourceLat: number;
  sourceLng: number;
  destinations: Array<{
    districtResellerId: string;
    district: string;
    lat: number;
    lng: number;
    totalDemandDeficit: number;
    avgWaitingDays: number;
    pheromoneScore: number;
  }>;
}): Array<{
  districtResellerId: string;
  district: string;
  allocatedQuantity: number;
  acoScore: number;
  distanceKm: number;
  proportionPercent: number;
}> {
  if (params.surplus <= 0) return [];

  // 1. Calculate scores
  const scoredDestinations = params.destinations.map((dest) => {
    const distanceKm = haversineKm(
      params.sourceLat,
      params.sourceLng,
      dest.lat,
      dest.lng
    );
    const score = calculateACOScore({
      demandDeficit: dest.totalDemandDeficit,
      distanceKm,
      pheromoneScore: dest.pheromoneScore,
      waitingDays: dest.avgWaitingDays,
    });
    return { ...dest, distanceKm, acoScore: score };
  });

  const validDestinations = scoredDestinations.filter((d) => d.acoScore > 0);
  if (validDestinations.length === 0) return [];

  // 2. totalScore
  const totalScore = validDestinations.reduce((sum, d) => sum + d.acoScore, 0);

  // 3 & 4. Proportional allocation
  let remaining = params.surplus;
  const allocations = validDestinations.map((dest) => {
    const proportion = dest.acoScore / totalScore;
    const rawAlloc = proportion * params.surplus;
    // Cap at demand so we don't send infinite stock
    const cappedAlloc = Math.min(rawAlloc, dest.totalDemandDeficit);
    const alloc = Math.floor(cappedAlloc);
    
    remaining -= alloc;

    return {
      districtResellerId: dest.districtResellerId,
      district: dest.district,
      allocatedQuantity: alloc,
      acoScore: dest.acoScore,
      distanceKm: dest.distanceKm,
      proportionPercent: proportion * 100,
    };
  });

  // Sort descending by score, tie-breaker alphabetical
  allocations.sort((a, b) => {
    if (b.acoScore !== a.acoScore) return b.acoScore - a.acoScore;
    return a.districtResellerId.localeCompare(b.districtResellerId);
  });

  // Add remainder to valid destinations in a round-robin fashion (1 unit each)
  // (Cap at demand to be physically realistic)
  if (remaining > 0 && allocations.length > 0) {
    let madeChanges = true;
    while (remaining > 0 && madeChanges) {
      madeChanges = false;
      for (const alloc of allocations) {
        if (remaining <= 0) break;
        const destInfo = validDestinations.find(
          (d) => d.districtResellerId === alloc.districtResellerId
        );
        if (destInfo) {
          const canAbsorb = destInfo.totalDemandDeficit - alloc.allocatedQuantity;
          if (canAbsorb > 0) {
            alloc.allocatedQuantity += 1;
            remaining -= 1;
            madeChanges = true;
          }
        }
      }
    }
  }

  // 5. Return sorted by score descending (only those with > 0 allocation)
  return allocations.filter((a) => a.allocatedQuantity > 0);
}

export function computePheromoneUpdates(params: {
  existingScore: number;
  demandDeficit: number;
  waitingDays: number;
  wasRouted: boolean;
  routedQuantity?: number;
}): number {
  let newScore = params.existingScore;

  if (params.wasRouted) {
    newScore *= 1 - ACO_CONSTANTS.EVAPORATION_RATE;
  } else {
    newScore += params.demandDeficit * 0.1 + params.waitingDays * 0.05;
  }

  return Math.max(0.1, Math.min(100.0, newScore));
}
