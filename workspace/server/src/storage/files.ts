import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Storage {
  /** Write to a temporary file before replacing the model file atomically. */
  saveModelFile(versionId: string, data: Uint8Array): Promise<number>;
  /** Return the on-disk path for a stored model. */
  modelFilePath(versionId: string): string;
  /** Delete a model file if it exists. */
  deleteModelFile(versionId: string): Promise<void>;
}

export function createFileStorage(dataDir: string): Storage {
  const uploadDir = join(dataDir, "uploads");
  mkdirSync(uploadDir, { recursive: true });

  const modelFilePath = (versionId: string): string => join(uploadDir, `${versionId}.glb`);

  return {
    modelFilePath,
    async saveModelFile(versionId, data) {
      const filePath = modelFilePath(versionId);
      writeFileSync(`${filePath}.tmp`, data);
      renameSync(`${filePath}.tmp`, filePath);
      return data.length;
    },
    async deleteModelFile(versionId) {
      rmSync(modelFilePath(versionId), { force: true });
    },
  };
}
