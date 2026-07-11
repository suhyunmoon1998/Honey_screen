import { canAccessRole } from "@honey/domain";

describe("authorization guardrails", () => {
  it("blocks CLIENT access to staff capabilities", () => {
    expect(canAccessRole("CLIENT", "STAFF")).toBe(false);
  });

  it("blocks STAFF access to admin capabilities", () => {
    expect(canAccessRole("STAFF", "ADMIN")).toBe(false);
  });
});
