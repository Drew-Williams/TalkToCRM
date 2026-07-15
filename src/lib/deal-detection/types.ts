export type CrmProvider = "hubspot" | "pipedrive";

export interface DetectedDeal {
  provider: CrmProvider;
  /** The CRM's numeric record id for the deal, as a string (HubSpot's hs_object_id, Pipedrive's deal id). */
  dealId: string;
  /** Full URL the deal was detected on, for the side panel's "open in CRM" link. */
  url: string;
  /** Ms epoch when this detection happened — used to prefer the freshest tab. */
  detectedAt: number;
  /**
   * Account-scoping value that differs per provider: HubSpot's numeric portal
   * id, or Pipedrive's company subdomain. Null when a matcher can't find one
   * (shouldn't happen in practice, but detectors never throw).
   */
  accountRef: string | null;
}
