import readline from 'readline';
import { Command } from 'commander';
import { clearConfig, getConfigPath } from '../../core/config';
import { clearCredentials, getCredentialsPath } from '../../core/credentials';
import { clearJobs, getJobsDir } from '../../core/tracker';
import { logger } from '../../core/logger';
import { ExitCodes, KindleErrorCode, MachineOutput } from '../../types';

export function registerResetCommand(program: Command) {
  program
    .command('reset')
    .description('清除本机 Kindle for Agents 连接配置、凭据和任务历史')
    .option('--yes', '确认执行清除，适用于用户已在 Agent 对话中明确同意', false)
    .action(async (options: { yes?: boolean }) => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      logger.setDebug(!!globalOpts.debug);

      let confirmed = !!options.yes;
      if (!confirmed && !isJson) {
        logger.info('将清除以下本机数据：');
        logger.info(`  配置: ${getConfigPath()}`);
        logger.info(`  加密凭据: ${getCredentialsPath()}`);
        logger.info(`  任务历史: ${getJobsDir()}`);
        logger.info('不会删除项目源码，也不会撤销 QQ 邮箱服务器上的授权码。');
        confirmed = (await askQuestion('请输入 RESET 确认清除，其他内容取消: ')) === 'RESET';
      }

      if (!confirmed) {
        const cancelled: MachineOutput = {
          ok: false,
          error: {
            code: KindleErrorCode.INVALID_PARAMS,
            message: '未确认清除，本机数据保持不变'
          }
        };
        outputResult(cancelled, isJson);
        process.exitCode = ExitCodes[KindleErrorCode.INVALID_PARAMS];
        return;
      }

      clearCredentials();
      clearConfig();
      const clearedJobs = clearJobs();

      outputResult({
        ok: true,
        message: `本机 Kindle for Agents 状态已清除；删除了 ${clearedJobs} 条任务记录`
      }, isJson);
    });
}

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function outputResult(result: MachineOutput, isJson: boolean) {
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.ok) {
    logger.info(`✅ ${result.message}`);
  } else {
    logger.error(`❌ ${result.error?.message}`);
  }
}
