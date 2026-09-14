import type { FbxPolygonInfo } from "./fbx-polygons";
import { polygonSizesFromVertexIndex } from "./fbx-polygons";

interface GeometryState {
  id: number;
  attrType: string;
  polygonSizes?: number[];
}

interface StackNode {
  name: string;
  geometry?: GeometryState;
  polygonValues?: string[];
}

function attributes(text: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (const character of text) {
    if (character === '"') quoted = !quoted;
    if (character === "," && !quoted) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim().length > 0) result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

function nodeStart(line: string): { name: string; attrs: string } | undefined {
  const match = line.match(/^([\w]+)\s*:\s*(.*?)\s*\{\s*$/);
  return match === null ? undefined : { name: match[1]!, attrs: match[2]! };
}

function currentGeometry(stack: StackNode[]): GeometryState | undefined {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index]!.geometry !== undefined) return stack[index]!.geometry;
  }
  return undefined;
}

function readConnection(line: string, connections: Array<[number, number]>): void {
  if (!line.startsWith("C:") || !line.slice(2).trim().startsWith('"')) return;
  const values = attributes(line.slice(2).trim());
  const from = Number.parseInt(values[1] ?? "", 10);
  const to = Number.parseInt(values[2] ?? "", 10);
  if (Number.isFinite(from) && Number.isFinite(to)) connections.push([from, to]);
}

/** FBX ASCII の Geometry と Connections だけを読み取る。 */
export function readFbxAsciiPolygons(text: string): FbxPolygonInfo {
  const version = text.match(/(?:^|\n)\s*FBXVersion\s*:\s*(\d+)/)?.[1];
  if (version !== undefined && Number.parseInt(version, 10) < 7000) {
    throw new Error(`Unsupported FBX version: ${version}`);
  }

  const geometries = new Map<number, number[]>();
  const connections: Array<[number, number]> = [];
  const stack: StackNode[] = [];
  for (const rawLine of text.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith(";")) continue;

    const top = stack[stack.length - 1];
    if (top?.name === "PolygonVertexIndex") {
      if (line === "}") {
        const geometry = top.geometry;
        if (geometry !== undefined && top.polygonValues !== undefined) {
          const values = top.polygonValues.join(" ").replace(/^a\s*:\s*/, "");
          geometry.polygonSizes = polygonSizesFromVertexIndex(
            values.split(",").map((value) => Number.parseInt(value.trim(), 10)),
          );
        }
        stack.pop();
      } else {
        top.polygonValues!.push(line.replace(/^a\s*:\s*/, ""));
      }
      continue;
    }

    if (line === "}") {
      const closed = stack.pop();
      if (closed?.geometry?.attrType === "Mesh" && closed.geometry.polygonSizes !== undefined) {
        geometries.set(closed.geometry.id, closed.geometry.polygonSizes);
      }
      continue;
    }

      const start = nodeStart(line);
    if (start !== undefined) {
      const attrs = attributes(start.attrs);
      let geometry: GeometryState | undefined;
      if (start.name === "Geometry") {
        const id = Number.parseInt(attrs[0] ?? "", 10);
        if (Number.isFinite(id)) geometry = { id, attrType: attrs[2] ?? "" };
      }
      stack.push({
        name: start.name,
        geometry: geometry ?? (start.name === "PolygonVertexIndex" ? currentGeometry(stack) : undefined),
        polygonValues: start.name === "PolygonVertexIndex" ? [] : undefined,
      });
      continue;
    }
    if (stack.some((entry) => entry.name === "Connections")) readConnection(line, connections);
  }

  const modelToGeometry = new Map<number, number>();
  for (const [geometryId, modelId] of connections) {
    if (geometries.has(geometryId)) modelToGeometry.set(modelId, geometryId);
  }
  return { geometries, modelToGeometry };
}
