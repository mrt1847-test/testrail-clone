import { apiFetch } from "../../../shared/api/http";

export type TestRailV2Index = {
  supported: string[];
  deferred: string[];
  note?: string;
  exports?: {
    openapi: string;
    postman: string;
  };
};

export async function fetchTestRailV2Index(): Promise<TestRailV2Index> {
  return apiFetch<TestRailV2Index>("/api/v2");
}
