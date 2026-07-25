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
    commandMock.spawnSync.mockImplementation((
      _executable: string,
      args: string[],
      options?: { input?: string }
    ) => {
      const operation = args[0];
      if (operation === '-i') {
        const passwordMatch = options?.input?.match(/(?:^|\s)-w\s+(\S+)/);
        if (!passwordMatch) {
          return { status: 1, stdout: '', stderr: 'missing interactive password' };
        }
        commandMock.keychainValue = passwordMatch[1];
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
      smtpPass: 'secret-auth-code"; delete-generic-password\n',
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
      ['-i'],
      expect.objectContaining({
        input: expect.stringMatching(
          /^add-generic-password -a current-user -s com\.kindle-for-agents\.smtp-credentials -w kindle-for-agents:v1:[A-Za-z0-9+/=]+ -U\n$/
        )
      })
    );

    for (const invocation of commandMock.spawnSync.mock.calls) {
      const args = invocation[1] as string[];
      expect(args).not.toContain(credentials.smtpPass);
      expect(args).not.toContain(JSON.stringify(credentials));
      expect(JSON.stringify(args)).not.toContain(credentials.smtpPass);
    }
  });

  it('loads credentials written by the previous raw-JSON Keychain format', () => {
    const legacyCredentials = {
      smtpUser: 'legacy@example.com',
      smtpPass: 'legacy-auth-code',
      kindleEmail: 'legacy@kindle.com'
    };

    saveCredentials({
      smtpUser: 'temporary@example.com',
      smtpPass: 'temporary-auth-code'
    });
    commandMock.keychainValue = JSON.stringify(legacyCredentials);

    expect(loadCredentials()).toEqual(legacyCredentials);
  });
});
