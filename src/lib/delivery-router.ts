export type DeliveryStopPlan = {
  orderId: string
  buyerLat: number
  buyerLng: number
  buyerName: string
  buyerAddress: string
  distanceFromPrev: number
  estimatedArrival: Date
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function optimizeDeliveryRoute(params: {
  resellerLat: number
  resellerLng: number
  orders: Array<{
    orderId: string
    buyerLat: number
    buyerLng: number
    buyerName: string
    buyerAddress: string
  }>
  departureTime: Date
}): DeliveryStopPlan[] {
  const { resellerLat, resellerLng, orders, departureTime } = params;
  const unvisited = [...orders];
  const route: DeliveryStopPlan[] = [];
  
  let currentLat = resellerLat;
  let currentLng = resellerLng;
  let currentTime = new Date(departureTime);

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = haversineKm(currentLat, currentLng, unvisited[i].buyerLat, unvisited[i].buyerLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextOrder = unvisited.splice(nearestIdx, 1)[0];
    
    // Calculate arrival time: 20 kmh speed = 3 mins per km
    // Add travel time
    const travelMinutes = minDistance * 3;
    currentTime = new Date(currentTime.getTime() + travelMinutes * 60000);
    
    route.push({
      orderId: nextOrder.orderId,
      buyerLat: nextOrder.buyerLat,
      buyerLng: nextOrder.buyerLng,
      buyerName: nextOrder.buyerName,
      buyerAddress: nextOrder.buyerAddress,
      distanceFromPrev: minDistance,
      estimatedArrival: new Date(currentTime)
    });

    // Add 10 minutes stop time at this location before moving to next
    currentTime = new Date(currentTime.getTime() + 10 * 60000);
    
    currentLat = nextOrder.buyerLat;
    currentLng = nextOrder.buyerLng;
  }

  return route;
}

export function calculateRouteStats(stops: DeliveryStopPlan[]): {
  totalDistanceKm: number
  estimatedMinutes: number
  stopCount: number
} {
  let totalDistanceKm = 0;
  for (const stop of stops) {
    totalDistanceKm += stop.distanceFromPrev;
  }
  
  // 20 kmh = 3 mins/km. Plus 10 mins per stop.
  const estimatedMinutes = (totalDistanceKm * 3) + (stops.length * 10);

  return {
    totalDistanceKm,
    estimatedMinutes,
    stopCount: stops.length
  }
}

export function insertNewOrderIntoRoute(
  existingStops: DeliveryStopPlan[],
  newOrder: { orderId: string, buyerLat: number, buyerLng: number, buyerName: string, buyerAddress: string },
  resellerLat: number,
  resellerLng: number,
  currentStopIndex: number
): {
  newStops: DeliveryStopPlan[]
  insertedAtIndex: number
  additionalDistanceKm: number
  worthInserting: boolean
} {
  // Try inserting after each stop from currentStopIndex onwards
  let bestInsertionIndex = -1;
  let bestAdditionalDistance = Infinity;
  
  const currentTotalDistance = calculateRouteStats(existingStops).totalDistanceKm;

  // We can insert at currentStopIndex (meaning it becomes the next stop immediately)
  // up to existingStops.length (meaning it is appended at the end).
  for (let i = Math.max(0, currentStopIndex); i <= existingStops.length; i++) {
    const prevLat = i === 0 ? resellerLat : existingStops[i - 1].buyerLat;
    const prevLng = i === 0 ? resellerLng : existingStops[i - 1].buyerLng;
    
    const nextLat = i === existingStops.length ? newOrder.buyerLat : existingStops[i].buyerLat;
    const nextLng = i === existingStops.length ? newOrder.buyerLng : existingStops[i].buyerLng;

    const oldLegDist = i === existingStops.length ? 0 : haversineKm(prevLat, prevLng, nextLat, nextLng);
    
    const distToNew = haversineKm(prevLat, prevLng, newOrder.buyerLat, newOrder.buyerLng);
    const distFromNew = i === existingStops.length ? 0 : haversineKm(newOrder.buyerLat, newOrder.buyerLng, nextLat, nextLng);
    
    const newLegDist = distToNew + distFromNew;
    const addedDistance = newLegDist - oldLegDist;

    if (addedDistance < bestAdditionalDistance) {
      bestAdditionalDistance = addedDistance;
      bestInsertionIndex = i;
    }
  }

  const newStops = [...existingStops];
  newStops.splice(bestInsertionIndex, 0, {
    orderId: newOrder.orderId,
    buyerLat: newOrder.buyerLat,
    buyerLng: newOrder.buyerLng,
    buyerName: newOrder.buyerName,
    buyerAddress: newOrder.buyerAddress,
    distanceFromPrev: 0, // will recalculate below
    estimatedArrival: new Date() // will recalculate below
  });

  // Recalculate times and distances from currentStopIndex onwards
  let currentLat = Math.max(0, currentStopIndex) === 0 ? resellerLat : newStops[Math.max(0, currentStopIndex) - 1].buyerLat;
  let currentLng = Math.max(0, currentStopIndex) === 0 ? resellerLng : newStops[Math.max(0, currentStopIndex) - 1].buyerLng;
  
  // Backtrack time to when they departed the previous stop
  let currentTime = new Date();
  if (Math.max(0, currentStopIndex) > 0) {
    const prevStop = newStops[Math.max(0, currentStopIndex) - 1];
    currentTime = new Date(prevStop.estimatedArrival.getTime() + 10 * 60000);
  }

  for (let i = Math.max(0, currentStopIndex); i < newStops.length; i++) {
    const dist = haversineKm(currentLat, currentLng, newStops[i].buyerLat, newStops[i].buyerLng);
    newStops[i].distanceFromPrev = dist;
    
    const travelMinutes = dist * 3;
    currentTime = new Date(currentTime.getTime() + travelMinutes * 60000);
    newStops[i].estimatedArrival = new Date(currentTime);
    
    currentTime = new Date(currentTime.getTime() + 10 * 60000);
    
    currentLat = newStops[i].buyerLat;
    currentLng = newStops[i].buyerLng;
  }

  return {
    newStops,
    insertedAtIndex: bestInsertionIndex,
    additionalDistanceKm: bestAdditionalDistance,
    worthInserting: bestAdditionalDistance < (currentTotalDistance * 0.3) // true if additional distance < 30%
  };
}
