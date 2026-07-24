import fs from 'fs';
import { loadConfig, getConfigPath } from './config';
import { loadCredentials } from './credentials';
import { CapabilityStatus } from '../types';

export function getCapabilityStatus(): CapabilityStatus {
  const configExists = fs.existsSync(getConfigPath());
  const config = loadConfig();
  const credentials = loadCredentials();
  const credentialsAvailable = !!(
    credentials?.smtpHost
    && credentials.smtpPort
    && credentials.smtpUser
    && credentials.smtpPass
    && credentials.kindleEmail
  );

  let state = config.capabilityState;
  let nextAction: string | undefined;

  if (!configExists && !credentialsAvailable) {
    state = 'needs_setup';
    nextAction = '运行 kindle setup，由 Agent 完成首次配置与测试投递';
  } else if (!credentialsAvailable) {
    state = 'needs_reauth';
    nextAction = '重新运行 kindle setup，更新邮箱授权码';
  } else if (!config.connectedAt) {
    state = 'needs_repair';
    nextAction = '运行 kindle doctor 检查内部状态，再重新运行 kindle setup';
  } else if (!config.deviceVerified || config.capabilityState !== 'ready') {
    state = 'awaiting_device_confirmation';
    nextAction = '在 Kindle 设备或 App 确认测试书到达，然后运行 kindle confirm';
  }

  const ready = state === 'ready' && credentialsAvailable && config.deviceVerified;

  return {
    schemaVersion: 1,
    installed: true,
    state: ready ? 'ready' : state,
    ready,
    provider: config.provider,
    credentialsAvailable,
    kindleAddressMasked: config.kindleAddressMasked,
    deviceVerified: config.deviceVerified,
    setupVersion: config.setupVersion,
    connectedAt: config.connectedAt,
    lastVerifiedAt: config.lastVerifiedAt,
    nextAction: ready ? '可以直接运行 kindle send <file>' : nextAction
  };
}
