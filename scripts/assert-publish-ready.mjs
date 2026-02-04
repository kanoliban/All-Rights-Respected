import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifests = [
  "packages/arr-core/package.json",
  "packages/arr-cli/package.json",
];

const errors = [];

for (const manifestPath of manifests) {
  const fullPath = path.join(root, manifestPath);
  const raw = await readFile(fullPath, "utf8");
  const pkg = JSON.parse(raw);

  if (pkg.private === true) {
    errors.push(`${manifestPath}: \"private\" must be false before npm publish.`);
  }

  if (typeof pkg.name !== "string" || pkg.name.length === 0) {
    errors.push(`${manifestPath}: package name is missing.`);
  } else if (pkg.name.includes("/internal-")) {
    errors.push(
      `${manifestPath}: package name (${pkg.name}) is still internal. Choose final public package names before publish.`,
    );
  }

  if (typeof pkg.description !== "string" || pkg.description.trim().length === 0) {
    errors.push(`${manifestPath}: description is required for publish.`);
  }

  if (typeof pkg.license !== "string" || pkg.license.trim().length === 0) {
    errors.push(`${manifestPath}: license is required for publish.`);
  }

  if (!pkg.repository) {
    errors.push(`${manifestPath}: repository metadata is required for publish.`);
  }

  if (!pkg.engines || typeof pkg.engines.node !== "string") {
    errors.push(`${manifestPath}: engines.node is required for publish.`);
  }
}

if (errors.length > 0) {
  console.error("Publish readiness checks failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Publish readiness checks passed.");
