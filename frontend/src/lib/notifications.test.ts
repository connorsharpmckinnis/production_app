import { describe, expect, it } from "vitest";
import { productionIdFromPath, routeKeyFromPath } from "./notifications";

describe("notification route helpers", () => {
  it("maps production overview and catalog routes", () => {
    expect(routeKeyFromPath("/productions/12")).toBe("overview");
    expect(routeKeyFromPath("/productions/12/people")).toBe("people");
    expect(routeKeyFromPath("/productions/12/cue-categories")).toBe("cue-categories");
  });

  it("keeps Rehearse as a route-filter key after canonical redirect", () => {
    expect(routeKeyFromPath("/productions/12/rehearse")).toBe("rehearse");
    expect(routeKeyFromPath("/productions/12/timeline", "?rehearse=1")).toBe("rehearse");
    expect(routeKeyFromPath("/productions/12/timeline")).toBe("timeline");
  });

  it("groups rehearsal details and call sheets under rehearsals", () => {
    expect(routeKeyFromPath("/productions/12/rehearsals")).toBe("rehearsals");
    expect(routeKeyFromPath("/productions/12/rehearsals/4")).toBe("rehearsals");
    expect(routeKeyFromPath("/productions/12/rehearsals/4/call-sheet")).toBe("rehearsals");
  });

  it("does not treat non-production pages as production route filters", () => {
    expect(routeKeyFromPath("/users")).toBeNull();
    expect(routeKeyFromPath("/about")).toBeNull();
    expect(productionIdFromPath("/productions/12/rehearsals/4")).toBe(12);
  });
});
