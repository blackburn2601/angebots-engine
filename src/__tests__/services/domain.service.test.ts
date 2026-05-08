import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { DomainService } from "@/services/DomainService";
import { db, truncateDomains } from "../helpers/db";

// Requires DATABASE_URL pointing to a test/dev PostgreSQL instance.
// In CI this is provided by the postgres service container.
// Locally: docker compose up -d, then npm test

beforeEach(async () => {
  await truncateDomains();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("DomainService.create", () => {
  it("creates a domain with a slugified name", async () => {
    const domain = await DomainService.create("Photovoltaik Anlage");
    expect(domain.name).toBe("Photovoltaik Anlage");
    expect(domain.slug).toBe("photovoltaik-anlage");
    expect(domain.id).toBeTruthy();
  });

  it("handles German umlauts in slugs", async () => {
    const domain = await DomainService.create("Dachfenster Überprüfung");
    expect(domain.slug).toBe("dachfenster-ueberpruefung");
  });

  it("appends a counter when slug already exists", async () => {
    await DomainService.create("Solar");
    const second = await DomainService.create("Solar");
    expect(second.slug).toBe("solar-1");
    const third = await DomainService.create("Solar");
    expect(third.slug).toBe("solar-2");
  });

  it("sets a default empty config_json", async () => {
    const domain = await DomainService.create("Test");
    const config = DomainService.parseConfig(domain.config_json);
    expect(config.felder).toEqual([]);
    expect(config.komponenten).toEqual([]);
  });
});

describe("DomainService.findById", () => {
  it("returns the domain when it exists", async () => {
    const created = await DomainService.create("Fundament");
    const found = await DomainService.findById(created.id);
    expect(found?.name).toBe("Fundament");
  });

  it("returns null for an unknown id", async () => {
    const found = await DomainService.findById("non-existent-id");
    expect(found).toBeNull();
  });
});

describe("DomainService.findAll", () => {
  it("returns all domains ordered by updated_at desc", async () => {
    await DomainService.create("Alpha");
    await DomainService.create("Beta");
    const all = await DomainService.findAll();
    expect(all.length).toBeGreaterThanOrEqual(2);
    // Most recently updated first
    const names = all.map((d) => d.name);
    expect(names.indexOf("Beta")).toBeLessThan(names.indexOf("Alpha"));
  });

  it("returns empty array when no domains exist", async () => {
    const all = await DomainService.findAll();
    expect(all).toEqual([]);
  });
});

describe("DomainService.update", () => {
  it("updates the domain name", async () => {
    const domain = await DomainService.create("Alt");
    await DomainService.update(domain.id, { name: "Neu" });
    const updated = await DomainService.findById(domain.id);
    expect(updated?.name).toBe("Neu");
  });

  it("updates config_json", async () => {
    const domain = await DomainService.create("Config Test");
    const newConfig = JSON.stringify({ felder: [{ key: "x", label: "X", typ: "number" }], parameter: [], validierungen: [], regelwerk: [], komponenten: [] });
    await DomainService.update(domain.id, { config_json: newConfig });
    const updated = await DomainService.findById(domain.id);
    const parsed = DomainService.parseConfig(updated!.config_json);
    expect(parsed.felder).toHaveLength(1);
    expect(parsed.felder[0].key).toBe("x");
  });
});

describe("DomainService.delete", () => {
  it("removes the domain", async () => {
    const domain = await DomainService.create("Zu löschen");
    await DomainService.delete(domain.id);
    const found = await DomainService.findById(domain.id);
    expect(found).toBeNull();
  });
});

describe("DomainService.duplicate", () => {
  it("creates a copy with '(Kopie)' suffix and unique slug", async () => {
    const original = await DomainService.create("Original");
    const copy = await DomainService.duplicate(original.id);
    expect(copy.name).toBe("Original (Kopie)");
    expect(copy.slug).toBe("original-kopie");
    expect(copy.id).not.toBe(original.id);
  });

  it("duplicates the config_json", async () => {
    const config = JSON.stringify({ felder: [{ key: "y", label: "Y", typ: "number" }], parameter: [], validierungen: [], regelwerk: [], komponenten: [] });
    const original = await DomainService.create("Mit Config");
    await DomainService.update(original.id, { config_json: config });
    const copy = await DomainService.duplicate(original.id);
    expect(copy.config_json).toBe(config);
  });

  it("handles duplicate slug collision for copies", async () => {
    const original = await DomainService.create("Basis");
    await DomainService.duplicate(original.id); // creates "basis-kopie"
    const second = await DomainService.duplicate(original.id);
    expect(second.slug).toBe("basis-kopie-1");
  });
});

describe("DomainService.parseConfig", () => {
  it("parses valid JSON into DomainConfig", () => {
    const json = JSON.stringify({ felder: [], parameter: [], validierungen: [], regelwerk: [], komponenten: [] });
    const config = DomainService.parseConfig(json);
    expect(config.felder).toEqual([]);
  });

  it("returns empty config for invalid JSON without throwing", () => {
    const config = DomainService.parseConfig("{ this is broken }");
    expect(config.felder).toEqual([]);
    expect(config.komponenten).toEqual([]);
  });

  it("returns empty config for empty string", () => {
    const config = DomainService.parseConfig("");
    expect(config.felder).toEqual([]);
  });
});
