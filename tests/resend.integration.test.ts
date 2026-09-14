import { describe, expect, it } from "vitest";

describe("Resend credential", () => {
  it("authenticates against the lightweight domains endpoint", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey, "RESEND_API_KEY precisa estar configurada").toMatch(/^re_/);

    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const body = await response.text();
    expect(response.status, body).toBe(200);
  }, 20_000);
});
