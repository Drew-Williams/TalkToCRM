import { detectHubspotDeal } from "@/lib/deal-detection/hubspot";
import { watchAndReportDeal } from "./watch-and-report";

watchAndReportDeal(detectHubspotDeal);
