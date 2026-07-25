import os from 'os';
import path from 'path';

const STORAGE_KEY = 'kindle-bridge';

export function getConfigBaseDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (platform === 'win32') {
    return env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  if (platform === 'darwin') {
    return path.join(env.HOME || os.homedir(), 'Library', 'Application Support');
  }
  return env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), '.config');
}

export function getStateBaseDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (platform === 'win32') {
    return env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  }
  if (platform === 'darwin') {
    return path.join(env.HOME || os.homedir(), 'Library', 'Caches');
  }
  return env.XDG_DATA_HOME || path.join(env.HOME || os.homedir(), '.local', 'share');
}

export function getProductConfigDir(): string {
  return path.join(getConfigBaseDir(), STORAGE_KEY);
}

export function getProductStateDir(): string {
  return path.join(getStateBaseDir(), STORAGE_KEY);
}
