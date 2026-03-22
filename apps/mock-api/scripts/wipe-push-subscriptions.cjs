#!/usr/bin/env node
/**
 * Wipe push-subscriptions.json to {} so all device tokens are cleared.
 * Run after rotating VAPID keys so clients re-subscribe with the new key.
 * Usage: node scripts/wipe-push-subscriptions.cjs
 *        PUSH_SUBSCRIPTIONS_FILE=/path/to/file node scripts/wipe-push-subscriptions.cjs
 */
const fs = require('fs');
const path = require('path');

const fromScripts = path.join(__dirname, '..', '..', 'data', 'push-subscriptions.json');
const fromCwd = path.join(process.cwd(), 'data', 'push-subscriptions.json');
const defaultPath = fs.existsSync(path.dirname(fromScripts)) ? fromScripts : fromCwd;
const file = process.env.PUSH_SUBSCRIPTIONS_FILE || defaultPath;

const dir = path.dirname(file);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
const empty = {};
try {
  fs.writeFileSync(file, JSON.stringify(empty, null, 2), 'utf8');
  console.log('Wiped', file, 'to {}');
} catch (err) {
  console.error('Failed to wipe', file, err.message);
  process.exit(1);
}
