#!/usr/bin/env node
import { Command } from 'commander';
import { registerConnectCommand } from './commands/connect';
import { registerSendCommand } from './commands/send';
import { registerStatusCommand } from './commands/status';
import { registerDoctorCommand } from './commands/doctor';
import { registerConfirmCommand } from './commands/confirm';
import { registerResetCommand } from './commands/reset';
import { registerCapabilityCommand } from './commands/capability';
import packageJson from '../../package.json';

const program = new Command();

program
  .name('kindle')
  .description('Kindle for Agents - 面向 AI Agent 的本地优先 Kindle 投递能力')
  .version(packageJson.version)
  .option('--json', '以机器可读的 JSON 格式输出结果', false)
  .option('--debug', '开启调试模式输出详细脱敏日志', false);

registerConnectCommand(program);
registerSendCommand(program);
registerStatusCommand(program);
registerDoctorCommand(program);
registerConfirmCommand(program);
registerResetCommand(program);
registerCapabilityCommand(program);

program.parse(process.argv);
