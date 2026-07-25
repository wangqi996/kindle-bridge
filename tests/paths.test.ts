import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { getConfigBaseDir, getStateBaseDir } from '../src/core/paths';

describe('platform storage paths', () => {
  it('uses Windows roaming and local application data', () => {
    expect(getConfigBaseDir('win32', { APPDATA: 'C:\\Roaming' })).toBe('C:\\Roaming');
    expect(getStateBaseDir('win32', { LOCALAPPDATA: 'C:\\Local' })).toBe('C:\\Local');
  });

  it('uses conventional macOS application support and cache directories', () => {
    const env = { HOME: '/Users/reader' };
    expect(getConfigBaseDir('darwin', env)).toBe(
      path.join('/Users/reader', 'Library', 'Application Support')
    );
    expect(getStateBaseDir('darwin', env)).toBe(
      path.join('/Users/reader', 'Library', 'Caches')
    );
  });

  it('falls back to the operating system home directory', () => {
    expect(getConfigBaseDir('darwin', {})).toBe(
      path.join(os.homedir(), 'Library', 'Application Support')
    );
  });
});
