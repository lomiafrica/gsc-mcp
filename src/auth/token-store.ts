import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Credentials } from 'google-auth-library';

import { oauthTokenPath } from './constants.js';

export async function ensureConfigDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
}

export async function readStoredToken(): Promise<Credentials | null> {
  try {
    const raw = await readFile(oauthTokenPath(), 'utf8');
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function writeStoredToken(token: Credentials): Promise<void> {
  const path = oauthTokenPath();
  await ensureConfigDir(path);
  await writeFile(path, JSON.stringify(token, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);
}

export async function deleteStoredToken(): Promise<void> {
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(oauthTokenPath());
  } catch {
    // ignore
  }
}
