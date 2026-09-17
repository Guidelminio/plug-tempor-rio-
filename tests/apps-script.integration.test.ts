import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

describe("Apps Script credential", () => {
  it("accepts a signed harmless health-check payload", async () => {
    const url = process.env.APPS_SCRIPT_SYNC_URL;
    const secret = process.env.APPS_SCRIPT_SYNC_SECRET;
    expect(url, "APPS_SCRIPT_SYNC_URL precisa estar configurada").toMatch(/^https:\/\//);
    expect(secret, "APPS_SCRIPT_SYNC_SECRET precisa estar configurada").toBeTruthy();
    const payload = { action: "healthcheck" };
    const signature = createHmac("sha256", secret!).update(Buffer.from(JSON.stringify(payload), "utf8").toString("base64")).digest("base64");
    const response = await fetch(url!, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload, signature }) });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(body).toContain("Ação não reconhecida");
  }, 20_000);
});
