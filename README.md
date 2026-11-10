# SQuirreL

Free, open-source database manager for Linux and Windows. SQLite and PostgreSQL for now.

> **Branch `fix/no-sqlite`**: SQLite is disabled so the app builds on Windows without Visual Studio Build Tools (better-sqlite3 is a native module). Only PostgreSQL is available here.

```bash
npm install
npm run dev      # development
npm run dist     # package (AppImage / NSIS, see electron-builder)
```

## Layout
- `src/main/drivers/` — one file per engine, implementing `Driver` (`types.ts`). Register new engines in `index.ts`.
- `src/main/csvImport.ts` — CSV parsing for imports (PostgreSQL `COPY ... CSV` semantics).
- `src/main/ipc.ts` — IPC surface; `src/shared/types.ts` — the typed `Api` contract shared with the renderer.
- `src/renderer/src/views/` — Table, Query, Diagram, Roles and Types views; each opens as a tab. The Table view hosts sub-views (Data, Columns, Foreign keys, Indexes, Triggers, DDL, DBML, ERD) in `views/table/`.

## Roadmap
Multi-connection ✅ · table viewer ✅ · inline edit/insert/delete ✅ · SQL scripts (run, in-app saved query library) ✅ · ER diagram ✅ · table sub-views (structure, DDL, DBML, ERD) ✅ · keyboard shortcuts (Ctrl+P quick open, Ctrl+N new query, Ctrl+W, Ctrl+Tab…) ✅ · grid cell / multi-row selection with keyboard navigation and Ctrl+C copy ✅ · PostgreSQL user-defined types (enum, composite, domain, range) per schema, with a drop-down to edit enum columns ✅ · resizable sidebar and query editor ✅ · CSV import into a table (pgAdmin exports: auto-detected delimiter, column mapping, NULL vs empty string, single transaction) ✅ · Ctrl+F search (sidebar schemas and tables, table columns, data grid columns, ERD tables and columns) ✅
Next: SSH tunnels, MySQL driver, query history, schema editing, autocomplete from schema, tests.
