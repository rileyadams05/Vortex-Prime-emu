import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const rootDir = path.resolve(__dirname, '..');
export const dataDir = path.join(rootDir, 'data');
export const tmpDir = path.join(dataDir, 'tmp');
export const privateConfigPath = path.join(dataDir, 'private-config.json');
export const tokenPath = path.join(dataDir, 'google-token.json');
export const envPath = path.join(rootDir, '.env');
export const defaultClientPath = path.resolve(rootDir, '..', 'MY-google-ID.json');

export function resolveRelative(...segments) {
  return path.resolve(rootDir, ...segments);
}
