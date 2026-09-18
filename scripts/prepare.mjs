#!/usr/bin/env node
import { spawnSync } from "node:child_process";
// Lancé automatiquement après `pnpm install` (script npm "prepare"), y compris dans les images
// Docker, chaque étape doit donc être best-effort et ne jamais faire échouer `pnpm install` si l'outillage optionnel est absent.
import { existsSync } from "node:fs";

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  return res.status === 0;
}

function commandExists(cmd) {
  return spawnSync(cmd, ["--version"], { stdio: "ignore" }).error === undefined;
}

// 1. Git hooks
if (existsSync(".git")) {
  console.log("-> Installation des git hooks (husky)");
  if (!run("pnpm", ["exec", "husky"])) {
    console.warn("⚠ Échec de l'installation des git hooks, ignoré.");
  }
} else {
  console.log("-> Pas de dossier .git (build Docker/CI), git hooks ignorés.");
}

// 2. Client Prisma, nécessaire pour que tsc/vitest résolvent @docysen/db sans étape manuelle.
console.log("-> Génération du client Prisma (@docysen/db)");
if (!run("pnpm", ["--filter", "@docysen/db", "run", "generate"])) {
  console.warn(
    "⚠ Échec de la génération Prisma. Relance `pnpm --filter @docysen/db run generate` manuellement.",
  );
}

// 3. Venvs des workers Python, pour que `pnpm install` seul suffise à préparer le repo.
const pythonWorkers = ["ocr-worker", "tagging-worker", "thumbnail-worker"];
const pythonBin = commandExists("python3") ? "python3" : commandExists("python") ? "python" : null;

if (!pythonBin) {
  console.warn("⚠ python3 introuvable, venvs des workers Python ignorés.");
} else {
  for (const worker of pythonWorkers) {
    const dir = `apps/${worker}`;
    const venvDir = `${dir}/.venv`;
    const pip = process.platform === "win32" ? `${venvDir}/Scripts/pip.exe` : `${venvDir}/bin/pip`;

    if (!existsSync(venvDir)) {
      console.log(`-> Création du venv pour ${worker}`);
      if (!run(pythonBin, ["-m", "venv", venvDir])) {
        console.warn(`⚠ Échec de la création du venv pour ${worker}, ignoré.`);
        continue;
      }
    }

    console.log(`-> pip install pour ${worker}`);
    if (!run(pip, ["install", "-q", "-r", `${dir}/requirements.txt`])) {
      console.warn(`⚠ Échec de pip install pour ${worker}.`);
    }
  }
}
