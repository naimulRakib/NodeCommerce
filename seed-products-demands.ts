import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { prisma } from "./src/lib/prisma";

const DEMO_PRODUCTS = [
  { title: "Demo Product Alpha", productCode: "DEMO-ALP-01", demand: 50, price: 10.0, stock: 1000 },
  { title: "Demo Product Beta", productCode: "DEMO-BET-02", demand: 120, price: 20.0, stock: 1000 },
  { title: "Demo Product Gamma", productCode: "DEMO-GAM-03", demand: 75, price: 15.0, stock: 1000 },
  { title: "Demo Product Delta", productCode: "DEMO-DEL-04", demand: 200, price: 8.0, stock: 1000 },
  { title: "Demo Product Epsilon", productCode: "DEMO-EPS-05", demand: 30, price: 40.0, stock: 1000 },
];

async function seedProductsAndDemands() {
  console.log("Starting to seed products and local demands...");

  // 1. Get the seller profile
  const seller = await prisma.profile.findFirst({
    where: { type: "seller" }
  });

  if (!seller) {
    console.error("Seller not found! Please run the main seed script first.");
    return;
  }

  // 2. Clear existing demo products to avoid duplicates
  await prisma.sellerProduct.deleteMany({
    where: { sellerId: seller.id, productCode: { startsWith: "DEMO-" } }
  });

  // 3. Create the 5 demo products
  console.log("Creating 5 Demo Products for the Global Seller...");
  for (const prod of DEMO_PRODUCTS) {
    await prisma.sellerProduct.create({
      data: {
        sellerId: seller.id,
        customName: prod.title,
        productCode: prod.productCode,
        price: prod.price,
        stock: prod.stock,
        status: "approved"
      }
    });
  }

  // 4. Get all local resellers
  const localResellers = await prisma.localReseller.findMany();
  if (localResellers.length === 0) {
    console.error("No local resellers found to assign demands to.");
    return;
  }

  console.log(`Found ${localResellers.length} local resellers. Assigning demands randomly...`);

  // Clear existing local demands
  await prisma.localDemand.deleteMany();
  await prisma.upazillaDemand.deleteMany();

  // 5. Assign the demands
  for (const prod of DEMO_PRODUCTS) {
    // Pick a random local reseller
    const randomIndex = Math.floor(Math.random() * localResellers.length);
    const assignedReseller = localResellers[randomIndex];

    console.log(`Assigning ${prod.demand} units of ${prod.title} to ${assignedReseller.email}`);

    // Create Local Demand
    await prisma.localDemand.create({
      data: {
        localResellerId: assignedReseller.id,
        productCode: prod.productCode,
        productName: prod.title,
        demandQuantity: prod.demand,
      }
    });

    // Bubble up to Upazilla Demand
    const upazillaReseller = await prisma.upazillaReseller.findFirst({
      where: { upazilla: assignedReseller.upazilla }
    });

    if (upazillaReseller) {
      const existingUpazillaDemand = await prisma.upazillaDemand.findFirst({
        where: {
          upazillaResellerId: upazillaReseller.id,
          productName: prod.title
        }
      });

      if (existingUpazillaDemand) {
        await prisma.upazillaDemand.update({
          where: { id: existingUpazillaDemand.id },
          data: { demandQuantity: existingUpazillaDemand.demandQuantity + prod.demand }
        });
      } else {
        await prisma.upazillaDemand.create({
          data: {
            upazillaResellerId: upazillaReseller.id,
            productName: prod.title,
            demandQuantity: prod.demand,
            enteredBy: upazillaReseller.id
          }
        });
      }
    }
  }

  console.log("Successfully seeded Products and Local Demands!");
}

seedProductsAndDemands()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
