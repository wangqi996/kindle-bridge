import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Kindle skills architecture', () => {
  const skillsRoot = path.join(process.cwd(), 'skills');
  const setupRoot = path.join(skillsRoot, 'kindle-setup');
  const sendRoot = path.join(skillsRoot, 'send-to-kindle');
  const routerRoot = path.join(skillsRoot, 'kindle-bridge');
  const setupText = fs.readFileSync(path.join(setupRoot, 'SKILL.md'), 'utf-8');
  const sendText = fs.readFileSync(path.join(sendRoot, 'SKILL.md'), 'utf-8');
  const routerText = fs.readFileSync(path.join(routerRoot, 'SKILL.md'), 'utf-8');
  const stateMachine = fs.readFileSync(
    path.join(setupRoot, 'references', 'first-run-state-machine.md'),
    'utf-8'
  );

  it('keeps first-run secrets and verification in the setup skill', () => {
    expect(setupText).not.toContain('[TODO');
    expect(setupText).toContain('kindle capability --json');
    expect(setupText).toContain('data.ready: true');
    expect(stateMachine).toContain('授权码已复制');
    expect(stateMachine).toContain('授权码已粘贴');
    expect(stateMachine).toContain('允许发送测试书');
    expect(stateMachine).toContain('--test-send-confirmed');
    expect(stateMachine).toContain('Kindle已收到');
    expect(stateMachine).toContain('QQ 邮箱首页右上角“设置” → 设置页左下“账号与安全” → 新页面“安全设置”');
    expect(
      fs.existsSync(path.join(setupRoot, 'assets', 'qq-manual-guide.svg'))
    ).toBe(true);
  });

  it('keeps daily delivery small and routes setup instead of duplicating it', () => {
    expect(sendText).not.toContain('POP3/IMAP/SMTP');
    expect(sendText).toContain('$kindle-setup');
    expect(sendText).toContain('--dry-run');
    expect(sendText).toContain('provider_accepted');
    expect(routerText).toContain('../send-to-kindle/SKILL.md');
    expect(routerText).toContain('../kindle-setup/SKILL.md');
    expect(routerText).not.toContain('授权码已复制');
  });

  it('ships a one-time current-user bootstrap script', () => {
    const bootstrap = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'bootstrap.ps1'),
      'utf-8'
    );
    expect(bootstrap).toContain('npm link');
    expect(bootstrap).toContain('.agents\\skills');
    expect(bootstrap).toContain('kindle --json capability');
  });
});
