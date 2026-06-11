import { prisma } from '@/lib/prisma';

const PRODUCTS = [
  "Miniket Rice",
  "Rupchanda Soyabean Oil",
  "Fresh Atta",
  "Radhuni Turmeric Powder",
  "Pran Mango Juice",
  "Aarong Dairy Milk",
  "Teer Sugar",
  "Danish Condensed Milk"
];

export async function generateRandomDemand() {
  console.log("[Demand Generator] Starting random demand injection...");

  // Fetch all upazilla resellers
  const upazillaResellers = await prisma.upazillaReseller.findMany();
  if (upazillaResellers.length === 0) {
    console.log("[Demand Generator] No upazilla resellers found.");
    return { generated: 0 };
  }

  let count = 0;

  for (const reseller of upazillaResellers) {
    // Pick 3-5 random products
    const shuffled = PRODUCTS.sort(() => 0.5 - Math.random());
    const selectedProducts = shuffled.slice(0, Math.floor(Math.random() * 3) + 3);

    for (const product of selectedProducts) {
      const demandQty = Math.floor(Math.random() * 500) + 100; // 100 to 600

      await prisma.upazillaDemand.upsert({
        where: {
          upazillaResellerId_productName: {
            upazillaResellerId: reseller.id,
            productName: product
          }
        },
        update: {
          demandQuantity: { increment: demandQty },
          status: 'pending',
          updatedAt: new Date()
        },
        create: {
          upazillaResellerId: reseller.id,
          productName: product,
          demandQuantity: demandQty,
          fulfilledQuantity: 0,
          status: 'pending',
          enteredBy: 'SYSTEM_AUTO'
        }
      });
      count++;
    }
  }

  console.log(`[Demand Generator] Injected ${count} new demand records.`);
  return { generated: count };
}
