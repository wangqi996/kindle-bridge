import { afterEach, describe, expect, it, vi } from 'vitest';

const { spawnSyncMock } = vi.hoisted(() => ({
  spawnSyncMock: vi.fn()
}));

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock
}));

import {
  buildMacSetupCommand,
  launchMacSetupTerminal,
  quotePosixShellArg
} from '../src/wizard/terminal';

describe('macOS visible setup terminal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    spawnSyncMock.mockReset();
  });

  it('builds a safely quoted setup command without the authorization code', () => {
    expect(quotePosixShellArg("reader'o@example.com")).toBe(
      "'reader'\"'\"'o@example.com'"
    );

    const command = buildMacSetupCommand({
      smtpUser: "reader'o@example.com",
      kindleEmail: 'reader@kindle.com'
    });

    expect(command).toContain("'kindle' 'setup'");
    expect(command).toContain("'--agent-assisted'");
    expect(command).toContain("'--test-send-confirmed'");
    expect(command).not.toContain('--open-terminal');
    expect(command.toLowerCase()).not.toContain('authorization');
  });

  it('opens Terminal.app through osascript and keeps secrets out of argv', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '', stderr: '' });

    launchMacSetupTerminal({
      smtpUser: 'reader@example.com',
      kindleEmail: 'reader@kindle.com'
    });

    expect(spawnSyncMock).toHaveBeenCalledOnce();
    const [executable, args] = spawnSyncMock.mock.calls[0];
    expect(executable).toBe('osascript');
    expect(args[0]).toBe('-e');
    expect(args[1]).toContain('tell application "Terminal"');
    expect(args[2]).toContain("'kindle' 'setup'");
    expect(JSON.stringify(args)).not.toContain('secret-auth-code');
  });
});
