import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const name = process.env.SEED_ADMIN_NAME ?? "Super Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, name, password: hash, rolle: "SUPER_ADMIN" },
  });

  console.log(`Created SUPER_ADMIN: ${email}`);

  // Create example domain with carport config
  const carportConfig = {
    felder: [
      { key: "laenge", label: "Länge", typ: "number", einheit: "m", min: 2, max: 20, standard: 5, pflicht: true },
      { key: "breite", label: "Breite", typ: "number", einheit: "m", min: 2, max: 8, standard: 3, pflicht: true },
      { key: "material", label: "Material", typ: "select", optionen: ["Aluminium", "Stahl", "Holz"], standard: "Aluminium", pflicht: true },
      { key: "solar", label: "Solar-Option", typ: "boolean", standard: false },
      { key: "schneelastzone", label: "Schneelastzone", typ: "select", optionen: ["SLZ1", "SLZ2", "SLZ3", "SLZ4"], standard: "SLZ2" },
      { key: "dachflaeche", label: "Dachfläche", typ: "formula", einheit: "m²", formel: "laenge * breite" },
      { key: "stuetzen", label: "Stützenanzahl", typ: "output", einheit: "Stk" },
      { key: "fundament_tiefe", label: "Fundament-Tiefe", typ: "output", einheit: "m" },
    ],
    parameter: [
      { feld: "laenge" }, { feld: "breite" }, { feld: "material" },
      { feld: "solar" }, { feld: "schneelastzone" },
    ],
    validierungen: [
      {
        typ: "fehler",
        bedingung: { verknuepfung: "AND", regeln: [{ feld: "breite", op: ">", vergleich_feld: "laenge" }] },
        meldung: "Breite darf nicht größer als Länge sein",
      },
    ],
    regelwerk: [
      {
        ziel_feld: "stuetzen",
        auswertung: "erste_zutreffende",
        regeln: [
          { verknuepfung: "AND", bedingungen: [{ feld: "laenge", op: ">", wert: 7 }, { feld: "material", op: "==", wert: "Holz" }], dann: 8 },
          { verknuepfung: "AND", bedingungen: [{ feld: "laenge", op: ">", wert: 7 }], dann: 6 },
          { verknuepfung: "AND", bedingungen: [{ feld: "laenge", op: ">", wert: 5 }], dann: 4 },
          { bedingungen: [], dann: 2 },
        ],
      },
      {
        ziel_feld: "fundament_tiefe",
        auswertung: "erste_zutreffende",
        regeln: [
          { verknuepfung: "AND", bedingungen: [{ feld: "material", op: "==", wert: "Stahl" }], dann: 1.2 },
          { verknuepfung: "AND", bedingungen: [{ feld: "material", op: "==", wert: "Holz" }], dann: 1.0 },
          { bedingungen: [], dann: 0.8 },
        ],
      },
      {
        typ: "freitext",
        text: "Bei Carports in Hanglage muss die bergseitige Stütze immer 30 cm tiefer fundiert werden als die Berechnung ergibt. Diesen Hinweis immer im Angebot erwähnen.",
        aktiv_wenn: null,
      },
    ],
    komponenten: [
      {
        id: "stuetze",
        name: "Stütze",
        menge_feld: "stuetzen",
        aktivierung: [],
        varianten: [
          { wenn_feld: "material", op: "==", wert: "Aluminium", artikel_nr: "ALU-ST-100" },
          { wenn_feld: "material", op: "==", wert: "Stahl", artikel_nr: "STL-ST-100" },
          { standard: true, artikel_nr: "HOL-ST-100" },
        ],
        abhaengigkeiten: [],
        konflikte: [],
      },
      {
        id: "solaranlage",
        name: "Solaranlage",
        menge_feld: "dachflaeche",
        aktivierung: [{ feld: "solar", op: "==", wert: true, verknuepfung: "AND" }],
        varianten: [{ standard: true, artikel_nr: "SOLAR-MOD" }],
        abhaengigkeiten: [],
        konflikte: [],
      },
    ],
  };

  await prisma.domain.upsert({
    where: { slug: "carport-demo" },
    update: {},
    create: {
      name: "Carport Demo",
      slug: "carport-demo",
      config_json: JSON.stringify(carportConfig),
    },
  });

  // Demo pricelist
  const items = [
    { artikel_nr: "ALU-ST-100", bezeichnung: "Stütze Aluminium 100×100 mm", einheit: "Stk", ek_preis: 84, waehrung: "EUR", steuer_prozent: 19 },
    { artikel_nr: "STL-ST-100", bezeichnung: "Stütze Stahl 100×100 mm", einheit: "Stk", ek_preis: 62, waehrung: "EUR", steuer_prozent: 19 },
    { artikel_nr: "HOL-ST-100", bezeichnung: "Stütze Holz 100×100 mm", einheit: "Stk", ek_preis: 45, waehrung: "EUR", steuer_prozent: 19 },
    { artikel_nr: "SOLAR-MOD", bezeichnung: "Solar-Modul 400W", einheit: "m²", ek_preis: 220, waehrung: "EUR", steuer_prozent: 19 },
  ];

  const pl = await prisma.pricelist.upsert({
    where: { id: "demo-pricelist" },
    update: {},
    create: { id: "demo-pricelist", name: "Demo Preisliste 2025", items_json: JSON.stringify(items) },
  });

  const domain = await prisma.domain.findUnique({ where: { slug: "carport-demo" } });
  if (domain) {
    await prisma.domainPricelist.upsert({
      where: { domainId_pricelistId: { domainId: domain.id, pricelistId: pl.id } },
      update: {},
      create: { domainId: domain.id, pricelistId: pl.id },
    });
  }

  console.log("Demo data created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
