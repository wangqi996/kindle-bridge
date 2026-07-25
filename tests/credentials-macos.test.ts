import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const commandMock = vi.hoisted(() => ({
  spawnSync: vi.fn(),
  keychainValue: ''
}));

vi.mock('child_process', () => ({
  spawnSync: commandMock.spawnSync
}));

import {
  clearCredentials,
  getCredentialsPath,
  loadCredentials,
  saveCredentials
} from '../src/core/credentials';

describe('macOS Keychain credential protection', () => {
  const originalHome = process.env.HOME;
  const originalPlatform = process.platform;
  let tempHome = '';

  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-macos-credentials-'));
    process.env.HOME = tempHome;
    commandMock.keychainValue = '';
    commandMock.spawnSync.mockImplementation((_executable: string, args: string[]) => {
      const operation = args[0];
      if (operation === 'add-generic-password') {
        commandMock.keychainValue = args[args.indexOf('-w') + 1];
        return { status: 0, stdout: '', stderr: '' };
      }
      if (operation === 'find-generic-password') {
        return { status: 0, stdout: commandMock.keychainValue, stderr: '' };
      }
      if (operation === 'delete-generic-password') {
        commandMock.keychainValue = '';
        return { status: 0, stdout: '', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: 'unexpected security invocation' };
    });
  });

  afterEach(() => {
    clearCredentials();
    commandMock.spawnSync.mockReset();
    process.env.HOME = originalHome;
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('stores credentials in Keychain and only a non-secret marker on disk', () => {
    const credentials = {
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      smtpUser: 'reader@example.com',
      smtpPass: 'secret-auth-code',
      kindleEmail: 'reader@kindle.com'
    };

    saveCredentials(credentials);

    const marker = fs.readFileSync(getCredentialsPath(), 'utf8');
    expect(marker).toContain('macos-keychain-current-user');
    expect(marker).not.toContain(credentials.smtpPass);
    expect(marker).not.toContain(credentials.smtpUser);
    expect(loadCredentials()).toEqual(credentials);
    expect(commandMock.spawnSync).toHaveBeenCalledWith(
      'security',
      expect.arrayContaining(['add-generic-password', '-U']),
      expect.any(Object)
    );
  });
});
