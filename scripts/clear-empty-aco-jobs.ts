import { prisma } from "../src/lib/prisma";

async function main() {
  // Remove old ACO jobs that have 0 shipments (the broken runs)
  const bad = await prisma.aCOGlobalJob.findMany({
    include: { shipments: true }
  });
  const toDelete = bad.filter(j => j.shipments.length === 0).map(j => j.id);
  if (toDelete.length > 0) {
    await prisma.aCOGlobalJob.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`✅ Removed ${toDelete.length} empty ACO jobs`);
  } else {
    console.log("No empty ACO jobs to remove");
  }
  console.log("Done. Ready to run fresh ACO.");
}

main().catch(console.error).finally(() => process.exit(0));
