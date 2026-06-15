import { prisma } from "./src/lib/prisma";
async function main() {
  const dhakaDistrict = await prisma.districtReseller.findFirst({ where: { district: { contains: "dhaka", mode: "insensitive" } } });
  const cumillaDistrict = await prisma.districtReseller.findFirst({ where: { district: { contains: "cumilla", mode: "insensitive" } } });

  const dhakaUpazillaMirpur = await prisma.upazillaReseller.findFirst({ where: { upazilla: "Mirpur" } });
  const dhakaUpazillaUttara = await prisma.upazillaReseller.findFirst({ where: { upazilla: "Uttara" } });
  const cumillaUpazillaBurichang = await prisma.upazillaReseller.findFirst({ where: { upazilla: "Burichang" } });
  const cumillaUpazillaDaudkandi = await prisma.upazillaReseller.findFirst({ where: { upazilla: "Daudkandi" } });

  const dhakaLocalMirpur = await prisma.localReseller.findFirst({ where: { upazilla: "Mirpur" } });
  const dhakaLocalUttara = await prisma.localReseller.findFirst({ where: { upazilla: "Uttara" } });
  
  const cumillaSeller = await prisma.profile.findFirst({ where: { upazilla: "Burichang", type: "seller" } });
  const dhakaSeller = await prisma.profile.findFirst({ where: { city: "Dhaka", type: "seller" } });
  
  console.log({
    dhakaDistrict: !!dhakaDistrict,
    cumillaDistrict: !!cumillaDistrict,
    dhakaUpazillaMirpur: !!dhakaUpazillaMirpur,
    dhakaUpazillaUttara: !!dhakaUpazillaUttara,
    cumillaUpazillaBurichang: !!cumillaUpazillaBurichang,
    cumillaUpazillaDaudkandi: !!cumillaUpazillaDaudkandi,
    dhakaLocalMirpur: !!dhakaLocalMirpur,
    dhakaLocalUttara: !!dhakaLocalUttara,
    cumillaSeller: !!cumillaSeller,
    dhakaSeller: !!dhakaSeller
  });
}
main().catch(console.error).finally(()=>prisma.$disconnect());
