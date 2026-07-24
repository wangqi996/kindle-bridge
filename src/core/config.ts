import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { KindleConfig } from '../types';

const ConfigSchema = z.object({
  version: z.number().default(1),
  setupVersion: z.number().default(1),
  amazonRegion: z.string().default('amazon.com'),
  kindleAddressMasked: z.string().optional(),
  transport: z.enum(['user-oauth', 'smtp', 'relay']).default('user-oauth'),
  provider: z.literal('qq').optional(),
  capabilityState: z.enum([
    'needs_setup',
    'awaiting_device_confirmation',
    'ready',
    'needs_reauth',
    'needs_repair'
  ]).default('needs_setup'),
  deviceVerified: z.boolean().default(false),
  defaultAuthor: z.string().default('Kindle Bridge User'),
  language: z.string().default('zh-CN'),
  keepGeneratedEpub: z.boolean().default(false),
  connectedAt: z.string().optional(),
  lastVerifiedAt: z.string().nullable().optional()
});

export function getConfigDir(): string {
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? `${process.env.HOME}/Library/Preferences` : `${process.env.HOME}/.config`);
  return path.join(appData, 'kindle-bridge');
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function loadConfig(): KindleConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return ConfigSchema.parse({});
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const json = JSON.parse(raw);
    if (json.capabilityState === undefined || json.deviceVerified === undefined) {
      const previouslyVerified = !!json.lastVerifiedAt;
      json.capabilityState = previouslyVerified ? 'ready' : 'awaiting_device_confirmation';
      json.deviceVerified = previouslyVerified;
      json.setupVersion = 1;
    }
    return ConfigSchema.parse(json);
  } catch (error) {
    throw new Error(`配置文件已损坏或不符合格式: ${configPath}`);
  }
}

export function saveConfig(config: Partial<KindleConfig>): KindleConfig {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const current = loadConfig();
  const updated = ConfigSchema.parse({ ...current, ...config });
  fs.writeFileSync(getConfigPath(), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function clearConfig(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}
