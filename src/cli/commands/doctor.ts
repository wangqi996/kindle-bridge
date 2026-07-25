import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { loadConfig, getConfigPath } from '../../core/config';
import {
  ensureCredentialStorageSupported,
  getCredentialStorageDescription,
  loadCredentials
} from '../../core/credentials';
import { getJobsDir, listRecentJobs } from '../../core/tracker';
import { logger } from '../../core/logger';
import { EmailTransport } from '../../transport/email';
import { MachineOutput } from '../../types';
import { getCapabilityStatus } from '../../core/capability';

export interface DoctorCheckItem {
  name: string;
  passed: boolean;
  message: string;
}

export function registerDoctorCommand(program: Command) {
  program
    .command('doctor')
    .description('诊断 Kindle for Agents 环境与配置状态')
    .action(async () => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      logger.setDebug(!!globalOpts.debug);

      const checks: DoctorCheckItem[] = [];

      try {
        ensureCredentialStorageSupported();
        checks.push({
          name: '操作系统支持',
          passed: true,
          message: `${process.platform === 'darwin' ? 'macOS' : 'Windows'} 安全凭据能力可用`
        });
      } catch (err) {
        checks.push({
          name: '操作系统支持',
          passed: false,
          message: (err as Error).message
        });
      }

      const capability = getCapabilityStatus();
      checks.push({
        name: '投送能力状态',
        passed: capability.ready,
        message: capability.ready
          ? '能力已部署完成，可直接发送'
          : `能力未就绪 (${capability.state})：${capability.nextAction}`
      });

      // 1. Internal state check
      try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
          const config = loadConfig();
          checks.push({
            name: '内部状态校验',
            passed: !!config.connectedAt,
            message: config.connectedAt
              ? '内部状态有效'
              : '内部状态存在但尚未完成真实连接，请运行 kindle setup'
          });
        } else {
          checks.push({
            name: '内部状态校验',
            passed: false,
            message: '内部状态尚未创建，请运行 kindle setup'
          });
        }
      } catch (err) {
        checks.push({
          name: '内部状态校验',
          passed: false,
          message: `内部状态损坏: ${(err as Error).message}`
        });
      }

      // 2. Credentials Store Check
      try {
        const creds = loadCredentials();
        const complete = !!(
          creds?.smtpHost &&
          creds.smtpPort &&
          creds.smtpUser &&
          creds.smtpPass &&
          creds.kindleEmail
        );
        if (complete) {
          checks.push({
            name: '系统凭据读取',
            passed: true,
            message: `${getCredentialStorageDescription()}中的凭据读取成功`
          });

          const transportAvailable = await new EmailTransport(creds!).verify();
          checks.push({
            name: '发送通道连通性',
            passed: transportAvailable,
            message: transportAvailable
              ? 'SMTP 授权与发送通道可用'
              : 'SMTP 授权或发送通道不可用，请重新运行 kindle setup'
          });
        } else {
          checks.push({
            name: '系统凭据读取',
            passed: false,
            message: '未绑定完整发送凭据，请运行 kindle setup'
          });
        }
      } catch (err) {
        checks.push({
          name: '系统凭据读取',
          passed: false,
          message: `凭据库读取失败: ${(err as Error).message}`
        });
      }

      // 3. Temporary / Jobs Directory Write Access Check
      try {
        const jobsDir = getJobsDir();
        const testFile = path.join(jobsDir, `.write_test_${Date.now()}`);
        fs.writeFileSync(testFile, 'test', 'utf-8');
        fs.unlinkSync(testFile);
        checks.push({
          name: '本地存储写权限',
          passed: true,
          message: `任务存储目录可写 (${jobsDir})`
        });
      } catch (err) {
        checks.push({
          name: '本地存储写权限',
          passed: false,
          message: `存储目录不可写: ${(err as Error).message}`
        });
      }

      // 4. EPUB Builder Temp Directory Check
      try {
        const tempDir = path.join(process.cwd(), '.kindle-for-agents-temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const testEpubFile = path.join(tempDir, `.epub_test_${Date.now()}`);
        fs.writeFileSync(testEpubFile, 'test', 'utf-8');
        fs.unlinkSync(testEpubFile);
        checks.push({
          name: 'EPUB 临时写权限',
          passed: true,
          message: `EPUB 转换临时目录可写 (${tempDir})`
        });
      } catch (err) {
        checks.push({
          name: 'EPUB 临时写权限',
          passed: false,
          message: `EPUB 临时目录不可写: ${(err as Error).message}`
        });
      }

      // 5. Recent Job Status
      const recent = listRecentJobs(1);
      if (recent.length > 0) {
        const lastJob = recent[0];
        checks.push({
          name: '最近任务状态',
          passed: lastJob.status !== 'failed',
          message: `最近一次任务 [${lastJob.jobId}] 状态: ${lastJob.status} (${lastJob.updatedAt})`
        });
      } else {
        checks.push({
          name: '最近任务状态',
          passed: true,
          message: '无历史运行任务'
        });
      }

      // 6. Browser Automation Engine Check (Playwright / Chromium)
      try {
        const { chromium } = await import('playwright');
        const execPath = chromium.executablePath();
        if (fs.existsSync(execPath)) {
          checks.push({
            name: '可选浏览器自动化',
            passed: true,
            message: `Chromium 浏览器组件就绪 (${execPath})`
          });
        } else {
          checks.push({
            name: '可选浏览器自动化',
            passed: true,
            message: 'Chromium 未安装；不影响图示人工引导与日常发送'
          });
        }
      } catch (err) {
        checks.push({
          name: '可选浏览器自动化',
          passed: true,
          message: `浏览器自动化不可用；不影响图示人工引导与日常发送 (${(err as Error).message})`
        });
      }

      const allPassed = checks.every(c => c.passed);
      const output: MachineOutput<{ checks: DoctorCheckItem[] }> = {
        ok: allPassed,
        status: allPassed ? 'validated' : 'failed',
        message: allPassed ? '所有环境诊断项均已通过' : '存在未通过的环境诊断项，请按指引修复',
        data: { checks }
      };

      if (isJson) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        logger.info('🏥 Kindle for Agents 环境诊断:');
        checks.forEach(c => {
          const symbol = c.passed ? '✅' : '❌';
          logger.info(`  ${symbol} [${c.name}] ${c.message}`);
        });
      }

      if (!allPassed) {
        process.exit(1);
      }
    });
}
