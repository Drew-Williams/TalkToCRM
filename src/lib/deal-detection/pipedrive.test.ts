import { describe, expect, it } from "vitest";
import { detectPipedriveDeal } from "./pipedrive";

describe("detectPipedriveDeal", () => {
  it("matches a standard company subdomain deal page", () => {
    const result = detectPipedriveDeal("https://leadpager2.pipedrive.com/deal/47");
    expect(result).toEqual({
      provider: "pipedrive",
      dealId: "47",
      url: "https://leadpager2.pipedrive.com/deal/47",
      detectedAt: expect.any(Number),
      accountRef: "leadpager2",
    });
  });

  it("matches subdomains containing hyphens and digits", () => {
    const result = detectPipedriveDeal("https://routerjet-sandbox-f4655c.pipedrive.com/deal/1358");
    expect(result?.dealId).toBe("1358");
    expect(result?.accountRef).toBe("routerjet-sandbox-f4655c");
  });

  it("matches deal pages with trailing sub-routes (e.g. activity tab)", () => {
    const result = detectPipedriveDeal("https://leadpager2.pipedrive.com/deal/47/activities");
    expect(result?.dealId).toBe("47");
  });

  it("returns null for non-deal Pipedrive pages", () => {
    expect(detectPipedriveDeal("https://leadpager2.pipedrive.com/pipeline")).toBeNull();
    expect(detectPipedriveDeal("https://leadpager2.pipedrive.com/person/12")).toBeNull();
  });

  it("returns null for non-Pipedrive hosts", () => {
    expect(detectPipedriveDeal("https://example.com/deal/47")).toBeNull();
  });

  it("returns null for malformed URLs instead of throwing", () => {
    expect(detectPipedriveDeal("not-a-url")).toBeNull();
  });
});
