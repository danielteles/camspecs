import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/revalidate/route";

const { mockRevalidatePath, mockRevalidateTag } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockRevalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
  revalidateTag: mockRevalidateTag,
}));

const SECRET = "test-revalidation-secret";

function revalidateRequest(body: string, token: string = SECRET) {
  return new NextRequest("http://localhost/api/revalidate", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body,
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.stubEnv("REVALIDATION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockRevalidatePath.mockReset();
    mockRevalidateTag.mockReset();
  });

  it("rejects a wrong token, including one of a different length", async () => {
    for (const token of ["wrong-secret-of-same-len!", "short", ""]) {
      const response = await POST(revalidateRequest("{}", token));
      expect(response.status).toBe(401);
    }
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a JSON body that isn't an object with 400, not a crash", async () => {
    for (const body of ["null", "42", '"cameras"', "[]"]) {
      const response = await POST(revalidateRequest(body));
      expect(response.status).toBe(400);
    }
  });

  it("revalidates every locale's page and the tag for each slug kind sent", async () => {
    const response = await POST(
      revalidateRequest(JSON.stringify({ cameras: ["sony-a7-iv"] })),
    );

    expect(response.status).toBe(200);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/en/cameras/sony-a7-iv");
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      "/pt-BR/cameras/sony-a7-iv",
    );
    expect(mockRevalidateTag).toHaveBeenCalledWith("cameras", { expire: 0 });
    expect(mockRevalidateTag).not.toHaveBeenCalledWith(
      "lenses",
      expect.anything(),
    );
  });
});
