# DataFinder (working title)

Free, open-source database manager for Linux and Windows. SQLite and PostgreSQL for now.

```bash
npm install
npm run dev      # development
npm run dist     # package (AppImage / NSIS, see electron-builder)
```

## Layout
- `src/main/drivers/` — one file per engine, implementing `Driver` (`types.ts`). Register new engines in `index.ts`.
- `src/main/ipc.ts` — IPC surface; `src/shared/types.ts` — the typed `Api` contract shared with the renderer.
- `src/renderer/src/views/` — Table, Query and Diagram views; each opens as a tab. The Table view hosts sub-views (Data, Columns, Foreign keys, Indexes, Triggers, DDL, DBML, ERD) in `views/table/`.

## Roadmap
Multi-connection ✅ · table viewer ✅ · inline edit/insert/delete ✅ · SQL scripts (run, in-app saved query library) ✅ · ER diagram ✅ · table sub-views (structure, DDL, DBML, ERD) ✅ · keyboard shortcuts (Ctrl+P quick open, Ctrl+N new query, Ctrl+W, Ctrl+Tab…) ✅
Next: SSH tunnels, MySQL driver, export CSV/JSON, query history, schema editing, autocomplete from schema, tests.
