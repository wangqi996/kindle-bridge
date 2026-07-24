import { Command } from 'commander';
import { getCapabilityStatus } from '../../core/capability';
import { logger } from '../../core/logger';

export function registerCapabilityCommand(program: Command) {
  program
    .command('capability')
    .description('查看 Kindle 投送能力是否已经完整部署')
    .action(() => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      const status = getCapabilityStatus();

      if (isJson) {
        console.log(JSON.stringify({ ok: true, data: status }, null, 2));
        return;
      }

      logger.info(`Kindle 投送能力: ${status.state}`);
      logger.info(`  可直接调用: ${status.ready ? '是' : '否'}`);
      logger.info(`  凭据可用: ${status.credentialsAvailable ? '是' : '否'}`);
      logger.info(`  设备验证: ${status.deviceVerified ? '已通过' : '未完成'}`);
      if (status.kindleAddressMasked) logger.info(`  Kindle 邮箱: ${status.kindleAddressMasked}`);
      if (status.nextAction) logger.info(`  下一步: ${status.nextAction}`);
    });
}
