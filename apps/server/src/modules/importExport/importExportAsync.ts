import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/** CSV payloads above this size should use async import endpoints in the UI. */
export const LARGE_IMPORT_BYTES = 48_000;

export type StagedCaseCsvImport = {
  projectId: bigint;
  userId: bigint;
  csv: string;
  dryRun: boolean;
  atomic: boolean;
  sectionId?: bigint;
  columnMapping?: Record<string, string>;
};

const stagingDir = path.join(os.tmpdir(), "testrail-clone-import-staging");

export function shouldUseAsyncImport(csv: string) {
  return Buffer.byteLength(csv, "utf8") >= LARGE_IMPORT_BYTES;
}

export async function writeStagedCsv(jobId: bigint, csv: string) {
  await mkdir(stagingDir, { recursive: true });
  const filePath = path.join(stagingDir, `${jobId.toString()}.csv`);
  await writeFile(filePath, csv, "utf8");
  return filePath;
}

export async function readStagedCsv(jobId: bigint) {
  const filePath = path.join(stagingDir, `${jobId.toString()}.csv`);
  return readFile(filePath, "utf8");
}

export async function deleteStagedCsv(jobId: bigint) {
  const filePath = path.join(stagingDir, `${jobId.toString()}.csv`);
  await rm(filePath, { force: true });
}

const metadata = new Map<string, Omit<StagedCaseCsvImport, "csv">>();

export function stageCaseCsvImportMeta(jobId: bigint, input: Omit<StagedCaseCsvImport, "csv">) {
  metadata.set(jobId.toString(), input);
}

export function takeCaseCsvImportMeta(jobId: bigint) {
  const key = jobId.toString();
  const value = metadata.get(key);
  metadata.delete(key);
  return value;
}

export function clearCaseCsvImportMeta(jobId: bigint) {
  metadata.delete(jobId.toString());
}
