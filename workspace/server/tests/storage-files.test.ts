import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createFileStorage } from "../src/storage/files";
import { makeTmpDir, removeTmpDir } from "./helpers/tmp";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) removeTmpDir(directory);
});

describe("file storage", () => {
  it("creates uploads and saves atomically", async () => {
    const dir = makeTmpDir("storage");
    directories.push(dir);
    const storage = createFileStorage(dir);
    expect(existsSync(`${dir}/uploads`)).toBe(true);
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(storage.saveModelFile("v1", bytes)).resolves.toBe(3);
    expect(readFileSync(storage.modelFilePath("v1"))).toEqual(Buffer.from(bytes));
    expect(readdirSync(`${dir}/uploads`)).toEqual(["v1.glb"]);
    await expect(storage.saveModelFile("v1", new Uint8Array([9]))).resolves.toBe(1);
    expect(readFileSync(storage.modelFilePath("v1"))).toEqual(Buffer.from([9]));
  });

  it("is idempotent when creating an existing uploads directory", async () => {
    const dir = makeTmpDir("storage");
    directories.push(dir);
    const storage = createFileStorage(dir);
    expect(() => createFileStorage(dir)).not.toThrow();
    await expect(storage.deleteModelFile("none")).resolves.toBeUndefined();
    await storage.saveModelFile("v1", new Uint8Array([1]));
    await expect(storage.deleteModelFile("v1")).resolves.toBeUndefined();
    expect(existsSync(storage.modelFilePath("v1"))).toBe(false);
  });

  it("removes the temporary file when the final rename fails", async () => {
    const dir = makeTmpDir("storage");
    directories.push(dir);
    const storage = createFileStorage(dir);
    mkdirSync(storage.modelFilePath("v1"));

    await expect(storage.saveModelFile("v1", new Uint8Array([1]))).rejects.toThrow();
    expect(existsSync(`${storage.modelFilePath("v1")}.tmp`)).toBe(false);
  });
});
