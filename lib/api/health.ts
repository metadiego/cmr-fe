import { apiRequest } from "./client";

// Shape of @nestjs/terminus health output (wrapped in the { data } envelope by the BE).
export interface HealthStatus {
  status: "ok" | "error" | "shutting_down";
  info?: Record<string, { status: string; [key: string]: unknown }>;
  error?: Record<string, { status: string; [key: string]: unknown }>;
  details: Record<string, { status: string; [key: string]: unknown }>;
}

// Smoke-test call proving FE → BE wiring end-to-end against the only public endpoint.
export function getHealth(): Promise<HealthStatus> {
  return apiRequest<HealthStatus>("/api/health");
}
