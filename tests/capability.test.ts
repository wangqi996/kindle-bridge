import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCapabilityStatus } from '../src/core/capability';
import { clearConfig, saveConfig } from '../src/core/config';
import { clearCredentials, saveCredentials } from '../src/core/credentials';

describe('Kindle capability state', () => {
  const originalAppData = process.env.APPDATA;
  let tempAppData = '';

  beforeEach(() => {
    tempAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-capability-'));
    process.env.APPDATA = tempAppData;
  });

  afterEach(() => {
    clearCredentials();
    clearConfig();
    process.env.APPDATA = originalAppData;
    fs.rmSync(tempAppData, { recursive: true, force: true });
  });

  it('starts in needs_setup without state or credentials', () => {
    expect(getCapabilityStatus()).toMatchObject({
      state: 'needs_setup',
      ready: false,
      credentialsAvailable: false,
      deviceVerified: false
    });
  });

  it('does not become ready until the setup test is device-confirmed', () => {
    saveCredentials({
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      smtpUser: 'reader@example.com',
      smtpPass: 'secret-auth-code',
      kindleEmail: 'reader@kindle.com'
    });
    saveConfig({
      connectedAt: new Date().toISOString(),
      capabilityState: 'awaiting_device_confirmation',
      deviceVerified: false,
      transport: 'smtp'
    });

    expect(getCapabilityStatus()).toMatchObject({
      state: 'awaiting_device_confirmation',
      ready: false,
      credentialsAvailable: true
    });

    saveConfig({
      capabilityState: 'ready',
      deviceVerified: true,
      lastVerifiedAt: new Date().toISOString()
    });

    expect(getCapabilityStatus()).toMatchObject({
      state: 'ready',
      ready: true,
      credentialsAvailable: true,
      deviceVerified: true
    });
  });
});
