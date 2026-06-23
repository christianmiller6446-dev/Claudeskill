// health.js — Scheduler task health and API error tracking.

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const TASK_DIR    = process.env.CLAUDE_SCHEDULED_TASKS_DIR || path.join(os.homedir(), '.claude', 'scheduled-tasks');
const LOG_DIR     = path.join(__dirname, '..', '..', 'scanner', 'logs');
const ERR_LOG     = path.join(__dirname, 'logs', 'api-errors.json');

const EXPECTED_TASKS = [
  'nvda-ladder-fill-watcher',
  'nvda-loss-guardian',
  'nvda-morning-check',
  'nvda-midday-check',
  'nvda-preclose-check',
  'nvda-nightly-report',
  'weekly-stock-scan',
  'monday-watchlist',
  'weekend-bot-update'
];

function getSchedulerHealth(apiErrors) {
  // Check which tasks exist on disk
  const taskStatus = EXPECTED_TASKS.map(taskId => {
    const skillPath = path.join(TASK_DIR, taskId, 'SKILL.md');
    const exists    = fs.existsSync(skillPath);
    return { taskId, registered: exists };
  });

  const registeredCount = taskStatus.filter(t => t.registered).length;
  const missingTasks    = taskStatus.filter(t => !t.registered).map(t => t.taskId);

  // API errors today
  const today = new Date().toISOString().split('T')[0];
  const todayErrors = apiErrors.filter(e => e.time.startsWith(today));

  // Load persisted errors if file exists
  let persistedErrors = [];
  try {
    if (fs.existsSync(ERR_LOG)) {
      persistedErrors = JSON.parse(fs.readFileSync(ERR_LOG, 'utf8'));
    }
  } catch { /* ignore */ }

  // Append new errors and save
  const allErrors = [...persistedErrors, ...apiErrors].slice(-200);
  try {
    const logDir = path.dirname(ERR_LOG);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.writeFileSync(ERR_LOG, JSON.stringify(allErrors, null, 2));
  } catch { /* ignore */ }

  const errorsToday = allErrors.filter(e => e.time.startsWith(today)).length;

  // Check latest scanner log
  let lastScanDate = null;
  try {
    const scanLog = path.join(LOG_DIR, 'scan-log.json');
    if (fs.existsSync(scanLog)) {
      const entries = JSON.parse(fs.readFileSync(scanLog, 'utf8'));
      if (entries.length) lastScanDate = entries[entries.length - 1].timestamp;
    }
  } catch { /* ignore */ }

  // Health warnings
  const warnings = [];
  if (missingTasks.length) warnings.push(`⚠️ Missing tasks: ${missingTasks.join(', ')}`);
  if (errorsToday >= 3) warnings.push(`🚨 ${errorsToday} API errors today`);
  if (errorsToday > 0 && errorsToday < 3) warnings.push(`⚠️ ${errorsToday} API error(s) today`);

  // Health score 0-100 based on tasks registered and error count
  const taskScore  = Math.round(registeredCount / EXPECTED_TASKS.length * 60);
  const errorScore = errorsToday === 0 ? 40 : errorsToday < 3 ? 20 : 0;
  const healthScore = taskScore + errorScore;

  return {
    expectedTasks: EXPECTED_TASKS.length,
    registeredCount,
    missingTasks,
    taskStatus,
    errorsToday,
    lastScanDate,
    warnings,
    healthScore
  };
}

module.exports = { getSchedulerHealth };
