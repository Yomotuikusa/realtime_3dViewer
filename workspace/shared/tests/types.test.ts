import { describe, expect, it } from "vitest";
import {
  CameraStateSchema,
  ColorSchema,
  CommentSchema,
  CommentStatusSchema,
  DEFAULT_MESH_DISPLAY,
  FocalLengthSchema,
  MeshDisplayModeSchema,
  ModelVersionSchema,
  PresenceUserSchema,
  ProjectSchema,
  StrokeSchema,
  Vec3Schema,
} from "../src/types";

const camera = {
  position: [1, 2, 3],
  target: [0, 0, 0],
};

const stroke = {
  id: "stroke-1",
  userId: "user-1",
  color: "#ff8800",
  points: [
    [0, 0, 0],
    [1, 1, 1],
  ],
  createdAt: 1_700_000_000_000,
};

const modelVersion = {
  id: "version-1",
  projectId: "project-1",
  number: 1,
  fileName: "model.glb",
  byteSize: 0,
  createdAt: 1_700_000_000_000,
};

describe("Vec3Schema", () => {
  it("accepts a numeric three-tuple", () => {
    expect(Vec3Schema.safeParse([0, 1.5, -2]).success).toBe(true);
  });

  it("rejects wrong lengths, strings, NaN, and Infinity", () => {
    for (const value of [[0, 1], [0, 1, 2, 3], ["1", 2, 3], [NaN, 0, 0], [Infinity, 0, 0]]) {
      expect(Vec3Schema.safeParse(value).success).toBe(false);
    }
  });
});

describe("ColorSchema", () => {
  it("accepts six-digit hex colors with either letter case", () => {
    expect(ColorSchema.safeParse("#ff8800").success).toBe(true);
    expect(ColorSchema.safeParse("#FF8800").success).toBe(true);
  });

  it("rejects colors outside #rrggbb", () => {
    for (const value of ["ff8800", "#fff", "#ff88000", "red"]) {
      expect(ColorSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("CameraStateSchema", () => {
  it("accepts position and target and strips extra keys", () => {
    const result = CameraStateSchema.safeParse({ ...camera, extra: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(camera);
    }
  });
});

describe("StrokeSchema", () => {
  it("accepts two points", () => {
    expect(StrokeSchema.safeParse(stroke).success).toBe(true);
  });

  it("rejects zero, one, and more than 2000 points", () => {
    expect(StrokeSchema.safeParse({ ...stroke, points: [] }).success).toBe(false);
    expect(StrokeSchema.safeParse({ ...stroke, points: [[0, 0, 0]] }).success).toBe(false);
    expect(StrokeSchema.safeParse({ ...stroke, points: Array.from({ length: 2001 }, () => [0, 0, 0]) }).success).toBe(false);
  });

  it("requires non-empty ids and a nonnegative integer timestamp", () => {
    expect(StrokeSchema.safeParse({ ...stroke, id: "" }).success).toBe(false);
    expect(StrokeSchema.safeParse({ ...stroke, userId: "" }).success).toBe(false);
    expect(StrokeSchema.safeParse({ ...stroke, createdAt: -1 }).success).toBe(false);
    expect(StrokeSchema.safeParse({ ...stroke, createdAt: 1.5 }).success).toBe(false);
  });
});

describe("CommentStatusSchema", () => {
  it("accepts open and resolved but rejects closed", () => {
    expect(CommentStatusSchema.safeParse("open").success).toBe(true);
    expect(CommentStatusSchema.safeParse("resolved").success).toBe(true);
    expect(CommentStatusSchema.safeParse("closed").success).toBe(false);
  });
});

describe("MeshDisplayModeSchema", () => {
  it("accepts the three display modes", () => {
    for (const mode of ["solid", "wireframe", "solid-wireframe"]) {
      expect(MeshDisplayModeSchema.safeParse(mode).success).toBe(true);
    }
  });

  it("rejects invalid display modes and defaults to solid", () => {
    for (const mode of ["Solid", "mesh", "", 1, undefined]) {
      expect(MeshDisplayModeSchema.safeParse(mode).success).toBe(false);
    }
    expect(DEFAULT_MESH_DISPLAY).toBe("solid");
  });
});

describe("CommentSchema", () => {
  const comment = {
    id: "comment-1",
    projectId: "project-1",
    versionId: "version-1",
    authorName: "Alice",
    body: "Please review this edge.",
    anchor: [0, 0, 0],
    camera,
    strokes: [],
    status: "open",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_001,
  };

  it("accepts a comment without stroke snapshots", () => {
    expect(CommentSchema.safeParse(comment).success).toBe(true);
  });

  it("requires status", () => {
    const { status: _status, ...withoutStatus } = comment;
    expect(CommentSchema.safeParse(withoutStatus).success).toBe(false);
  });

  it("requires non-empty comment strings", () => {
    for (const field of ["id", "projectId", "versionId", "authorName", "body"] as const) {
      expect(CommentSchema.safeParse({ ...comment, [field]: "" }).success).toBe(false);
    }
  });
});

describe("ModelVersionSchema", () => {
  it("requires a positive integer number and nonnegative integer byteSize", () => {
    expect(ModelVersionSchema.safeParse(modelVersion).success).toBe(true);
    expect(ModelVersionSchema.safeParse({ ...modelVersion, number: 0 }).success).toBe(false);
    expect(ModelVersionSchema.safeParse({ ...modelVersion, number: 1.5 }).success).toBe(false);
    expect(ModelVersionSchema.safeParse({ ...modelVersion, byteSize: -1 }).success).toBe(false);
    expect(ModelVersionSchema.safeParse({ ...modelVersion, byteSize: 1.5 }).success).toBe(false);
  });

  it("requires non-empty ids and fileName", () => {
    for (const field of ["id", "projectId", "fileName"] as const) {
      expect(ModelVersionSchema.safeParse({ ...modelVersion, [field]: "" }).success).toBe(false);
    }
  });
});

describe("ProjectSchema", () => {
  const project = {
    id: "project-1",
    name: "Demo project",
    createdAt: 1_700_000_000_000,
    latestVersion: modelVersion,
    versions: [modelVersion],
  };

  it("requires versions and latestVersion and non-empty strings", () => {
    expect(ProjectSchema.safeParse(project).success).toBe(true);
    const { latestVersion: _latestVersion, ...withoutLatestVersion } = project;
    expect(ProjectSchema.safeParse(withoutLatestVersion).success).toBe(false);
    const { versions: _versions, ...withoutVersions } = project;
    expect(ProjectSchema.safeParse(withoutVersions).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...project, versions: [] }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...project, id: "" }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...project, name: "" }).success).toBe(false);
  });

  it("requires latestVersion to be the last version", () => {
    const secondVersion = { ...modelVersion, id: "version-2", number: 2 };
    expect(ProjectSchema.safeParse({ ...project, versions: [modelVersion, secondVersion], latestVersion: secondVersion }).success).toBe(true);
    expect(ProjectSchema.safeParse({ ...project, versions: [secondVersion, modelVersion], latestVersion: secondVersion }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...project, versions: [{ ...modelVersion, byteSize: -1 }] }).success).toBe(false);
  });
});

describe("FocalLengthSchema", () => {
  it("accepts bounded finite numbers, including decimals", () => {
    for (const value of [14, 27.5, 50, 300]) {
      const result = FocalLengthSchema.safeParse(value);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(value);
    }
  });

  it("rejects values outside the range and non-numbers", () => {
    for (const value of [13.9, 300.1, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "50", null]) {
      expect(FocalLengthSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("PresenceUserSchema", () => {
  const presenceUser = {
    id: "presence-1",
    name: "Alice",
    color: "#FF8800",
    camera,
  };

  it("accepts a null camera but rejects an omitted camera", () => {
    expect(PresenceUserSchema.safeParse({ ...presenceUser, camera: null }).success).toBe(true);
    const { camera: _camera, ...withoutCamera } = presenceUser;
    expect(PresenceUserSchema.safeParse(withoutCamera).success).toBe(false);
  });

  it("requires non-empty id and name", () => {
    expect(PresenceUserSchema.safeParse({ ...presenceUser, id: "" }).success).toBe(false);
    expect(PresenceUserSchema.safeParse({ ...presenceUser, name: "" }).success).toBe(false);
  });

  it("accepts an omitted, valid, or explicitly undefined focal length", () => {
    const withoutFocalLength = PresenceUserSchema.safeParse({ ...presenceUser, camera: null });
    expect(withoutFocalLength.success).toBe(true);
    if (withoutFocalLength.success) {
      expect("focalLength" in withoutFocalLength.data).toBe(false);
    }

    const withFocalLength = PresenceUserSchema.safeParse({ ...presenceUser, focalLength: 50 });
    expect(withFocalLength.success).toBe(true);
    if (withFocalLength.success) expect(withFocalLength.data.focalLength).toBe(50);

    const withUndefined = PresenceUserSchema.safeParse({ ...presenceUser, focalLength: undefined });
    expect(withUndefined.success).toBe(true);
    if (withUndefined.success) expect(withUndefined.data.focalLength).toBeUndefined();
  });

  it("validates focal length bounds and types", () => {
    for (const value of [14, 300]) {
      expect(PresenceUserSchema.safeParse({ ...presenceUser, focalLength: value }).success).toBe(true);
    }
    for (const value of [5, 400, null, "50"]) {
      expect(PresenceUserSchema.safeParse({ ...presenceUser, focalLength: value }).success).toBe(false);
    }
  });

  it("keeps focal length out of the nested camera state", () => {
    const result = PresenceUserSchema.safeParse({
      ...presenceUser,
      camera: { ...camera, focalLength: 85 },
      focalLength: 50,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.camera).toEqual(camera);
      expect(result.data.focalLength).toBe(50);
    }
  });
});
