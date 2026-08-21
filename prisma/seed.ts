/**
 * Dati di esempio per lo sviluppo.
 *
 * Le date sono relative a oggi, così il catalogo mostra sempre tutti e tre gli
 * stati — libero, prenotato, in uso — senza doverle riscrivere ogni settimana.
 *
 *   pnpm db:seed
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client.ts";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Giorno intero UTC, spostato di `offset` giorni rispetto a oggi. */
function day(offset: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)
  );
}

const CATEGORIES = [
  { slug: "audio", name: "Audio", sortOrder: 1 },
  { slug: "video", name: "Video", sortOrder: 2 },
  { slug: "luci", name: "Luci", sortOrder: 3 },
  { slug: "palco", name: "Palco", sortOrder: 4 },
];

const ASSETS = [
  { name: "Mixer Yamaha MG10XU", cat: "audio", loc: "Magazzino · scaffale A1" },
  { name: "Cassa attiva RCF ART 310 · L", cat: "audio", loc: "Magazzino · scaffale A2" },
  { name: "Cassa attiva RCF ART 310 · R", cat: "audio", loc: "Magazzino · scaffale A2" },
  { name: "Stativo per cassa · 01", cat: "audio", loc: "Magazzino · rastrelliera" },
  { name: "Stativo per cassa · 02", cat: "audio", loc: "Magazzino · rastrelliera" },
  { name: "Microfono Shure SM58 · 01", cat: "audio", loc: "Magazzino · cassetto B1" },
  { name: "Microfono Shure SM58 · 02", cat: "audio", loc: "Magazzino · cassetto B1" },
  { name: "Registratore Zoom H6", cat: "audio", loc: "Ufficio · armadio" },
  { name: "Proiettore Epson EB-2250U", cat: "video", loc: "Ufficio · armadio" },
  { name: "Telo di proiezione 3×2 m", cat: "video", loc: "Magazzino · scaffale C1" },
  { name: "Videocamera Sony FX30", cat: "video", loc: "Ufficio · cassaforte" },
  { name: "Treppiede Manfrotto 190", cat: "video", loc: "Ufficio · armadio" },
  { name: "Faro LED PAR 64 · 01", cat: "luci", loc: "Magazzino · scaffale D2" },
  { name: "Faro LED PAR 64 · 02", cat: "luci", loc: "Magazzino · scaffale D2" },
  { name: "Faro LED PAR 64 · 03", cat: "luci", loc: "Magazzino · scaffale D2" },
  { name: "Centralina luci DMX 12 canali", cat: "luci", loc: "Magazzino · scaffale D1" },
  { name: "Americana 3 m", cat: "palco", loc: "Magazzino · fondo" },
  { name: "Pedana modulare 2×1 m · 01", cat: "palco", loc: "Magazzino · fondo" },
  { name: "Pedana modulare 2×1 m · 02", cat: "palco", loc: "Magazzino · fondo" },
  { name: "Fondale nero 6×4 m", cat: "palco", loc: "Magazzino · scaffale C2" },
];

async function main() {
  console.log("Pulizia…");
  // L'ordine conta: prima chi ha le chiavi esterne.
  await db.message.deleteMany();
  await db.requestItem.deleteMany();
  await db.request.deleteMany();
  await db.kitAsset.deleteMany();
  await db.kit.deleteMany();
  await db.assetPhoto.deleteMany();
  await db.asset.deleteMany();
  await db.category.deleteMany();
  await db.user.deleteMany();

  console.log("Categorie…");
  const categories = new Map<string, string>();
  for (const c of CATEGORIES) {
    const created = await db.category.create({ data: c });
    categories.set(c.slug, created.id);
  }

  console.log("Oggetti…");
  const assets = new Map<string, string>();
  for (const a of ASSETS) {
    const created = await db.asset.create({
      data: {
        name: a.name,
        location: a.loc,
        categoryId: categories.get(a.cat)!,
      },
    });
    assets.set(a.name, created.id);
  }

  // Un oggetto visibile ma non prenotabile, per verificare quel percorso.
  await db.asset.create({
    data: {
      name: "Mixer Behringer X32 (in riparazione)",
      categoryId: categories.get("audio")!,
      location: "Dal tecnico",
      isBookable: false,
      adminNotes: "Canale 7 muto. Preventivo chiesto il mese scorso.",
    },
  });

  console.log("Kit…");
  const kitMembers = [
    "Mixer Yamaha MG10XU",
    "Cassa attiva RCF ART 310 · L",
    "Cassa attiva RCF ART 310 · R",
    "Stativo per cassa · 01",
    "Stativo per cassa · 02",
  ];
  const kit = await db.kit.create({
    data: {
      name: "Kit audio base",
      description: "Impianto per una sala fino a 100 persone. Mixer, casse, stativi.",
      assets: {
        create: kitMembers.map((name, i) => ({
          assetId: assets.get(name)!,
          sortOrder: i,
        })),
      },
    },
  });

  console.log("Persone…");
  const admin = await db.user.create({
    data: {
      email: "mogno.samu@gmail.com",
      name: "Samu",
      role: "ADMIN",
      isMember: true,
      language: "IT",
    },
  });
  const giulia = await db.user.create({
    data: { email: "giulia@esempio.org", name: "Giulia Ferrari", isMember: true, language: "IT" },
  });
  const lukas = await db.user.create({
    data: { email: "lukas@esempio.org", name: "Lukas Berger", language: "DE" },
  });

  console.log("Richieste…");

  // In corso: ritirato, non ancora restituito → badge "In uso".
  await db.request.create({
    data: {
      userId: giulia.id,
      startDate: day(-2),
      endDate: day(3),
      status: "APPROVED",
      purpose: "Rassegna di cortometraggi in biblioteca",
      decidedAt: new Date(),
      decidedById: admin.id,
      items: {
        create: [
          { assetId: assets.get("Proiettore Epson EB-2250U")!, pickedUpAt: new Date() },
          { assetId: assets.get("Telo di proiezione 3×2 m")!, pickedUpAt: new Date() },
        ],
      },
    },
  });

  // Futura: approvata ma non ritirata → badge "Prenotato".
  await db.request.create({
    data: {
      userId: lukas.id,
      startDate: day(6),
      endDate: day(9),
      status: "APPROVED",
      purpose: "Konzert im Gemeindesaal",
      decidedAt: new Date(),
      decidedById: admin.id,
      items: {
        create: kitMembers.map((name) => ({
          assetId: assets.get(name)!,
          fromKitId: kit.id,
        })),
      },
    },
  });

  // In attesa: non blocca niente, l'oggetto resta libero per tutti.
  const pending = await db.request.create({
    data: {
      userId: giulia.id,
      startDate: day(14),
      endDate: day(16),
      status: "PENDING",
      purpose: "Riprese del laboratorio teatrale",
      items: {
        create: [
          { assetId: assets.get("Videocamera Sony FX30")! },
          { assetId: assets.get("Treppiede Manfrotto 190")! },
        ],
      },
    },
  });

  await db.message.create({
    data: {
      requestId: pending.id,
      authorId: admin.id,
      body: "Ciao Giulia, la videocamera c'è. Riesci a passare di venerdì invece che di giovedì?",
    },
  });

  const counts = {
    oggetti: await db.asset.count(),
    kit: await db.kit.count(),
    persone: await db.user.count(),
    richieste: await db.request.count(),
  };
  console.log("Fatto:", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
