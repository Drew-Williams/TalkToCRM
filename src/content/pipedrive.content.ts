import { detectPipedriveDeal } from "@/lib/deal-detection/pipedrive";
import { watchAndReportDeal } from "./watch-and-report";

watchAndReportDeal(detectPipedriveDeal);
