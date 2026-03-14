import { api } from "./client";

export interface SubscriptionStatus {
  fiveHourPct: number | null;
  sevenDayPct: number | null;
  usagePercent: number;
  isAboveThreshold: boolean;
  fiveHourResetsAt: string | null;
  source: "api" | "jsonl" | "none";
}

export const subscriptionApi = {
  status: () => api.get<SubscriptionStatus>("/subscription/status"),
};
