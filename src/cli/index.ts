#!/usr/bin/env node
import { Command } from 'commander';
import { registerConnectCommand } from './commands/connect';
import { registerSendCommand } from './commands/send';
import { registerStatusCommand } from './commands/status';
import { registerDoctorCommand } from './commands/doctor';
import { registerConfirmCommand } from './commands/confirm';
import { registerResetCommand } from './commands/reset';

const program = new Command();

program
  .name('kindle')
  .description('Kindle Bridge - 本地优先的 Kindle 内容投递 CLI 工具')
  .version('0.1.0')
  .option('--json', '以机器可读的 JSON 格式输出结果', false)
  .option('--debug', '开启调试模式输出详细脱敏日志', false);

registerConnectCommand(program);
registerSendCommand(program);
registerStatusCommand(program);
registerDoctorCommand(program);
registerConfirmCommand(program);
registerResetCommand(program);

program.parse(process.argv);
