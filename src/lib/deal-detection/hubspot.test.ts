import { describe, expect, it } from "vitest";
import { detectHubspotDeal } from "./hubspot";

describe("detectHubspotDeal", () => {
  it("matches the current record UI path", () => {
    const result = detectHubspotDeal("https://app.hubspot.com/contacts/5424656/record/0-3/15865742643");
    expect(result).toEqual({
      provider: "hubspot",
      dealId: "15865742643",
      url: "https://app.hubspot.com/contacts/5424656/record/0-3/15865742643",
      detectedAt: expect.any(Number),
      accountRef: "5424656",
    });
  });

  it("matches the record UI path with a trailing tab segment", () => {
    const result = detectHubspotDeal(
      "https://app.hubspot.com/contacts/5424656/record/0-3/15865742643/view/activities",
    );
    expect(result?.dealId).toBe("15865742643");
    expect(result?.accountRef).toBe("5424656");
  });

  it("matches the legacy deal path", () => {
    const result = detectHubspotDeal("https://app.hubspot.com/contacts/5424656/deal/15865742643");
    expect(result).toMatchObject({
      provider: "hubspot",
      dealId: "15865742643",
      accountRef: "5424656",
    });
  });

  it("returns null for a HubSpot contact record (wrong object type)", () => {
    const result = detectHubspotDeal("https://app.hubspot.com/contacts/5424656/record/0-1/15865742643");
    expect(result).toBeNull();
  });

  it("returns null for HubSpot pages that aren't deal records", () => {
    expect(detectHubspotDeal("https://app.hubspot.com/reports-dashboard/5424656")).toBeNull();
    expect(detectHubspotDeal("https://app.hubspot.com/contacts/5424656/objectLists")).toBeNull();
  });

  it("returns null for non-HubSpot hosts", () => {
    expect(detectHubspotDeal("https://example.com/contacts/5424656/record/0-3/15865742643")).toBeNull();
  });

  it("returns null for malformed URLs instead of throwing", () => {
    expect(detectHubspotDeal("not-a-url")).toBeNull();
  });
});
