import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Kindle Bridge Skill contract', () => {
  const skillRoot = path.join(process.cwd(), 'skills', 'kindle-bridge');
  const skillText = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf-8');
  const stateMachine = fs.readFileSync(
    path.join(skillRoot, 'references', 'first-run-state-machine.md'),
    'utf-8'
  );

  it('keeps the novice handoff and device-verification boundaries', () => {
    expect(skillText).not.toContain('[TODO');
    expect(skillText).toContain('授权码已复制');
    expect(skillText).toContain('授权码已粘贴');
    expect(skillText).toContain('允许发送测试书');
    expect(skillText).toContain('--test-send-confirmed');
    expect(skillText).toContain('device_confirmed');
    expect(skillText).toContain('Never ask the user to paste a QQ authorization code');
    expect(stateMachine).toContain('QQ已登录');
    expect(stateMachine).toContain('Kindle已收到');
    expect(stateMachine).toContain('Kindle未收到');
    expect(stateMachine).toContain('QQ 邮箱首页右上角“设置” → 设置页左下“账号与安全” → 新页面“安全设置”');
  });

  it('ships the deterministic local launcher', () => {
    expect(
      fs.existsSync(path.join(skillRoot, 'scripts', 'run-kindle-bridge.ps1'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(skillRoot, 'assets', 'qq-manual-guide.svg'))
    ).toBe(true);
  });
});
