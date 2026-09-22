export type RepRole = "account_executive" | "sdr_bdr" | "founder" | "sales_manager" | "other";

export interface UserProfile {
  displayName: string | null;
  role: RepRole | null;
  companyUrl: string | null;
  companyName: string | null;
  valueProp: string | null;
  icp: string | null;
  industry: string | null;
  competitors: string | null;
}

export const ROLE_LABELS: Record<RepRole, string> = {
  account_executive: "Account Executive",
  sdr_bdr: "SDR / BDR",
  founder: "Founder",
  sales_manager: "Sales Manager",
  other: "Other",
};

export interface InferredCompanyProfile {
  companyName: string | null;
  valueProp: string | null;
  icp: string | null;
  industry: string | null;
  competitors: string | null;
}
