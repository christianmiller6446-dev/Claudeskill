// env.js — zero-dependency .env loader shared by scanner/dashboard.
// Looks for a .env file at the project root (two levels above this file)
// and loads any KEY=VALUE pairs into process.env without overwriting
// variables that are already set in the real environment.

const fs   = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '..', '.env');

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

module.exports = { loadEnv };
