import { api } from "./client";

export type BillingMode = "hybrid" | "subscription_only" | "api_only";

export interface BillingModeStatus {
  mode: BillingMode;
}

export const instanceBillingApi = {
  getMode: () => api.get<BillingModeStatus>("/instance/billing-mode"),
  setMode: (mode: BillingMode) => api.post<BillingModeStatus>("/instance/billing-mode", { mode }),
};
