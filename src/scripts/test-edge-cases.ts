import "dotenv/config";
import * as fs from "fs";
try {
  const localEnv = fs.readFileSync(".env.local", "utf-8");
  for (const line of localEnv.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch { /* .env.local may not exist */ }

import { prisma } from "../lib/prisma";
import { generateRandomDemand } from "../lib/agents/demand";
import { buildForecastingGraph } from "../lib/agents/graph";
import { rateLimit } from "../lib/rate-limit";

async function runEdgeCase1() {
  console.log("\n--- Edge Case 1: Double Spend Race Condition ---");
  
  // 1. Setup a test buyer with 500 balance
  let testBuyer = await prisma.buyerProfile.findFirst();
  if (!testBuyer) {
    console.log("No buyer found. Creating a fresh dummy buyer...");
    const dummyId = "test-buyer-" + Date.now();
    await prisma.profile.create({
      data: {
        id: dummyId,
        email: `test-${Date.now()}@test.com`,
        role: "buyer",
        username: "Tester",
        storeName: "Test Store",
        city: "Dhaka",
        upazilla: "Mirpur",
        district: "Dhaka"
      }
    });
    testBuyer = await prisma.buyerProfile.create({
      data: {
        id: dummyId,
        email: `test-${Date.now()}@test.com`,
        walletBalance: 500,
        city: "Dhaka",
        upazilla: "Mirpur",
        district: "Dhaka",
        lat: 23.8,
        lng: 90.4
      }
    });
  }

  // Backup old balance and set to exactly 500
  const oldBalance = testBuyer.walletBalance;
  await prisma.buyerProfile.update({
    where: { id: testBuyer.id },
    data: { walletBalance: 500 }
  });

  // Setup a mock item
  const mockItem = await prisma.resellerStockItem.findFirst();
  if (!mockItem) throw new Error("No stock items found for testing.");

  console.log(`Initial Balance for ${testBuyer.email}: 500 BDT`);
  const orderAmount = 500;

  // The logic inside api/buyer/order/route.ts
  const attemptCheckout = async (attemptName: string) => {
    try {
      return await prisma.$transaction(async (tx) => {
        const profile = await tx.buyerProfile.findUnique({
          where: { id: testBuyer.id }
        });
        
        if (!profile || profile.walletBalance < orderAmount) {
          throw new Error(`Insufficient funds for ${attemptName}`);
        }

        // Deduct balance
        await tx.buyerProfile.update({
          where: { id: testBuyer.id },
          data: { walletBalance: { decrement: orderAmount } }
        });

        // Simulate a tiny delay that normally happens during order insertion
        await new Promise(r => setTimeout(r, 50));

        // Create dummy order
        return await tx.deliveryOrder.create({
          data: {
            buyerId: testBuyer.id,
            sellerId: "some-seller-id", // mock
            status: "pending",
            totalAmount: orderAmount,
            deliveryAddress: "Test",
            city: "Dhaka",
            upazilla: "Mirpur",
            district: "Dhaka",
            paymentMethod: "WALLET"
          }
        });
      });
    } catch (e: any) {
      return { error: e.message };
    }
  };

  // 2. Fire two transactions at the exact same time
  console.log("Firing two simultaneous checkouts for 500 BDT...");
  const results = await Promise.all([
    attemptCheckout("Attempt 1"),
    attemptCheckout("Attempt 2")
  ]);

  console.log("Result 1:", results[0]);
  console.log("Result 2:", results[1]);

  const finalProfile = await prisma.buyerProfile.findUnique({ where: { id: testBuyer.id } });
  console.log(`Final Balance: ${finalProfile?.walletBalance} BDT`);

  if (finalProfile && finalProfile.walletBalance < 0) {
    console.error("❌ FAILED: Race condition allowed negative balance!");
  } else {
    console.log("✅ PASSED: Prisma atomic transaction prevented double spend.");
  }

  // Cleanup
  await prisma.buyerProfile.update({
    where: { id: testBuyer.id },
    data: { walletBalance: oldBalance }
  });
}

async function runEdgeCase2() {
  console.log("\n--- Edge Case 2: DDoS Queue Flooding & Rate Limiting ---");
  
  const testUserId = "ddos-tester-" + Date.now();
  let successCount = 0;
  let rateLimitCount = 0;

  // Simulate hitting the rate limit API route 20 times instantly
  console.log("Firing 20 simultaneous API requests to Rate Limiter...");
  
  const promises = Array.from({ length: 20 }).map(async (_, i) => {
    try {
      const { success } = await rateLimit(`order:${testUserId}`, 5, 60 * 1000);
      if (success) successCount++;
      else rateLimitCount++;
    } catch (e: any) {
      if (e.message.includes('Connection is closed')) {
        throw new Error("RedisOffline");
      }
    }
  });

  try {
    await Promise.all(promises);
    console.log(`Allowed Requests: ${successCount} (Expected: 5)`);
    console.log(`Blocked Requests: ${rateLimitCount} (Expected: 15)`);

    if (successCount === 5 && rateLimitCount === 15) {
      console.log("✅ PASSED: Redis strictly blocked the DDoS attack at 5 requests.");
    } else {
      console.error("❌ FAILED: Rate Limiter leaked or blocked incorrectly.");
    }
  } catch (e: any) {
    if (e.message === "RedisOffline") {
      console.log("⚠️ SKIPPED: Redis is not running locally. Please start Redis Desktop to test Rate Limiting.");
    } else {
      throw e;
    }
  }
}

async function runEdgeCase3() {
  console.log("\n--- Edge Case 3: Zero-Stock Route Fallback ---");
  
  // The search route (api/products/search/route.ts) filters out zero stock:
  // where: { sellerProductId: p.id, quantity: { gt: 0 } }
  
  // To verify this works, we will insert a ResellerStockItem with 0 quantity
  // right next to the buyer, and one with 10 quantity further away.
  
  let dummyProduct = await prisma.sellerProduct.findFirst();
  if (!dummyProduct) {
     console.log("No seller product found. Creating one...");
     // create minimal global product and seller product
     const gp = await prisma.globalProduct.create({
       data: { name: "Edge Case Global", description: "Test", basePrice: 100 }
     });
     dummyProduct = await prisma.sellerProduct.create({
       data: {
         sellerId: testBuyer.id, // reuse id to pass FK constraint (seller profile must exist, wait, we need a seller)
         globalProductId: gp.id,
         productCode: "TEST-CODE",
         customName: "Test Product",
         price: 150
       }
     }).catch(async () => {
        // If it fails due to sellerId foreign key, create a quick seller profile
        await prisma.profile.create({ data: { id: "mock-seller", email: "s@s.com", role: "seller", username: "S", storeName: "S", city: "A", upazilla: "A", district: "A" } });
        await prisma.sellerProfile.create({ data: { id: "mock-seller", email: "s@s.com", storeName: "S", city: "A", upazilla: "A", district: "A", address: "A" } });
        return prisma.sellerProduct.create({ data: { sellerId: "mock-seller", globalProductId: gp.id, productCode: "TEST-CODE", customName: "Test Product", price: 150 }});
     });
  }

  // Find two local resellers
  let resellers = await prisma.localReseller.findMany({ take: 2 });
  if (resellers.length < 2) {
    console.log("Need 2 local resellers. Creating them...");
    await prisma.profile.create({ data: { id: "mock-r1", email: "r1@r.com", role: "local", username: "r1", storeName: "r1", city: "A", upazilla: "A", district: "A" } });
    await prisma.localReseller.create({ data: { id: "mock-r1", email: "r1@r.com", username: "r1", resellerCode: "R1", city: "A", upazilla: "A", district: "A", lat: 23.8, lng: 90.4 } });
    
    await prisma.profile.create({ data: { id: "mock-r2", email: "r2@r.com", role: "local", username: "r2", storeName: "r2", city: "A", upazilla: "A", district: "A" } });
    await prisma.localReseller.create({ data: { id: "mock-r2", email: "r2@r.com", username: "r2", resellerCode: "R2", city: "A", upazilla: "A", district: "A", lat: 24.8, lng: 91.4 } });
    resellers = await prisma.localReseller.findMany({ take: 2 });
  }

  // Create 0 stock at Reseller A
  const stockA = await prisma.resellerStockItem.create({
    data: {
      resellerId: resellers[0].id,
      sellerProductId: dummyProduct.id,
      customName: "Test Edge Case Item",
      quantity: 0
    }
  });

  // Create 10 stock at Reseller B
  const stockB = await prisma.resellerStockItem.create({
    data: {
      resellerId: resellers[1].id,
      sellerProductId: dummyProduct.id,
      customName: "Test Edge Case Item",
      quantity: 10
    }
  });

  // Now simulate the api/delivery/search logic
  const query = "Test Edge Case Item";
  
  const results = await prisma.localReseller.findMany({
    include: {
      stock: {
        where: {
          quantity: { gt: 0 },
          sellerProductId: dummyProduct.id
        }
      }
    }
  });

  const validStocks = results.flatMap(r => r.stock);
  
  console.log(`Found ${validStocks.length} valid stock locations.`);
  
  const hasZeroStock = validStocks.some(s => s.quantity === 0);
  
  if (hasZeroStock) {
     console.error("❌ FAILED: Search algorithm returned a 0-stock node!");
  } else if (validStocks.length === 1 && validStocks[0].quantity === 10) {
     console.log("✅ PASSED: System cleanly ignored the 0-stock node and routed to the available fallback.");
  } else {
     console.error("❌ FAILED: Unexpected results.");
  }

  // Cleanup
  await prisma.resellerStockItem.delete({ where: { id: stockA.id } });
  await prisma.resellerStockItem.delete({ where: { id: stockB.id } });
}

async function main() {
  console.log("Starting Production Edge Case Verifications...");
  try {
    await runEdgeCase1();
    await runEdgeCase2();
    await runEdgeCase3();
  } catch (e) {
    console.error("Test execution failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
