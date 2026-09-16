# Contribuer à Docysen

## Setup

Voir le [README](./README.md) pour l'installation et le lancement du projet en local.

## Workflow Git (git flow classique)

- `main` : branche de production, toujours stable et déployable. On n'y pousse jamais directement.
- `develop` : branche d'intégration, base de toutes les nouvelles branches de travail.
- Pour contribuer :
  1. Crée ta branche depuis `develop` : `feature/nom-de-la-feature`, `fix/nom-du-bug`, `docs/...`, `chore/...`.
  2. Développe et commit dessus.
  3. Ouvre une pull request **vers `develop`** (pas vers `main`).
  4. La CI (tests) doit passer avant le merge.
  5. `main` n'est mis à jour que par merge de `develop` (releases).

## Commits

Le repo suit une convention proche de [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, ...). Garde des commits ciblés et un message qui explique le pourquoi, pas juste le quoi.

## Avant d'ouvrir une PR

```bash
pnpm lint       # oxlint
pnpm format     # oxfmt
pnpm test       # tests JS/TS (nx run-many -t test), pytest pour les workers Python (apps/ocr-worker, apps/tagging-worker, apps/thumbnail-worker)
```

La CI (`.github/workflows/ci.yml`) relance ces vérifications sur chaque PR et doit être verte avant merge.

## Utilisation de l'IA

L'usage d'assistants IA (Claude Code, GitHub Copilot, ChatGPT, etc.) pour écrire ou modifier du code est autorisé. Si tu en utilises un :

- Indique le modèle utilisé dans la description de la PR (et, si pertinent, dans le commit via un trailer `Co-Authored-By: <nom du modèle> <email>`).
- Tu restes **entièrement responsable du code produit** : tu dois le comprendre, le relire, le tester, et être capable de l'expliquer et de le maintenir. L'IA est un outil d'assistance, pas une justification pour un code que tu ne maîtrises pas.
