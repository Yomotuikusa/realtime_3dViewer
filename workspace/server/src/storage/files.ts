import { mkdirSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
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
      const temporaryPath = `${filePath}.tmp`;
      await writeFile(temporaryPath, data);
      try {
        await rename(temporaryPath, filePath);
      } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
      }
      return data.length;
    },
    async deleteModelFile(versionId) {
      await rm(modelFilePath(versionId), { force: true });
    },
  };
}
