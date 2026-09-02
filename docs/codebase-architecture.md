# Codebase Architecture — Discovery Phase 2 (No Changes Made)

STACK (confirmed from package.json / code):
- Customer: React 18 + Vite + Tailwind + react-router-dom + axios (Node-based build only; no Python)
- Admin: React + Vite + Tailwind + lucide icons + custom AdminIcon / theme / sound utilities
- Backend: Node/Express 4 + SQLite (sql.js based on db.js) + passport + JWT + bcryptjs + session-file-store
- DB: SQLite (db.js uses sql.js); schema.sql defines full model
- Build: Vite; package manager: npm (package-lock.json present)
- Styling: Tailwind + custom CSS in client/src/index.css; dark mode via `.dark` class + CSS variables
- Auth: session-based (express-session + FileStore) + passport (Google OAuth + local) + JWT referenced; admin session flag `isAdmin`
- Validation: custom `validate.js`; middleware `csrfProtection`
- Tests: Jest (jest.config.js) + integration tests (run-integration-tests.js); test paths cover inventory, sales, price lists, warehouse orders, workflow, notifications/refunds, customers, VIP

STRUCTURE:
- client/ — customer frontend (pages/, components/, api/, context/, i18n/)
- client-admin/ — admin frontend (admin/pages/, admin/components/, hooks/)
- server/ — backend (index.js, db.js, routes/, services/, middleware/, config/, data/, seed-*.js)
- docs/ — project docs from prior phases

NO CODE CHANGED IN THIS PHASE.
