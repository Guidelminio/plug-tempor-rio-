import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "apps-script/Code.gs"), "utf8");

describe("Apps Script sync bridge contract", () => {
  it("validates a signed payload and keeps an idempotent batch control", () => {
    expect(source).toContain("Utilities.computeHmacSha256Signature");
    expect(source).toContain("safeEqual_");
    expect(source).toContain("hasBatch_");
    expect(source).toContain("Controle_Sincronização");
  });

  it("writes attendance in batch rows without deleting historical entries", () => {
    expect(source).toContain("attendanceSheet.getRange");
    expect(source).not.toContain("deleteRow");
    expect(source).not.toContain("clearContents");
  });
});
