import { describe, expect, test } from "vitest";

import { isYesNoMenu, parseMenuSelection, parseYesNo } from "../src/prompt.js";

describe("prompt utils", () => {
  test("parseYesNo", () => {
    expect(parseYesNo("y")).toBe(true);
    expect(parseYesNo("yes")).toBe(true);
    expect(parseYesNo("n")).toBe(false);
    expect(parseYesNo("no")).toBe(false);
    expect(parseYesNo("maybe")).toBe(null);
  });

  test("isYesNoMenu", () => {
    expect(isYesNoMenu(["Yes", "No"])).toBe(true);
    expect(isYesNoMenu(["yes", "no"])).toBe(true);
    expect(isYesNoMenu(["Yes", "Nope"])).toBe(false);
    expect(isYesNoMenu(["Yes", "No", "Cancel"])).toBe(false);
  });

  test("parseMenuSelection for yes/no menus uses y/n regardless of default", () => {
    const options = ["Yes", "No"];

    expect(parseMenuSelection("y", options, 1)).toMatchObject({ ok: true, index: 0, via: "yesno" });
    expect(parseMenuSelection("n", options, 0)).toMatchObject({ ok: true, index: 1, via: "yesno" });

    expect(parseMenuSelection("", options, 1)).toMatchObject({ ok: true, index: 1, via: "default" });
    expect(parseMenuSelection("2", options, 0)).toMatchObject({ ok: true, index: 1, via: "number" });
  });

  test("parseMenuSelection for non-yes/no menus treats y as default and n as invalid", () => {
    const options = ["alpha", "beta", "gamma"];

    expect(parseMenuSelection("", options, 2)).toMatchObject({ ok: true, index: 2, via: "default" });
    expect(parseMenuSelection("y", options, 0)).toMatchObject({ ok: true, index: 0, via: "default" });

    const noResult = parseMenuSelection("n", options, 0);
    expect(noResult.ok).toBe(false);
  });
});

