type ObjGeometryType = "Mesh" | "Line" | "Points";

interface ObjPolygonObject {
  declared: boolean;
  type: ObjGeometryType;
  polygonSizes: number[];
}

function isObjectDeclaration(line: string): boolean {
  return /^[og]\s*(.+)?/.test(line);
}

function newObject(declared: boolean): ObjPolygonObject {
  return { declared, type: "Mesh", polygonSizes: [] };
}

/** OBJLoader の Mesh 出力に対応するオブジェクトごとの面頂点数を読む。 */
export function readObjPolygonSizes(text: string): number[][] {
  const objects: ObjPolygonObject[] = [];
  let current = newObject(false);
  objects.push(current);

  const lines = text.replaceAll("\r\n", "\n").replaceAll("\\\n", "").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trimStart();
    if (line.length === 0 || line.startsWith("#")) continue;

    switch (line.charAt(0)) {
      case "l":
        current.type = "Line";
        continue;
      case "p":
        current.type = "Points";
        continue;
      case "f": {
        if (current.type !== "Mesh") continue;
        const faceVertices = line.slice(1).trim().split(/\s+/).filter((token) => token.length > 0);
        if (faceVertices.length >= 3) current.polygonSizes.push(faceVertices.length);
        continue;
      }
      case "v":
        continue;
      default:
        break;
    }

    if (isObjectDeclaration(line)) {
      if (!current.declared) {
        current.declared = true;
      } else {
        current = newObject(true);
        objects.push(current);
      }
    }
  }

  return objects
    .filter((object) => object.type === "Mesh" && object.polygonSizes.length > 0)
    .map((object) => object.polygonSizes);
}
