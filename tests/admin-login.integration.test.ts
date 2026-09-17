import { describe, expect, it } from "vitest";
import { bootstrapInitialAdmin, authenticateLocalUser } from "../server/db";
import { ENV } from "../server/_core/env";

describe("initial administrator login", () => {
  it("bootstraps and authenticates the protected admin account", async () => {
    expect(ENV.initialAdminEmail).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(ENV.initialAdminPassword.length).toBeGreaterThanOrEqual(8);

    const bootstrapped = await bootstrapInitialAdmin();
    expect(bootstrapped?.role).toBe("admin");

    const authenticated = await authenticateLocalUser(ENV.initialAdminEmail, ENV.initialAdminPassword);
    expect(authenticated?.role).toBe("admin");
    expect(authenticated?.active).toBe(true);
    expect(authenticated?.passwordHash).toMatch(/^scrypt\$/);
  }, 30_000);
});
