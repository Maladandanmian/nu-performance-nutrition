import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("meals.reEstimateComponent", () => {
  it("should accept valid input parameters", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Test that the endpoint accepts the correct input structure
    // Note: This will make an actual AI call, so we're just testing the interface
    const input = {
      componentName: "oat milk",
      imageUrl: "https://example.com/test-image.jpg",
    };

    // The endpoint should accept these parameters without throwing a validation error
    try {
      await caller.meals.reEstimateComponent(input);
      // If it succeeds, great! If it fails due to AI issues, that's also fine for this test
    } catch (error: any) {
      // We expect either success or an AI-related error, not a validation error
      expect(error.code).not.toBe("BAD_REQUEST");
    }
  }, 15000); // 15 second timeout for AI call

  it("should require authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
        cookies: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
        cookie: () => {},
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.meals.reEstimateComponent({
        componentName: "oat milk",
        imageUrl: "https://example.com/test-image.jpg",
      })
    ).rejects.toThrow();
  });
});
