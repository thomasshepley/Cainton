#!/usr/bin/env node
/**
 * Removes the admin password set from the Settings page, so the panel
 * falls back to the ADMIN_PASSWORD env var (or the built-in default).
 *
 * Local:   node scripts/reset-admin-password.js
 * Docker:  docker compose exec wedding-rsvp node scripts/reset-admin-password.js
 */
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(process.cwd(), "data", "wedding.db");
const db = new Database(dbPath);
const result = db
  .prepare("DELETE FROM settings WHERE key = 'admin_password_hash'")
  .run();
if (result.changes > 0) {
  console.log(
    "Custom admin password removed. The panel now uses the ADMIN_PASSWORD environment variable (or the default)."
  );
} else {
  console.log(
    "No custom admin password was set — the ADMIN_PASSWORD environment variable (or the default) already applies."
  );
}
