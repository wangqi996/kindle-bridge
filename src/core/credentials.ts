import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { getConfigDir } from './config';

interface EncryptedCredentialPayload {
  version: 2;
  provider: 'windows-dpapi-current-user';
  data: string;
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

export function saveCredentials(creds: CredentialStore): void {
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const payload: EncryptedCredentialPayload = {
    version: 2,
    provider: 'windows-dpapi-current-user',
    data: protectForCurrentWindowsUser(JSON.stringify(creds))
  };

  fs.writeFileSync(getCredentialsPath(), JSON.stringify(payload, null, 2), {
    encoding: 'utf-8',
    mode: 0o600
  });
}

export function loadCredentials(): CredentialStore | null {
  const credentialsPath = getCredentialsPath();
  if (!fs.existsSync(credentialsPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(credentialsPath, 'utf-8');
    const payload = JSON.parse(raw) as EncryptedCredentialPayload;
    if (payload.version !== 2 || payload.provider !== 'windows-dpapi-current-user' || !payload.data) {
      throw new Error('不支持的旧版凭据格式，请重新运行 kindle connect');
    }
    return JSON.parse(unprotectForCurrentWindowsUser(payload.data)) as CredentialStore;
  } catch (err) {
    return null;
  }
}

export function clearCredentials(): void {
  const credentialsPath = getCredentialsPath();
  if (fs.existsSync(credentialsPath)) {
    fs.unlinkSync(credentialsPath);
  }
}
