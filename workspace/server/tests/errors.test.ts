import { z } from "zod";
import { describe, expect, it } from "vitest";
import { HttpError, toErrorResponse } from "../src/errors";

describe("toErrorResponse", () => {
  it("preserves HttpError details", () => {
    expect(toErrorResponse(new HttpError(404, "NOT_FOUND", "x"))).toEqual({
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "x" } },
    });
  });

  it("converts ZodError to validation response", () => {
    let error: unknown;
    try {
      z.string().parse(123);
    } catch (caught) {
      error = caught;
    }

    const response = toErrorResponse(error);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION");
    expect(response.body.error.message.length).toBeGreaterThan(0);
  });

  it("does not expose unexpected error messages", () => {
    expect(toErrorResponse(new Error("secret"))).toEqual({
      status: 500,
      body: { error: { code: "INTERNAL", message: "Internal Server Error" } },
    });
  });
});
