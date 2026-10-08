import { describe, expect, it } from "vitest";
import { DEFAULT_PRICES } from "../src/config";

describe("Final T3 credit lifecycle contracts", () => {
  it("keeps the final configurable operations in the price table", () => {
    expect(DEFAULT_PRICES).toMatchObject({
      post: expect.any(Number),
      script: expect.any(Number),
      content_plan: expect.any(Number),
      post_edit: expect.any(Number),
      post_variant: expect.any(Number),
      script_edit: expect.any(Number),
      script_variant: expect.any(Number),
      content_plan_variant: expect.any(Number),
      repurpose_telegram: expect.any(Number),
      repurpose_instagram: expect.any(Number),
      repurpose_tiktok: expect.any(Number),
      repurpose_youtube: expect.any(Number),
      repurpose_hooks: expect.any(Number),
      repurpose_cta: expect.any(Number),
      repurpose_plan: expect.any(Number),
    });
  });
});
