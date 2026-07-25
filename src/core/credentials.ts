import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { getConfigDir } from './config';

interface EncryptedCredentialPayload {
  version: 2;
  provider: 'windows-dpapi-current-user' | 'macos-keychain-current-user';
  data?: string;
  service?: string;
  account?: string;
}

export interface CredentialStore {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  oauthRefreshToken?: string;
  kindleEmail?: string;
}

export function getCredentialsPath(): string {
  return path.join(getConfigDir(), 'credentials.enc');
}

const MACOS_KEYCHAIN_SERVICE = 'com.kindle-for-agents.smtp-credentials';
const MACOS_KEYCHAIN_ACCOUNT = 'current-user';

export function getCredentialStorageDescription(): string {
  if (process.platform === 'win32') {
    return 'Windows 当前用户 DPAPI';
  }
  if (process.platform === 'darwin') {
    return 'macOS 登录钥匙串';
  }
  return '不受支持的平台凭据库';
}

export function ensureCredentialStorageSupported(
  platform: NodeJS.Platform = process.platform
): void {
  if (platform !== 'win32' && platform !== 'darwin') {
    throw new Error('安全凭据存储目前仅支持 Windows 和 macOS');
  }
}

function runPowerShell(script: string, input: string): string {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }
  );

  if (result.status !== 0) {
    throw new Error('Windows DPAPI 凭据操作失败');
  }

  return result.stdout.trim();
}

function runSecurity(args: string[], allowMissing = false): string {
  const result = spawnSync('security', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });

  if (result.status !== 0) {
    const details = `${result.stderr || ''} ${result.stdout || ''}`;
    if (allowMissing && /could not be found|item not found/i.test(details)) {
      return '';
    }
    throw new Error('macOS 钥匙串凭据操作失败');
  }

  return result.stdout.trim();
}

function protectForCurrentWindowsUser(plainText: string): string {
  if (process.platform !== 'win32') {
    throw new Error('当前 MVP 的安全凭据存储仅支持 Windows');
  }

  const input = Buffer.from(plainText, 'utf8').toString('base64');
  const script = [
    '$inputB64 = [Console]::In.ReadToEnd().Trim()',
    '$plain = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($inputB64))',
    '$secure = ConvertTo-SecureString $plain -AsPlainText -Force',
    'ConvertFrom-SecureString $secure'
  ].join('; ');

  return runPowerShell(script, input);
}

function unprotectForCurrentWindowsUser(cipherText: string): string {
  if (process.platform !== 'win32') {
    throw new Error('当前 MVP 的安全凭据存储仅支持 Windows');
  }

  const script = [
    '$cipher = [Console]::In.ReadToEnd().Trim()',
    '$secure = ConvertTo-SecureString $cipher',
    '$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)',
    'try {',
    '  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)',
    '  [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($plain))',
    '} finally {',
    '  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)',
    '}'
  ].join('; ');

  const output = runPowerShell(script, cipherText);
  return Buffer.from(output, 'base64').toString('utf8');
}

function saveToMacOSKeychain(creds: CredentialStore): void {
  runSecurity([
    'add-generic-password',
    '-a', MACOS_KEYCHAIN_ACCOUNT,
    '-s', MACOS_KEYCHAIN_SERVICE,
    '-w', JSON.stringify(creds),
    '-U'
  ]);
}

function loadFromMacOSKeychain(): CredentialStore {
  const plainText = runSecurity([
    'find-generic-password',
    '-a', MACOS_KEYCHAIN_ACCOUNT,
    '-s', MACOS_KEYCHAIN_SERVICE,
    '-w'
  ]);
  return JSON.parse(plainText) as CredentialStore;
}

function clearMacOSKeychain(): void {
  runSecurity([
    'delete-generic-password',
    '-a', MACOS_KEYCHAIN_ACCOUNT,
    '-s', MACOS_KEYCHAIN_SERVICE
  ], true);
}

export function saveCredentials(creds: CredentialStore): void {
  ensureCredentialStorageSupported();
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let payload: EncryptedCredentialPayload;
  if (process.platform === 'win32') {
    payload = {
      version: 2,
      provider: 'windows-dpapi-current-user',
      data: protectForCurrentWindowsUser(JSON.stringify(creds))
    };
  } else if (process.platform === 'darwin') {
    saveToMacOSKeychain(creds);
    payload = {
      version: 2,
      provider: 'macos-keychain-current-user',
      service: MACOS_KEYCHAIN_SERVICE,
      account: MACOS_KEYCHAIN_ACCOUNT
    };
  } else {
    throw new Error('安全凭据存储平台检查失败');
  }

  try {
    fs.writeFileSync(getCredentialsPath(), JSON.stringify(payload, null, 2), {
      encoding: 'utf-8',
      mode: 0o600
    });
  } catch (error) {
    if (process.platform === 'darwin') {
      clearMacOSKeychain();
    }
    throw error;
  }
}

export function loadCredentials(): CredentialStore | null {
  const credentialsPath = getCredentialsPath();
  if (!fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(credentialsPath, 'utf-8');
    const payload = JSON.parse(raw) as EncryptedCredentialPayload;
    if (payload.version !== 2) {
      throw new Error('不支持的旧版凭据格式，请重新运行 kindle setup');
    }
    if (payload.provider === 'windows-dpapi-current-user' && payload.data) {
      return JSON.parse(unprotectForCurrentWindowsUser(payload.data)) as CredentialStore;
    }
    if (
      payload.provider === 'macos-keychain-current-user'
      && payload.service === MACOS_KEYCHAIN_SERVICE
      && payload.account === MACOS_KEYCHAIN_ACCOUNT
    ) {
      return loadFromMacOSKeychain();
    }
    throw new Error('不支持的凭据格式，请重新运行 kindle setup');
  } catch (err) {
    return null;
  }
}

export function clearCredentials(): void {
  if (process.platform === 'darwin') {
    clearMacOSKeychain();
  }
  const credentialsPath = getCredentialsPath();
  if (fs.existsSync(credentialsPath)) {
    fs.unlinkSync(credentialsPath);
  }
}
