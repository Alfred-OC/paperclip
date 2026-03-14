import { api } from "./client";

export interface StartupStatus {
  enabled: boolean;
  isDarwin: boolean;
  plistPath: string;
}

export const instanceStartupApi = {
  status: () => api.get<StartupStatus>("/instance/startup"),
  set: (enabled: boolean) => api.post<StartupStatus>("/instance/startup", { enabled }),
};
