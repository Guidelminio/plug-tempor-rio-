import { describe, expect, it } from "vitest";
import { allowedOriginsFromEnvironment, isOriginAllowed } from "../server/_core/cors";
import { dateKeyFromDate, formatCivilDate, isDateKey, todayDateKey, weekdayForDateKey } from "../shared/civil-date";

describe("CORS policy", () => {
  it("does not reflect arbitrary origins", () => {
    const allowed = allowedOriginsFromEnvironment("https://presenca.example.org.br, http://localhost:8081");
    expect(isOriginAllowed("https://presenca.example.org.br", allowed)).toBe(true);
    expect(isOriginAllowed("https://example.com", allowed)).toBe(false);
  });

  it("normalizes a trailing slash in configured origins", () => {
    const allowed = allowedOriginsFromEnvironment("https://presenca.example.org.br/");
    expect(isOriginAllowed("https://presenca.example.org.br", allowed)).toBe(true);
  });
});

describe("civil date rules", () => {
  it("validates date keys without interpreting them as local instants", () => {
    expect(isDateKey("2026-09-14")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("14/09/2026")).toBe(false);
  });

  it("keeps a database date on the same calendar day", () => {
    expect(dateKeyFromDate(new Date("2026-09-14T00:00:00.000Z"))).toBe("2026-09-14");
    expect(formatCivilDate("2026-09-14")).toMatch(/14/);
  });

  it("calculates the weekday from the civil date", () => {
    expect(weekdayForDateKey("2026-09-14")).toBe(1);
    expect(todayDateKey("America/Sao_Paulo", new Date("2026-09-15T02:30:00.000Z"))).toBe("2026-09-14");
  });
});
