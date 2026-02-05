export const YES_VALUES = new Set(["y", "yes"]);
export const NO_VALUES = new Set(["n", "no"]);

export function parseYesNo(input: string): boolean | null {
  const normalized = input.trim().toLowerCase();
  if (YES_VALUES.has(normalized)) return true;
  if (NO_VALUES.has(normalized)) return false;
  return null;
}

function detectYesNoMenu(options: string[]): { yesIndex: number; noIndex: number } | null {
  if (options.length !== 2) return null;
  const lowered = options.map((option) => option.trim().toLowerCase());
  const yesIndex = lowered.indexOf("yes");
  const noIndex = lowered.indexOf("no");
  if (yesIndex === -1 || noIndex === -1) return null;
  return { yesIndex, noIndex };
}

export function isYesNoMenu(options: string[]): boolean {
  return detectYesNoMenu(options) !== null;
}

export type MenuParseResult =
  | { ok: true; index: number; via: "default" | "number" | "yesno" }
  | { ok: false; message: string };

export function parseMenuSelection(
  inputRaw: string,
  options: string[],
  fallbackIndex: number,
): MenuParseResult {
  const trimmed = inputRaw.trim();

  if (trimmed === "") {
    return { ok: true, index: fallbackIndex, via: "default" };
  }

  const yesNo = parseYesNo(trimmed);
  const yesNoMenu = detectYesNoMenu(options);

  if (yesNoMenu) {
    if (yesNo === true) {
      return { ok: true, index: yesNoMenu.yesIndex, via: "yesno" };
    }
    if (yesNo === false) {
      return { ok: true, index: yesNoMenu.noIndex, via: "yesno" };
    }
  } else {
    // For non-yes/no menus, treat yes as "accept default", and disallow no.
    if (yesNo === true) {
      return { ok: true, index: fallbackIndex, via: "default" };
    }
    if (yesNo === false) {
      return {
        ok: false,
        message: `Please enter a number between 1 and ${options.length}.`,
      };
    }
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= options.length) {
    return { ok: true, index: parsed - 1, via: "number" };
  }

  return {
    ok: false,
    message: `Please enter a number between 1 and ${options.length}.`,
  };
}

