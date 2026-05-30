import dotenv from 'dotenv';
import fs from 'fs-extra';
import { envPath, dataDir } from './paths.mjs';

await fs.ensureDir(dataDir);

dotenv.config({ path: envPath });

export function getEnv(key, fallback = undefined) {
  const value = process.env[key];
  if (typeof value === 'undefined' || value === '') {
    return fallback;
  }
  return value;
}

export async function setEnv(key, value) {
  const envExists = await fs.pathExists(envPath);
  let lines = [];
  if (envExists) {
    const raw = await fs.readFile(envPath, 'utf8');
    lines = raw.split(/\r?\n/);
  }

  let updated = false;
  const next = lines.map((line) => {
    if (!line.trim()) return line;
    if (line.trim().startsWith('#')) return line;
    const [currentKey] = line.split('=');
    if (currentKey === key) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!updated) {
    next.push(`${key}=${value}`);
  }

  const content = next.filter(Boolean).join('\n') + '\n';
  await fs.writeFile(envPath, content, 'utf8');
  process.env[key] = value;
}
