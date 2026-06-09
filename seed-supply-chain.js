const { PrismaClient } = require("./src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  console.log("Starting supply chain seed...");

  // 1. Create or get District Reseller
  const districtReseller = await prisma.districtReseller.upsert({
    where: { email: 'cumilla@gmail.com' },
    update: {},
    create: {
      id: 'demo-district-cumilla',
      email: 'cumilla@gmail.com',
      district: 'Comilla',
    },
  });
  console.log("District Reseller:", districtReseller.email);

  // 2. Create or get Upazilla Reseller (Burichang)
  // Note: the user mentioned they already inserted id: 6fad7a85-785e-48c6-955b-c03446f9599c
  const upazillaReseller = await prisma.upazillaReseller.upsert({
    where: { email: 'lr1@gmail.com' },
    update: {},
    create: {
      id: '6fad7a85-785e-48c6-955b-c03446f9599c',
      email: 'lr1@gmail.com',
      city: 'Comilla',
      upazilla: 'Burichang',
    },
  });
  console.log("Upazilla Reseller:", upazillaReseller.email);

  // 3. Create or get Local Reseller (Burichang)
  const localReseller = await prisma.localReseller.upsert({
    where: { email: 'local.burichang@test.com' },
    update: {},
    create: {
      id: 'demo-local-burichang',
      email: 'local.burichang@test.com',
      username: 'Burichang Demo Store',
      city: 'Comilla',
      upazilla: 'Burichang',
      resellerCode: 'BUR123',
      lat: 23.5500, // Approximate Burichang lat
      lng: 91.1333, // Approximate Burichang lng
    },
  });
  console.log("Local Reseller:", localReseller.username);

  // 4. Create District Stock Item
  const distStock = await prisma.districtStockItem.create({
    data: {
      districtResellerId: districtReseller.id,
      productName: 'Demo Smartphone X',
      brand: 'TechBrand',
      category: 'Electronics',
      quantity: 500, // Started with 500
    },
  });
  console.log("Created District Stock:", distStock.productName);

  // 5. Transfer to Upazilla
  const distTransfer = await prisma.districtTransfer.create({
    data: {
      districtResellerId: districtReseller.id,
      upazillaResellerId: upazillaReseller.id,
      stockItemId: distStock.id,
      quantity: 100,
      status: 'accepted',
    },
  });
  
  // Deduct from District
  await prisma.districtStockItem.update({
    where: { id: distStock.id },
    data: { quantity: distStock.quantity - 100 },
  });

  // 6. Receive at Upazilla (Create Upazilla Stock Item)
  const upzStock = await prisma.upazillaStockItem.create({
    data: {
      upazillaResellerId: upazillaReseller.id,
      productName: distStock.productName,
      brand: distStock.brand,
      category: distStock.category,
      quantity: 100,
    },
  });
  console.log("Upazilla received stock, transfer ID:", distTransfer.id);

  // 7. Transfer to Local
  const localTransfer = await prisma.stockTransfer.create({
    data: {
      upazillaResellerId: upazillaReseller.id,
      localResellerId: localReseller.id,
      stockItemId: upzStock.id,
      quantity: 20,
      status: 'accepted',
    },
  });

  // Deduct from Upazilla
  await prisma.upazillaStockItem.update({
    where: { id: upzStock.id },
    data: { quantity: upzStock.quantity - 20 },
  });

  // 8. Receive at Local (Create Reseller Stock Item)
  // Note: local stock item requires a sellerProductId or customName
  const localStock = await prisma.resellerStockItem.create({
    data: {
      resellerId: localReseller.id,
      customName: upzStock.productName,
      quantity: 20,
    },
  });
  console.log("Local received stock, transfer ID:", localTransfer.id);
  console.log("Seed complete. Data hierarchy is set up!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
