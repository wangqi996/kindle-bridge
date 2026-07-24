import { spawn } from 'child_process';

export function openInSystemBrowser(url: string): void {
  const command = process.platform === 'win32'
    ? { executable: 'cmd.exe', args: ['/c', 'start', '', url] }
    : process.platform === 'darwin'
      ? { executable: 'open', args: [url] }
      : { executable: 'xdg-open', args: [url] };

  const child = spawn(command.executable, command.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}
