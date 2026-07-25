import { spawnSync } from 'child_process';

export interface MacSetupTerminalOptions {
  smtpUser: string;
  kindleEmail: string;
  region?: string;
}

export function quotePosixShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function buildMacSetupCommand(options: MacSetupTerminalOptions): string {
  const args = [
    'kindle',
    'setup',
    '--provider',
    'qq',
    '--agent-assisted',
    '--test-send-confirmed',
    '--smtp-user',
    options.smtpUser,
    '--kindle-email',
    options.kindleEmail,
    '--region',
    options.region || 'amazon.com'
  ];

  return args.map(quotePosixShellArg).join(' ');
}

export function launchMacSetupTerminal(options: MacSetupTerminalOptions): void {
  if (process.platform !== 'darwin') {
    throw new Error('--open-terminal 目前仅用于 macOS');
  }

  const command = buildMacSetupCommand(options);
  const appleScript = [
    'on run argv',
    '  set setupCommand to item 1 of argv',
    '  tell application "Terminal"',
    '    activate',
    '    do script setupCommand',
    '  end tell',
    'end run'
  ].join('\n');

  const result = spawnSync('osascript', ['-e', appleScript, command], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });

  if (result.status !== 0) {
    throw new Error('无法打开 macOS Terminal 安全输入窗口；请勿在聊天中发送授权码');
  }
}
