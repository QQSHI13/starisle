// Replaces __HASH__/__SALT__ placeholders in seed-data.sql with real PBKDF2 hashes
// (must match src/worker/index.ts hashPassword: PBKDF2-SHA256, 100k iterations)
// of the documented dev password. The dev password is "starisle-dev" (README).
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const DEV_PASSWORD = "starisle-dev";
const salt = randomBytes(16).toString("hex");
const hash = pbkdf2Sync(DEV_PASSWORD, salt, 100_000, 32, "sha256").toString("hex");

const path = new URL("../src/db/seed-data.sql", import.meta.url).pathname;
const sql = readFileSync(path, "utf8").replaceAll("__HASH__", hash).replaceAll("__SALT__", salt);
writeFileSync(new URL("../src/db/seed.sql", import.meta.url).pathname, sql);
console.log(`seed.sql written (dev password "${DEV_PASSWORD}", salt ${salt.slice(0, 8)}…)`);
