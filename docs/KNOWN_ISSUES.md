# Known Issues

## Resolved During Development

### 1. better-sqlite3 Native Module Compilation
- **Issue:** `better-sqlite3` requires native compilation tools (node-gyp, Python, C++ compiler) which were not available
- **Fix:** Migrated to `sql.js` — a pure JavaScript SQLite implementation with zero native dependencies
- **Status:** ✅ Resolved

### 2. better-sqlite3-session-store Package Version
- **Issue:** Specified version `^0.4.3` did not exist; latest was `0.1.0`
- **Fix:** Updated package.json to `^0.1.0`, then switched to `session-file-store` after switching to sql.js
- **Status:** ✅ Resolved

## Open Issues
- None at this time
