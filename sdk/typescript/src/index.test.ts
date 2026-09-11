import { describe, expect, it } from "vitest";
import { LaaWaApiError } from "./index";

describe("LaaWa SDK", () => {
  it("exposes structured API errors", () => {
    const error = new LaaWaApiError(401, { code: "AUTH_REQUIRED", message: "Authentication is required." });
    expect(error.status).toBe(401);
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(error.message).toContain("Authentication");
  });
});
