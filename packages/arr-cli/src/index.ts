#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { watch } from "node:fs";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  ArrError,
  detectFileFormat,
  embedAttestationInMetadata,
  extractAttestationFromMetadata,
  generateKeyPair,
  parseSignedAttestationJson,
  readSidecar,
  signAttestation,
  verifyAttestation,
  writeSidecar,
  type Attestation,
  type SignedAttestation,
} from "@allrightsrespected/sdk";

type Command = "keygen" | "attest" | "verify" | "extract" | "watch" | "init";

type ParsedArgs = {
  command: Command | undefined;
  positionals: string[];
  options: Record<string, string | boolean>;
  wantsJson: boolean;
};

type IntentPolicy = "none" | "fixed" | "filename";

type ArrConfig = {
  creator?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
  defaultInbox?: string;
  outputDir?: string;
  tool?: string;
  intentPolicy?: IntentPolicy;
  intent?: string;
  defaultMode?: "auto" | "sidecar" | "metadata";
};

type ExtractionResult = {
  signed: SignedAttestation;
  source: "metadata" | "sidecar";
  filePath: string;
  format?: "png" | "jpeg";
};

type DirectoryFilter = {
  mode: "all" | "types" | "images";
  exts?: Set<string>;
};

class CliError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}

const DEFAULT_IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg"]);
const YES_VALUES = new Set(["y", "yes"]);
const NO_VALUES = new Set(["n", "no"]);

function parseArgs(argv: string[]): ParsedArgs {
  let command: Command | undefined;
  let tokens = argv;

  const firstToken = argv[0];

  if (
    firstToken === "keygen" ||
    firstToken === "attest" ||
    firstToken === "verify" ||
    firstToken === "extract" ||
    firstToken === "watch" ||
    firstToken === "init"
  ) {
    command = firstToken;
    tokens = argv.slice(1);
  }

  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }

    if (token === "-h") {
      options.help = true;
      continue;
    }

    if (token === "-v") {
      options.version = true;
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = tokens[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return {
    command,
    positionals,
    options,
    wantsJson: options.json === true,
  };
}

function getHelp(command?: Command): string {
  if (!command) {
    return [
      "ARR CLI (M1)",
      "",
      "Usage:",
      "  arr <command> [options]",
      "",
      "Commands:",
      "  init     Interactive setup for creators",
      "  keygen   Generate an Ed25519 keypair",
      "  attest   Sign and attach an ARR attestation",
      "  verify   Verify ARR metadata or sidecar",
      "  extract  Print ARR payload from metadata or sidecar",
      "  watch    Auto-attest files dropped into a folder",
      "",
      "Global options:",
      "  --json     Emit stable JSON envelopes",
      "  --help     Show command help",
      "  --version  Show CLI version",
      "",
      "Run `arr <command> --help` for detailed usage.",
      "",
    ].join("\n");
  }

  if (command === "keygen") {
    return [
      "Usage:",
      "  arr keygen --out-dir <dir> [--json]",
      "",
      "Options:",
      "  --out-dir <dir>   Directory for generated key files",
      "  --json            Emit JSON output",
      "",
    ].join("\n");
  }

  if (command === "attest") {
    return [
      "Usage:",
      "  arr attest <file|dir> [--creator <id>] [--private-key <pemPath>] [options]",
      "",
      "Options:",
      "  --intent <text>           Creative intent",
      "  --tool <name/version>     Tool marker",
      "  --expires <YYYY-MM-DD>    Expiry date",
      "  --mode <auto|sidecar|metadata>",
      "  --out <path>              Output path (file or directory)",
      "  --recursive               Attest all files in a directory",
      "  --all                     Include all file types when attesting a directory",
      "  --types <exts>            Comma-separated extensions (e.g. png,jpg)",
      "  --json                    Emit JSON output",
      "",
      "Tip:",
      "  Run `arr init` once to set defaults for creator and keys.",
      "",
    ].join("\n");
  }

  if (command === "init") {
    return [
      "Usage:",
      "  arr init [--global|--local]",
      "",
      "Options:",
      "  --global                  Store config in ~/.arr/config.json (default)",
      "  --local                   Store config in ./.arr/config.json",
      "",
    ].join("\n");
  }

  if (command === "verify") {
    return [
      "Usage:",
      "  arr verify <file> [--public-key <pemPath>] [--json]",
      "",
      "Options:",
      "  --public-key <pemPath>    Explicit PEM public key",
      "  --json                    Emit JSON output",
      "",
    ].join("\n");
  }

  if (command === "watch") {
    return [
      "Usage:",
      "  arr watch [--in <dir>] [--creator <id>] [--private-key <pemPath>] [options]",
      "",
      "Options:",
      "  --out-dir <dir>          Output directory (defaults to input dir)",
      "  --intent <text>           Creative intent",
      "  --tool <name/version>     Tool marker",
      "  --expires <YYYY-MM-DD>    Expiry date",
      "  --mode <auto|sidecar|metadata>",
      "  --all                     Include all file types (default is images only)",
      "  --types <exts>            Comma-separated extensions (e.g. png,jpg)",
      "  --json                    Emit JSON output",
      "",
      "Tip:",
      "  Drag files into the watched folder to auto-attest them.",
      "  Defaults come from `arr init`.",
      "",
    ].join("\n");
  }

  return [
    "Usage:",
    "  arr extract <file> [--json]",
    "",
    "Options:",
    "  --json                    Emit JSON output",
    "",
  ].join("\n");
}

const CONFIG_DIRNAME = ".arr";
const CONFIG_FILENAME = "config.json";
const LEGACY_CONFIG_FILENAME = ".arrrc.json";

function getConfigPaths(): {
  local: string;
  global: string;
  legacyLocal: string;
  legacyGlobal: string;
} {
  return {
    local: path.join(process.cwd(), CONFIG_DIRNAME, CONFIG_FILENAME),
    global: path.join(os.homedir(), CONFIG_DIRNAME, CONFIG_FILENAME),
    legacyLocal: path.join(process.cwd(), LEGACY_CONFIG_FILENAME),
    legacyGlobal: path.join(os.homedir(), LEGACY_CONFIG_FILENAME),
  };
}

function normalizeConfig(config: unknown, filePath: string): ArrConfig {
  if (!config || typeof config !== "object") {
    throw new CliError("invalid_config", `Invalid ARR config at ${filePath}.`);
  }
  return config as ArrConfig;
}

async function readConfigFile(filePath: string): Promise<ArrConfig | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeConfig(parsed, filePath);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new CliError("invalid_config", `Invalid JSON in ARR config: ${filePath}`);
    }
    throw error;
  }
}

async function loadConfig(): Promise<{
  config: ArrConfig;
  path?: string;
  source: "local" | "global" | "legacy-local" | "legacy-global" | "none";
}> {
  const paths = getConfigPaths();

  const localConfig = await readConfigFile(paths.local);
  if (localConfig) {
    return { config: localConfig, path: paths.local, source: "local" };
  }

  const globalConfig = await readConfigFile(paths.global);
  if (globalConfig) {
    return { config: globalConfig, path: paths.global, source: "global" };
  }

  const legacyLocal = await readConfigFile(paths.legacyLocal);
  if (legacyLocal) {
    return { config: legacyLocal, path: paths.legacyLocal, source: "legacy-local" };
  }

  const legacyGlobal = await readConfigFile(paths.legacyGlobal);
  if (legacyGlobal) {
    return { config: legacyGlobal, path: paths.legacyGlobal, source: "legacy-global" };
  }

  return { config: {}, source: "none" };
}

async function writeConfigFile(filePath: string, config: ArrConfig): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function getStringOption(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.options[key];
  return typeof value === "string" ? value : undefined;
}

type AskOptions = {
  fallback?: string;
  required?: boolean;
  allowSkip?: boolean;
  normalize?: (value: string) => string;
  validate?: (value: string) => string | undefined;
  hint?: string;
};

type Prompter = {
  ask: (prompt: string, options?: AskOptions) => Promise<string>;
  choose: (prompt: string, options: string[], fallbackIndex: number) => Promise<string>;
  close: () => void;
};

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function parseYesNo(input: string): boolean | null {
  const normalized = input.trim().toLowerCase();
  if (YES_VALUES.has(normalized)) return true;
  if (NO_VALUES.has(normalized)) return false;
  return null;
}

function createPrompter(): Prompter {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = async (prompt: string, options: AskOptions = {}): Promise<string> => {
    const fallback = options.fallback;
    const suffix = fallback ? ` (${fallback})` : "";
    const hint = options.hint ? ` ${options.hint}` : "";

    while (true) {
      const answer = await rl.question(`${prompt}${suffix}:${hint} `);
      const trimmed = answer.trim();
      if (!trimmed) {
        if (fallback) return fallback;
        if (options.required) {
          process.stdout.write("This value is required. Please enter a value.\n");
          continue;
        }
        return "";
      }

      const yesNo = parseYesNo(trimmed);
      if (yesNo === true) {
        if (fallback) return fallback;
        if (options.required) {
          process.stdout.write("This value is required. Please enter a value.\n");
          continue;
        }
        return "";
      }
      if (yesNo === false) {
        if (options.allowSkip) {
          return "";
        }
        if (options.required) {
          process.stdout.write("This value is required. Please enter a value.\n");
          continue;
        }
        return "";
      }

      const normalized = options.normalize ? options.normalize(trimmed) : trimmed;
      if (options.validate) {
        const error = options.validate(normalized);
        if (error) {
          process.stdout.write(`${error}\n`);
          continue;
        }
      }
      return normalized;
    }
  };

  const choose = async (prompt: string, options: string[], fallbackIndex: number): Promise<string> => {
    const lines = options.map((option, index) => `  ${index + 1}) ${option}`);
    const answer = await ask(`${prompt}\n${lines.join("\n")}`, {
      fallback: String(fallbackIndex + 1),
      hint: "Enter a number.",
    });
    const normalized = answer.trim().toLowerCase();
    const yesNo = parseYesNo(normalized);
    if (yesNo !== null && options.some((option) => option.toLowerCase() === "yes") && options.some((option) => option.toLowerCase() === "no")) {
      if (yesNo === true) {
        return options.find((option) => option.toLowerCase() === "yes") ?? options[fallbackIndex]!;
      }
      return options.find((option) => option.toLowerCase() === "no") ?? options[fallbackIndex]!;
    }

    const parsed = Number.parseInt(answer, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= options.length) {
      return options[parsed - 1] ?? options[fallbackIndex]!;
    }
    return options[fallbackIndex]!;
  };

  const close = (): void => {
    rl.close();
  };

  return { ask, choose, close };
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizePathInput(value: string): string {
  const stripped = stripWrappingQuotes(value);
  if (stripped.startsWith("~")) {
    return path.join(os.homedir(), stripped.slice(1));
  }
  return stripped;
}

function parseTypesOption(raw?: string): Set<string> | null {
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => (part.startsWith(".") ? part : `.${part}`));
  if (parts.length === 0) {
    return null;
  }
  return new Set(parts);
}

function resolveDirectoryFilter(parsed: ParsedArgs): DirectoryFilter {
  if (parsed.options.all === true) {
    return { mode: "all" };
  }
  const types = parseTypesOption(getStringOption(parsed, "types"));
  if (types && types.size > 0) {
    return { mode: "types", exts: types };
  }
  return { mode: "images", exts: DEFAULT_IMAGE_EXTS };
}

function hasSupportedExtension(filePath: string, exts: Set<string>): boolean {
  return exts.has(path.extname(filePath).toLowerCase());
}

function printBanner(): void {
  const lines = [
    "   _    ____  ____",
    "  / \\  |  _ \\|  _ \\",
    " / _ \\ | |_) | |_) |",
    "/ ___ \\|  _ <|  _ <",
    "/_/   \\_\\_| \\_\\_| \\_\\",
    "",
  ];
  process.stdout.write(lines.join("\n"));
}

async function printVersion(): Promise<void> {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const pkgPath = path.join(path.dirname(currentFile), "..", "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    const version = parsed.version ?? "unknown";
    process.stdout.write(`arr v${version}\n`);
  } catch {
    process.stdout.write("arr (version unknown)\n");
  }
}

function getRequiredStringOption(parsed: ParsedArgs, key: string): string {
  const value = getStringOption(parsed, key);

  if (!value) {
    throw new CliError("missing_flag", `Missing required option --${key}.`);
  }

  return value;
}

async function suggestFileMatch(filePath: string): Promise<string | null> {
  const parsed = path.parse(filePath);
  if (!parsed.dir || parsed.ext) {
    return null;
  }
  try {
    const entries = await readdir(parsed.dir);
    const prefix = `${parsed.name}.`;
    const matches = entries.filter((entry) => entry.startsWith(prefix));
    if (matches.length === 0) {
      return null;
    }
    const suggestions = matches.slice(0, 3).map((entry) => path.join(parsed.dir, entry));
    if (matches.length > 3) {
      return `${suggestions.join(", ")} …`;
    }
    return suggestions.join(", ");
  } catch {
    return null;
  }
}

async function ensureFileExists(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    const suggestion = await suggestFileMatch(filePath);
    const suffix = suggestion ? `\nDid you mean: ${suggestion}` : "";
    throw new CliError("file_not_found", `File not found: ${filePath}${suffix}`);
  }
}

async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    const stats = await stat(dirPath);
    if (!stats.isDirectory()) {
      throw new CliError("not_a_directory", `Not a directory: ${dirPath}`);
    }
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new CliError("dir_not_found", `Directory not found: ${dirPath}`);
    }
    throw error;
  }
}

function defaultMetadataOutputPath(inputPath: string): string {
  const parsed = path.parse(inputPath);

  if (!parsed.ext) {
    return path.join(parsed.dir, `${parsed.name}.attested`);
  }

  return path.join(parsed.dir, `${parsed.name}.attested${parsed.ext}`);
}

function metadataOutputPathAt(inputPath: string, outputDir: string): string {
  const parsed = path.parse(inputPath);

  if (!parsed.ext) {
    return path.join(outputDir, `${parsed.name}.attested`);
  }

  return path.join(outputDir, `${parsed.name}.attested${parsed.ext}`);
}

function sidecarOutputPathAt(inputPath: string, outputDir: string): string {
  const parsed = path.parse(inputPath);
  return path.join(outputDir, `${parsed.base}.arr`);
}

function isSkippableFilename(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (lower.startsWith(".")) return true;
  if (lower.endsWith("~")) return true;
  if (lower === "thumbs.db" || lower === ".ds_store") return true;
  if (lower.endsWith(".arr")) return true;
  if (lower.includes(".attested")) return true;
  return false;
}

function resolveCreator(parsed: ParsedArgs, config: ArrConfig): string {
  const creator = getStringOption(parsed, "creator") ?? config.creator;
  if (!creator) {
    throw new CliError("missing_flag", "Missing required option --creator. Run `arr init` to set a default.");
  }
  const normalized = creator.trim();
  const lowered = normalized.toLowerCase();
  if (YES_VALUES.has(lowered) || NO_VALUES.has(lowered)) {
    throw new CliError(
      "invalid_creator",
      "Creator ID must be a URL or pubkey (e.g. https://example.com or pubkey:ed25519:...).",
    );
  }
  return normalized;
}

function resolvePrivateKeyPath(parsed: ParsedArgs, config: ArrConfig): string {
  const privateKeyPath = getStringOption(parsed, "private-key") ?? config.privateKeyPath;
  if (!privateKeyPath) {
    throw new CliError("missing_flag", "Missing required option --private-key. Run `arr init` to set a default.");
  }
  return normalizePathInput(privateKeyPath);
}

function resolveTool(parsed: ParsedArgs, config: ArrConfig): string | undefined {
  return getStringOption(parsed, "tool") ?? config.tool;
}

function resolveMode(parsed: ParsedArgs, config: ArrConfig): "auto" | "sidecar" | "metadata" {
  const modeOption = getStringOption(parsed, "mode") ?? config.defaultMode ?? "auto";
  if (modeOption !== "auto" && modeOption !== "sidecar" && modeOption !== "metadata") {
    throw new CliError("invalid_mode", "Mode must be one of: auto, sidecar, metadata.");
  }
  return modeOption;
}

function resolveIntentForFile(filePath: string, parsed: ParsedArgs, config: ArrConfig): string | undefined {
  const explicit = getStringOption(parsed, "intent");
  if (explicit) {
    return explicit;
  }

  const policy = config.intentPolicy ?? "none";
  if (policy === "fixed") {
    return config.intent;
  }
  if (policy === "filename") {
    return path.parse(filePath).name;
  }
  return undefined;
}

function toJson(command: Command, data: Record<string, unknown>): string {
  return `${JSON.stringify({ ok: true, command, data }, null, 2)}\n`;
}

function toJsonError(command: Command | undefined, error: { code: string; message: string }): string {
  return `${JSON.stringify({ ok: false, command: command ?? null, error }, null, 2)}\n`;
}

async function loadSignedAttestation(filePath: string): Promise<ExtractionResult> {
  if (filePath.endsWith(".arr")) {
    const raw = await readFile(filePath, "utf8");

    return {
      signed: parseSignedAttestationJson(raw),
      source: "sidecar",
      filePath,
    };
  }

  const originalBytes = await readFile(filePath);
  const metadata = extractAttestationFromMetadata(originalBytes);

  if (metadata) {
    return {
      signed: metadata.signed,
      source: "metadata",
      filePath,
      format: metadata.format,
    };
  }

  try {
    const sidecar = await readSidecar(filePath);

    return {
      signed: sidecar.signed,
      source: "sidecar",
      filePath: sidecar.path,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new CliError(
        "attestation_not_found",
        "No ARR attestation found in metadata and no sidecar file was found.",
      );
    }

    throw error;
  }
}

async function handleInit(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("init"));
    return;
  }

  if (!isInteractive()) {
    throw new CliError("interactive_only", "`arr init` requires an interactive terminal.");
  }

  const paths = getConfigPaths();
  const configPath = parsed.options.local === true ? paths.local : paths.global;
  let existing = await readConfigFile(configPath);
  if (!existing) {
    const fallback = await loadConfig();
    existing = fallback.config;
  }
  const prompter = createPrompter();

  try {
    const keyChoice = await prompter.choose(
      "Private key",
      ["Generate new keypair", "Use existing private key"],
      0,
    );

    let privateKeyPath = existing.privateKeyPath;
    let publicKeyPath = existing.publicKeyPath;
    let creatorFromKey: string | undefined;

    if (keyChoice.startsWith("Generate")) {
      const defaultKeysDir = path.join(os.homedir(), ".arr", "keys");
      const keysDir = await prompter.ask("Key directory (path)", {
        fallback: defaultKeysDir,
        required: true,
        normalize: normalizePathInput,
        hint: "Enter or y = default",
      });
      await mkdir(keysDir, { recursive: true });

      const { privateKeyPem, publicKeyPem, creator } = generateKeyPair();
      creatorFromKey = creator;
      privateKeyPath = path.join(keysDir, "arr-ed25519-private.pem");
      publicKeyPath = path.join(keysDir, "arr-ed25519-public.pem");

      await writeFile(privateKeyPath, privateKeyPem, { encoding: "utf8", mode: 0o600 });
      await writeFile(publicKeyPath, publicKeyPem, "utf8");
    } else {
      while (true) {
        const candidate = await prompter.ask("Private key path (file)", {
          fallback: existing.privateKeyPath,
          required: true,
          normalize: normalizePathInput,
          hint: "Enter or y = default",
        });
        try {
          await ensureFileExists(candidate);
          privateKeyPath = candidate;
          break;
        } catch (error) {
          const normalized = normalizeError(error);
          process.stdout.write(`Error [${normalized.code}]: ${normalized.message}\n`);
        }
      }
    }

    if (!privateKeyPath) {
      throw new CliError("missing_flag", "Private key path is required.");
    }

    const creator = await prompter.ask("Creator ID (URL or pubkey)", {
      fallback: existing.creator ?? creatorFromKey,
      required: true,
      hint: "Enter or y = default",
      validate: (value) => {
        const lowered = value.trim().toLowerCase();
        if (YES_VALUES.has(lowered) || NO_VALUES.has(lowered)) {
          return "Please enter a URL or pubkey (not yes/no).";
        }
        return undefined;
      },
    });

    const tool = await prompter.ask("Default tool (optional)", {
      fallback: existing.tool ?? "",
      allowSkip: true,
      hint: "Enter or n = skip",
    });
    const intentChoice = await prompter.choose(
      "Default intent behavior",
      ["none (omit intent)", "fixed (one label for all files)", "filename (use file name)"],
      0,
    );
    let intentPolicy: IntentPolicy = "none";
    let intent: string | undefined = undefined;

    if (intentChoice.startsWith("fixed")) {
      intentPolicy = "fixed";
      const fixedIntent = await prompter.ask("Fixed intent label", {
        fallback: existing.intent ?? "",
        allowSkip: true,
        hint: "Enter or n = skip",
      });
      if (fixedIntent) {
        intent = fixedIntent;
      }
    } else if (intentChoice.startsWith("filename")) {
      intentPolicy = "filename";
    }

    const defaultInbox = await prompter.ask("Default watch folder (path)", {
      fallback: existing.defaultInbox ?? path.join(os.homedir(), "ARR-Inbox"),
      normalize: normalizePathInput,
      allowSkip: true,
      hint: "Enter or y = default",
    });

    const modeChoice = await prompter.choose("Default embed mode", ["auto", "metadata", "sidecar"], 0);

    const config: ArrConfig = {
      creator,
      privateKeyPath,
      intentPolicy,
    };
    config.defaultMode = modeChoice as "auto" | "metadata" | "sidecar";
    if (publicKeyPath) {
      config.publicKeyPath = publicKeyPath;
    }
    if (defaultInbox) {
      config.defaultInbox = defaultInbox;
    }
    if (tool) {
      config.tool = tool;
    }
    if (intent) {
      config.intent = intent;
    }

    await writeConfigFile(configPath, config);

    if (parsed.wantsJson) {
      process.stdout.write(
        toJson("init", {
          configPath,
          creator,
          privateKeyPath,
          publicKeyPath: publicKeyPath ?? null,
        }),
      );
      return;
    }

    process.stdout.write(
      [
        "ARR setup saved.",
        `Config: ${configPath}`,
        `Creator: ${creator}`,
        `Private key: ${privateKeyPath}`,
        publicKeyPath ? `Public key: ${publicKeyPath}` : "",
        "Next: run `arr attest <file>` or `arr watch`.",
        "",
      ].filter(Boolean).join("\n"),
    );
  } finally {
    prompter.close();
  }
}

async function handleInteractive(showBanner = true): Promise<void> {
  if (!isInteractive()) {
    process.stdout.write(getHelp());
    return;
  }

  if (showBanner) {
    printBanner();
  }

  const configState = await loadConfig();
  if (configState.source === "none") {
    await handleInit({ command: "init", positionals: [], options: {}, wantsJson: false });
    return handleInteractive(false);
  }
  if (configState.source === "legacy-local" || configState.source === "legacy-global") {
    const legacyPath = configState.path ?? "legacy config";
    process.stdout.write(
      `Found legacy ARR config at ${legacyPath}. Run 'arr init' to upgrade to ~/.arr/config.json.\n`,
    );
  }

  const prompter = createPrompter();
  try {
    const action = await prompter.choose(
      "What do you want to do?",
      [
        "Set up creator (arr init)",
        "Watch a folder (drag & drop)",
        "Attest a file or folder",
        "Verify a file",
        "Extract an attestation",
        "Exit",
      ],
      0,
    );

    if (action === "Exit") {
      return;
    }

    const { config } = await loadConfig();

    if (action === "Set up creator (arr init)") {
      await handleInit({ command: "init", positionals: [], options: {}, wantsJson: false });
      return;
    }

    if (action === "Watch a folder (drag & drop)") {
      const defaultInbox = config.defaultInbox ?? path.join(os.homedir(), "ARR-Inbox");
      const dir = await prompter.ask("Watch folder (path)", {
        fallback: defaultInbox,
        normalize: normalizePathInput,
        hint: "Enter or y = default",
      });
      await handleWatch({
        command: "watch",
        positionals: [],
        options: dir ? { in: dir } : {},
        wantsJson: false,
      });
      return;
    }

    if (action === "Attest a file or folder") {
      const inputPath = await prompter.ask("File or folder path", {
        required: true,
        normalize: normalizePathInput,
        hint: "Drag & drop supported",
      });
      if (!inputPath) {
        return;
      }
      let options: Record<string, string | boolean> = {};
      try {
        const stats = await stat(inputPath);
        if (stats.isDirectory()) {
          const summary = await summarizeDirectory(inputPath);
          if (summary.total === 0) {
            process.stdout.write("No attestable files were found in that folder.\n");
            return;
          }

          if (summary.imageCount === 0 && summary.otherCount > 0) {
            const choice = await prompter.choose(
              `Directory detected with ${summary.otherCount} non-image files. Attest all files with sidecars?`,
              ["Yes", "No"],
              1,
            );
            if (choice !== "Yes") {
              return;
            }
            options = { recursive: true, all: true };
          } else if (summary.otherCount > 0) {
            const choice = await prompter.choose(
              `Directory detected. ${summary.imageCount} images, ${summary.otherCount} other files.`,
              [
                `Images only (PNG/JPEG) — ${summary.imageCount} files (recommended)`,
                `Everything — ${summary.total} files (sidecars for non-images)`,
                "Cancel",
              ],
              0,
            );
            if (choice.startsWith("Images only")) {
              options = { recursive: true, types: "png,jpg,jpeg" };
            } else if (choice.startsWith("Everything")) {
              options = { recursive: true, all: true };
            } else {
              return;
            }
          } else {
            const choice = await prompter.choose(
              `Directory detected with ${summary.imageCount} image(s). Attest all images?`,
              ["Yes", "No"],
              0,
            );
            if (choice !== "Yes") {
              return;
            }
            options = { recursive: true, types: "png,jpg,jpeg" };
          }
        }
      } catch {
        // Let handler surface errors
      }

      await handleAttest({
        command: "attest",
        positionals: [inputPath],
        options,
        wantsJson: false,
      });
      return;
    }

    if (action === "Verify a file") {
      const inputPath = await prompter.ask("File path", {
        required: true,
        normalize: normalizePathInput,
        hint: "Drag & drop supported",
      });
      if (!inputPath) {
        return;
      }
      await handleVerify({
        command: "verify",
        positionals: [inputPath],
        options: {},
        wantsJson: false,
      });
      return;
    }

    if (action === "Extract an attestation") {
      const inputPath = await prompter.ask("File path", {
        required: true,
        normalize: normalizePathInput,
        hint: "Drag & drop supported",
      });
      if (!inputPath) {
        return;
      }
      await handleExtract({
        command: "extract",
        positionals: [inputPath],
        options: {},
        wantsJson: false,
      });
    }
  } finally {
    prompter.close();
  }
}

async function handleKeygen(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("keygen"));
    return;
  }

  const outDir = normalizePathInput(getRequiredStringOption(parsed, "out-dir"));
  await mkdir(outDir, { recursive: true });

  const { privateKeyPem, publicKeyPem, creator } = generateKeyPair();
  const privateKeyPath = path.join(outDir, "arr-ed25519-private.pem");
  const publicKeyPath = path.join(outDir, "arr-ed25519-public.pem");

  await writeFile(privateKeyPath, privateKeyPem, { encoding: "utf8", mode: 0o600 });
  await writeFile(publicKeyPath, publicKeyPem, "utf8");

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("keygen", {
        privateKeyPath,
        publicKeyPath,
        creator,
      }),
    );

    return;
  }

  process.stdout.write(
    [
      "Generated Ed25519 keypair.",
      `Private key: ${privateKeyPath}`,
      `Public key: ${publicKeyPath}`,
      `Creator ID: ${creator}`,
      "",
    ].join("\n"),
  );
}

type AttestationOverrides = {
  creator: string;
  intent?: string;
  tool?: string;
};

function buildAttestation(parsed: ParsedArgs, overrides: AttestationOverrides): Attestation {
  const creator = overrides.creator;
  const expires = getStringOption(parsed, "expires");

  if (expires) {
    const parsedDate = new Date(expires);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new CliError("invalid_expires", "The --expires value must be a valid date.");
    }
  }

  const attestation: Attestation = {
    version: "arr/0.1",
    id: randomUUID(),
    created: new Date().toISOString(),
    creator,
    revocable: true,
  };

  const intent = overrides.intent;

  if (intent) {
    attestation.intent = intent;
  }

  const tool = overrides.tool;

  if (tool) {
    attestation.tool = tool;
  }

  if (expires) {
    attestation.expires = expires;
  }

  return attestation;
}

type AttestPaths = {
  metadata?: string;
  sidecar?: string;
};

type AttestOutcome = {
  mode: "metadata" | "sidecar";
  outputPath: string;
  format?: "png" | "jpeg";
};

async function attestSigned(
  inputPath: string,
  signed: SignedAttestation,
  modeOption: "auto" | "sidecar" | "metadata",
  paths: AttestPaths = {},
): Promise<AttestOutcome> {
  if (modeOption === "sidecar") {
    const writtenPath = await writeSidecar(inputPath, signed, paths.sidecar);
    return { mode: "sidecar", outputPath: writtenPath };
  }

  const bytes = await readFile(inputPath);
  const detectedFormat = detectFileFormat(bytes);

  if (modeOption === "metadata" && detectedFormat === "unknown") {
    throw new CliError(
      "unsupported_format",
      "Metadata mode currently supports only PNG and JPEG files. Use --mode sidecar instead.",
    );
  }

  if (detectedFormat === "unknown") {
    const writtenPath = await writeSidecar(inputPath, signed, paths.sidecar);
    return { mode: "sidecar", outputPath: writtenPath };
  }

  const embedded = embedAttestationInMetadata(bytes, signed, detectedFormat);
  const targetPath = paths.metadata ?? defaultMetadataOutputPath(inputPath);
  await writeFile(targetPath, embedded);

  return {
    mode: "metadata",
    outputPath: targetPath,
    format: detectedFormat,
  };
}

async function walkDirectory(dirPath: string, files: string[]): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (isSkippableFilename(entry.name)) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

async function summarizeDirectory(dirPath: string): Promise<{
  total: number;
  imageCount: number;
  otherCount: number;
}> {
  const files: string[] = [];
  await walkDirectory(dirPath, files);
  let imageCount = 0;
  for (const file of files) {
    if (hasSupportedExtension(file, DEFAULT_IMAGE_EXTS)) {
      imageCount += 1;
    }
  }
  const total = files.length;
  return { total, imageCount, otherCount: total - imageCount };
}

async function collectInputPaths(
  inputPath: string,
  recursive: boolean,
  filter: DirectoryFilter,
): Promise<string[]> {
  let stats;
  try {
    stats = await stat(inputPath);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      const suggestion = await suggestFileMatch(inputPath);
      const suffix = suggestion ? `\nDid you mean: ${suggestion}` : "";
      throw new CliError("file_not_found", `File not found: ${inputPath}${suffix}`);
    }
    throw error;
  }
  if (stats.isDirectory()) {
    if (!recursive) {
      throw new CliError(
        "directory_requires_recursive",
        "Input is a directory. Use --recursive to attest all files or use `arr watch`.",
      );
    }
    const files: string[] = [];
    await walkDirectory(inputPath, files);
    if (filter.mode === "all") {
      return files;
    }
    const exts = filter.exts ?? DEFAULT_IMAGE_EXTS;
    const filtered = files.filter((filePath) => hasSupportedExtension(filePath, exts));
    if (filtered.length === 0) {
      const label =
        filter.mode === "types"
          ? `No files matched --types (${[...exts].join(", ")}) in this directory.`
          : "No PNG/JPEG files found in this directory.";
      throw new CliError(
        "no_matching_files",
        `${label} Use --all to include every file, or --types to specify extensions.`,
      );
    }
    return filtered;
  }
  if (!stats.isFile()) {
    throw new CliError("invalid_input", "Input must be a file or directory.");
  }
  return [inputPath];
}

async function handleAttest(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("attest"));
    return;
  }

  const [rawInputPath] = parsed.positionals;

  if (!rawInputPath) {
    throw new CliError("missing_file", "Usage: arr attest <file> ...");
  }
  const inputPath = normalizePathInput(rawInputPath);

  const { config } = await loadConfig();
  const creator = resolveCreator(parsed, config);
  const privateKeyPath = resolvePrivateKeyPath(parsed, config);
  await ensureFileExists(privateKeyPath);

  const privateKeyPem = await readFile(privateKeyPath, "utf8");
  const tool = resolveTool(parsed, config);
  const modeOption = resolveMode(parsed, config);
  const outPathRaw = getStringOption(parsed, "out");
  const outPath = outPathRaw ? normalizePathInput(outPathRaw) : undefined;
  const recursive = parsed.options.recursive === true;
  const outputDir = recursive && outPath ? outPath : undefined;

  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
  }

  const directoryFilter = resolveDirectoryFilter(parsed);
  const targets = await collectInputPaths(inputPath, recursive, directoryFilter);
  if (!parsed.wantsJson && targets.length > 1 && directoryFilter.mode !== "all") {
    process.stdout.write(
      `Attesting ${targets.length} file(s). Use --all to include non-image files, or --types to specify extensions.\n`,
    );
  }
  const results: Array<{
    inputPath: string;
    mode: "metadata" | "sidecar";
    format?: "png" | "jpeg";
    outputPath: string;
    signed: SignedAttestation;
  }> = [];

  for (const targetPath of targets) {
    const intent = resolveIntentForFile(targetPath, parsed, config);
    const overrides: AttestationOverrides = { creator };
    if (intent) {
      overrides.intent = intent;
    }
    if (tool) {
      overrides.tool = tool;
    }
    const attestation = buildAttestation(parsed, overrides);
    const signed = signAttestation(attestation, privateKeyPem);

    const paths: AttestPaths = {};
    if (outputDir) {
      paths.metadata = metadataOutputPathAt(targetPath, outputDir);
      paths.sidecar = sidecarOutputPathAt(targetPath, outputDir);
    } else if (outPath) {
      paths.metadata = outPath;
      paths.sidecar = outPath;
    }

    const outcome = await attestSigned(targetPath, signed, modeOption, paths);
    const result: {
      inputPath: string;
      mode: "metadata" | "sidecar";
      outputPath: string;
      signed: SignedAttestation;
      format?: "png" | "jpeg";
    } = {
      inputPath: targetPath,
      mode: outcome.mode,
      outputPath: outcome.outputPath,
      signed,
    };
    if (outcome.format) {
      result.format = outcome.format;
    }
    results.push(result);

    if (!parsed.wantsJson) {
      if (outcome.mode === "sidecar") {
        process.stdout.write(`Wrote ARR sidecar: ${outcome.outputPath}\n`);
      } else {
        process.stdout.write(
          `Embedded ARR attestation in ${outcome.format?.toUpperCase()} metadata: ${outcome.outputPath}\n`,
        );
      }
    }
  }

  if (parsed.wantsJson) {
    if (results.length === 1) {
      const result = results[0];
      if (!result) {
        return;
      }
      process.stdout.write(
        toJson("attest", {
          mode: result.mode,
          format: result.format,
          outputPath: result.outputPath,
          signed: result.signed,
        }),
      );
    } else {
      process.stdout.write(
        toJson("attest", {
          results,
        }),
      );
    }
  }
}

async function handleWatch(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("watch"));
    return;
  }

  const { config } = await loadConfig();
  const creator = resolveCreator(parsed, config);
  const privateKeyPath = resolvePrivateKeyPath(parsed, config);
  await ensureFileExists(privateKeyPath);
  const privateKeyPem = await readFile(privateKeyPath, "utf8");

  const inputDirRaw =
    getStringOption(parsed, "in") ?? config.defaultInbox ?? path.join(os.homedir(), "ARR-Inbox");
  const inputDir = normalizePathInput(inputDirRaw);
  await mkdir(inputDir, { recursive: true });
  await ensureDirExists(inputDir);

  const outputDirRaw = getStringOption(parsed, "out-dir") ?? config.outputDir;
  const outputDir = outputDirRaw ? normalizePathInput(outputDirRaw) : undefined;
  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
  }

  const tool = resolveTool(parsed, config);
  const modeOption = resolveMode(parsed, config);
  const directoryFilter = resolveDirectoryFilter(parsed);

  const pending = new Map<string, NodeJS.Timeout>();

  const processFile = async (filePath: string): Promise<void> => {
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) return;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    const fileName = path.basename(filePath);
    if (isSkippableFilename(fileName)) {
      return;
    }

    if (directoryFilter.mode !== "all") {
      const exts = directoryFilter.exts ?? DEFAULT_IMAGE_EXTS;
      if (!hasSupportedExtension(filePath, exts)) {
        return;
      }
    }

    const outputBaseDir = outputDir ?? path.dirname(filePath);
    const paths: AttestPaths = outputDir
      ? {
          metadata: metadataOutputPathAt(filePath, outputBaseDir),
          sidecar: sidecarOutputPathAt(filePath, outputBaseDir),
        }
      : {};

    const intent = resolveIntentForFile(filePath, parsed, config);
    const overrides: AttestationOverrides = { creator };
    if (intent) {
      overrides.intent = intent;
    }
    if (tool) {
      overrides.tool = tool;
    }
    const attestation = buildAttestation(parsed, overrides);
    const signed = signAttestation(attestation, privateKeyPem);

    const outcome = await attestSigned(filePath, signed, modeOption, paths);

    if (parsed.wantsJson) {
      process.stdout.write(
        toJson("watch", {
          inputPath: filePath,
          mode: outcome.mode,
          format: outcome.format,
          outputPath: outcome.outputPath,
        }),
      );
      return;
    }

    if (outcome.mode === "sidecar") {
      process.stdout.write(`Attested (sidecar): ${filePath} -> ${outcome.outputPath}\n`);
      return;
    }

    process.stdout.write(`Attested (${outcome.format?.toUpperCase()}): ${filePath} -> ${outcome.outputPath}\n`);
  };

  const schedule = (filePath: string): void => {
    const existing = pending.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      pending.delete(filePath);
      void processFile(filePath).catch((error) => {
        const normalized = normalizeError(error);
        if (parsed.wantsJson) {
          process.stderr.write(toJsonError("watch", normalized));
        } else {
          process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`);
        }
      });
    }, 400);

    pending.set(filePath, timer);
  };

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("watch", {
        status: "started",
        inputDir,
        outputDir: outputDir ?? null,
        mode: modeOption,
      }),
    );
  } else {
    process.stdout.write(`Watching ${inputDir}\n`);
    if (outputDir) {
      process.stdout.write(`Output directory: ${outputDir}\n`);
    }
    if (directoryFilter.mode !== "all") {
      const exts = [...(directoryFilter.exts ?? DEFAULT_IMAGE_EXTS)].join(", ");
      process.stdout.write(`Filtering to: ${exts}\n`);
    }
    process.stdout.write("Drop files into the folder to auto-attest them.\n");
  }

  watch(inputDir, { persistent: true }, (_eventType, filename) => {
    if (!filename) return;
    const filePath = path.join(inputDir, filename.toString());
    schedule(filePath);
  });
}

async function handleVerify(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("verify"));
    return;
  }

  const [rawInputPath] = parsed.positionals;

  if (!rawInputPath) {
    throw new CliError("missing_file", "Usage: arr verify <file> ...");
  }
  const inputPath = normalizePathInput(rawInputPath);

  await ensureFileExists(inputPath);
  const extracted = await loadSignedAttestation(inputPath);

  const { config } = await loadConfig();
  const publicKeyRaw = getStringOption(parsed, "public-key") ?? config.publicKeyPath;
  const publicKeyPath = publicKeyRaw ? normalizePathInput(publicKeyRaw) : undefined;
  let publicKeyPem: string | undefined;

  if (publicKeyPath) {
    await ensureFileExists(publicKeyPath);
    publicKeyPem = await readFile(publicKeyPath, "utf8");
  }

  const result = verifyAttestation(extracted.signed, publicKeyPem);

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("verify", {
        source: {
          type: extracted.source,
          path: extracted.filePath,
          format: extracted.format,
        },
        result,
      }),
    );

    if (!result.valid) {
      process.exitCode = 1;
    }

    return;
  }

  if (result.valid) {
    process.stdout.write(`ARR verification: valid${result.expired ? " (expired)" : ""}.\n`);
    return;
  }

  process.stdout.write(`ARR verification failed: ${result.reason}.\n`);
  process.exitCode = 1;
}

async function handleExtract(parsed: ParsedArgs): Promise<void> {
  if (parsed.options.help === true) {
    process.stdout.write(getHelp("extract"));
    return;
  }

  const [rawInputPath] = parsed.positionals;

  if (!rawInputPath) {
    throw new CliError("missing_file", "Usage: arr extract <file> ...");
  }
  const inputPath = normalizePathInput(rawInputPath);

  await ensureFileExists(inputPath);

  const extracted = await loadSignedAttestation(inputPath);

  if (parsed.wantsJson) {
    process.stdout.write(
      toJson("extract", {
        source: {
          type: extracted.source,
          path: extracted.filePath,
          format: extracted.format,
        },
        signed: extracted.signed,
      }),
    );

    return;
  }

  process.stdout.write(`${JSON.stringify(extracted.signed, null, 2)}\n`);
}

function normalizeError(error: unknown): { code: string; message: string } {
  if (error instanceof CliError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof ArrError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    return { code: "unexpected", message: error.message };
  }

  return { code: "unexpected", message: "An unexpected error occurred." };
}

async function run(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const firstToken = process.argv.slice(2)[0];

  if (parsed.options.version === true || process.argv.slice(2).includes("--version")) {
    await printVersion();
    return;
  }

  if (parsed.options.help === true && !parsed.command) {
    process.stdout.write(getHelp());
    return;
  }

  if (!parsed.command) {
    if (!firstToken || (firstToken && firstToken.startsWith("--"))) {
      await handleInteractive();
      return;
    }

    throw new CliError("unknown_command", `Unknown command: ${firstToken}`);
  }

  switch (parsed.command) {
    case "init":
      await handleInit(parsed);
      break;
    case "keygen":
      await handleKeygen(parsed);
      break;
    case "attest":
      await handleAttest(parsed);
      break;
    case "watch":
      await handleWatch(parsed);
      break;
    case "verify":
      await handleVerify(parsed);
      break;
    case "extract":
      await handleExtract(parsed);
      break;
    default:
      throw new CliError("unknown_command", `Unknown command: ${parsed.command}`);
  }
}

run().catch((error: unknown) => {
  const parsed = parseArgs(process.argv.slice(2));
  const normalized = normalizeError(error);

  if (parsed.wantsJson) {
    process.stderr.write(toJsonError(parsed.command, normalized));
  } else {
    process.stderr.write(`Error [${normalized.code}]: ${normalized.message}\n`);
  }

  process.exitCode = 1;
});
