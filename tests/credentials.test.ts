import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearCredentials,
  ensureCredentialStorageSupported,
  getCredentialsPath,
  loadCredentials,
  saveCredentials
} from '../src/core/credentials';

describe('Windows credential protection', () => {
  const originalAppData = process.env.APPDATA;
  let tempAppData = '';

  beforeEach(() => {
    tempAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-bridge-credentials-'));
    process.env.APPDATA = tempAppData;
  });

  afterEach(() => {
    clearCredentials();
    process.env.APPDATA = originalAppData;
    fs.rmSync(tempAppData, { recursive: true, force: true });
  });

  it('round-trips credentials without storing the authorization code in plaintext', () => {
    const credentials = {
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      smtpUser: 'reader@example.com',
      smtpPass: 'secret-auth-code',
      kindleEmail: 'reader@kindle.com'
    };

    saveCredentials(credentials);

    const stored = fs.readFileSync(getCredentialsPath(), 'utf8');
    expect(stored).not.toContain(credentials.smtpPass);
    expect(stored).not.toContain(credentials.smtpUser);
    expect(loadCredentials()).toEqual(credentials);
  });

  it('rejects platforms without an implemented system credential store', () => {
    expect(() => ensureCredentialStorageSupported('linux')).toThrow(
      '安全凭据存储目前仅支持 Windows 和 macOS'
    );
  });
});
