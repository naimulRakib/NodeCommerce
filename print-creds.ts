import { prisma } from "./src/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({ select: { username: true, email: true } });
  
  console.log("--- Sellers ---");
  const sellers = await prisma.profile.findMany({ where: { type: "seller" }, select: { city: true, username: true } });
  sellers.forEach(s => {
    const user = users.find(u => u.username === s.username);
    console.log(`${s.city} - ${s.username}: ${user?.email || s.username + "@demo.com"}`);
  });
  
  console.log("\n--- Buyers ---");
  const buyers = await prisma.profile.findMany({ where: { type: "buyer" }, select: { city: true, username: true } });
  buyers.forEach(b => {
    const user = users.find(u => u.username === b.username);
    console.log(`${b.city} - ${b.username}: ${user?.email || b.username + "@demo.com"}`);
  });
}

main().catch(console.error).finally(()=>prisma.$disconnect());
