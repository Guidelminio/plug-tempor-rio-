import { describe, expect, it } from "vitest";
import { hashPassword, normalizeLogin, validatePassword, verifyPassword } from "../server/local-password";

describe("local password security", () => {
  it("normalizes login and never stores a readable password", async () => {
    expect(normalizeLogin(" Professor@Escola.Com ")).toBe("professor@escola.com");
    const hash = await hashPassword("Senha123");
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("Senha123");
    await expect(verifyPassword("Senha123", hash)).resolves.toBe(true);
    await expect(verifyPassword("Outra123", hash)).resolves.toBe(false);
  });

  it("rejects short or weak passwords", () => {
    expect(() => validatePassword("abc")).toThrow("pelo menos 8");
    expect(() => validatePassword("somenteletras")).toThrow("letra e um número");
    expect(() => validatePassword("12345678")).toThrow("letra e um número");
  });
});
