# AGENTS.md

Guide pour les agents (et humains) qui travaillent sur DataFinder : gestionnaire de bases de données open source (Electron + React + TypeScript). SQLite et PostgreSQL pour l'instant.

## Commandes

```bash
npm install
npm run dev        # développement
npm run typecheck  # à lancer avant chaque commit
npm run build      # build electron-vite
npm run dist       # package (AppImage)
```

## Architecture

- `src/main/` : process Electron principal. `drivers/` contient un fichier par moteur de BDD implémentant `Driver` (`drivers/types.ts`), enregistré dans `drivers/index.ts`. `ipc.ts` expose les handlers IPC.
- `src/preload/` : pont sécurisé entre main et renderer.
- `src/shared/types.ts` : contrat d'API typé (`Api`) partagé. Toute nouvelle fonctionnalité IPC commence ici.
- `src/renderer/src/` : UI React. `views/` (Table, Query, Diagram, un onglet chacune), `components/`, `lib/` (store zustand, utilitaires).

Ajouter un moteur de BDD : implémenter `Driver`, l'enregistrer dans `drivers/index.ts`, étendre `DriverId` dans `shared/types.ts`.

## Git

### Commits réguliers et atomiques

- **Commite souvent**, dès qu'une unité de travail cohérente est terminée et fonctionne. Ne laisse pas s'accumuler des heures de modifications non commitées.
- **Un commit = un changement logique.** Une feature, un fix ou un refactor par commit, jamais un mélange. Si tu ne peux pas résumer le commit en une phrase courte, il faut le découper.
- Le projet doit compiler (`npm run typecheck`) à chaque commit autant que possible.
- Utilise `git add <fichiers>` ciblé (ou `git add -p`), pas `git add .` à l'aveugle.
- Ne commite jamais : `node_modules`, `out`, `dist`, `.idea`, secrets, mots de passe ou chaînes de connexion réelles.
- Ne réécris pas l'historique déjà poussé (pas de `push --force` sans accord explicite).

### Conventional Commits

Format : `type(scope): description`, en anglais, à l'impératif, sans point final, ~72 caractères max.

| Type | Usage |
|------|-------|
| `feat` | nouvelle fonctionnalité |
| `fix` | correction de bug |
| `refactor` | changement de code sans changement de comportement |
| `perf` | amélioration de performance |
| `docs` | documentation uniquement |
| `style` | formatage, CSS sans impact fonctionnel |
| `test` | ajout/modification de tests |
| `chore` | outillage, dépendances, config |
| `build` / `ci` | build, packaging, intégration continue |

Scopes usuels : `drivers`, `main`, `shared`, `sidebar`, `table`, `query`, `diagram`, `export`, `app`.

Exemples : `feat(diagram): highlight related columns on click`, `fix(table): keep scroll position after row edit`, `chore: bump electron to 45`.

Un changement cassant s'indique avec `!` (`feat(shared)!: rename Api.query`) et un paragraphe `BREAKING CHANGE:` dans le corps. Le corps du message explique le **pourquoi** quand il n'est pas évident.

## Documentation

- `README.md` : présentation, commandes, layout, roadmap. À mettre à jour quand une feature de la roadmap est livrée.
- `TODO.md` : backlog (Config / Feature / FIX / Idées). Coche ou retire un item quand tu le termines.
- `AGENTS.md` / `CLAUDE.md` : ce guide. Mets-le à jour si l'architecture ou les conventions changent.
- Documente le **pourquoi** dans le code et les messages de commit ; le **quoi** doit se lire dans le code lui-même.

## Bonnes pratiques de code

### Découper

- Fonctions et méthodes **courtes, à responsabilité unique**. Si une fonction fait plusieurs choses, extrais-les en fonctions nommées.
- Composants React petits : extrais la logique dans des hooks ou des fonctions pures dans `lib/`, et les sous-parties d'UI dans `components/`.
- Évite les fichiers fleuves et l'imbrication profonde (préfère les retours anticipés).
- Pas de duplication : factorise ce qui existe déjà avant d'ajouter du code similaire (ex. logique commune entre drivers).

### TSDoc

Documente toute fonction, type et interface **exportés**, avec la syntaxe TSDoc :

```ts
/**
 * Fetches a page of rows from a table.
 *
 * @param conn - Active connection configuration.
 * @param req - Pagination, sorting and optional raw `WHERE` fragment.
 * @returns The rows along with the total matching count.
 * @throws If the table does not exist or the `where` fragment is invalid.
 */
```

Commente les propriétés non évidentes des interfaces (`/** … */`) et les choix surprenants. Pas de commentaire qui répète le code.

### Nommage

- Noms **explicites et prononçables** : `selectedTable`, pas `st` ; `fetchTableRows`, pas `doIt`.
- Fonctions = verbes (`loadSchema`, `buildInsertStatement`) ; booléens = `is…` / `has…` / `can…`.
- `camelCase` pour variables et fonctions, `PascalCase` pour types et composants React, `UPPER_SNAKE_CASE` pour les vraies constantes.
- Pas d'abréviations obscures ni de noms à une lettre (hors indices de boucle triviaux).

### TypeScript

- Mode strict : pas de `any` (utilise `unknown` + narrowing). Typage explicite des frontières (IPC, drivers, props).
- Les types partagés vivent dans `src/shared/types.ts`, jamais dupliqués côté renderer.
- Préfère `const`, l'immutabilité et les fonctions pures.

### Sécurité

- Le renderer n'accède jamais à Node directement : tout passe par le preload et l'IPC typé.
- Les valeurs fournies par l'utilisateur sont passées en paramètres liés ; les identifiants SQL sont échappés par le driver.
- Ne logge jamais de mots de passe.

## Avant de terminer une tâche

1. `npm run typecheck` passe.
2. L'app démarre (`npm run dev`) si le changement touche l'UI ou l'IPC.
3. La doc concernée (README, TODO, TSDoc) est à jour.
4. Les changements sont commités en commits atomiques et conventionnels.
