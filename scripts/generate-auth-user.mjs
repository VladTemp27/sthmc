#!/usr/bin/env node

import crypto from 'crypto';

const PASSWORD = {
  ALGORITHM: 'pbkdf2',
  ITERATIONS: 120000,
  KEY_LENGTH: 32,
  DIGEST: 'sha256',
  SALT_BYTES: 16,
};

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/generate-auth-user.mjs --email admin@example.com --password "YourPassword" [--role admin]',
    '',
    'Output:',
    '  JSON payload for a CustomUsers item you can paste into Wix CMS.',
  ].join('\n');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(plainPassword) {
  const password = String(plainPassword || '');
  const salt = crypto.randomBytes(PASSWORD.SALT_BYTES);
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PASSWORD.ITERATIONS,
    PASSWORD.KEY_LENGTH,
    PASSWORD.DIGEST
  );

  return [
    PASSWORD.ALGORITHM,
    String(PASSWORD.ITERATIONS),
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

function buildUserPayload({ email, password, role }) {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = hashPassword(password);

  return {
    email: normalizedEmail,
    passwordHash,
    isActive: true,
    role: role || 'admin',
    failedLoginCount: 0,
    lockUntil: null,
    lastLoginAt: null,
  };
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const email = normalizeEmail(args.email);
  const password = String(args.password || '');
  const role = String(args.role || 'admin');

  if (!email || !password) {
    console.error(usage());
    process.exit(1);
  }

  const payload = buildUserPayload({ email, password, role });
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

run();
