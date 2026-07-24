import { Command } from 'commander';
import { saveConfig } from '../../core/config';
import { getJob, listRecentJobs, updateJobStatus } from '../../core/tracker';
import { logger } from '../../core/logger';
import { ExitCodes, KindleErrorCode, MachineOutput } from '../../types';

export function registerConfirmCommand(program: Command) {
  program
    .command('confirm [jobId]')
    .description('确认 Kindle 设备端已经收到文档')
    .action(async (jobId?: string) => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      logger.setDebug(!!globalOpts.debug);

      const target = jobId
        ? getJob(jobId)
        : listRecentJobs(20).find(job =>
            !job.verified
            && (job.status === 'provider_accepted' || job.status === 'amazon_accepted')
          );

      if (!target) {
        const error: MachineOutput = {
          ok: false,
          status: 'failed',
          error: {
            code: KindleErrorCode.INVALID_PARAMS,
            message: jobId
              ? `未找到可确认的任务：${jobId}`
              : '没有等待设备确认的投递任务'
          }
        };
        outputResult(error, isJson);
        process.exitCode = ExitCodes[KindleErrorCode.INVALID_PARAMS];
        return;
      }

      const confirmedAt = new Date().toISOString();
      const confirmed = updateJobStatus(
        target.jobId,
        'device_confirmed',
        '用户已确认 Kindle 设备端收到文档',
        { verified: true }
      );
      saveConfig({ lastVerifiedAt: confirmedAt });

      const output: MachineOutput = {
        ok: true,
        jobId: confirmed.jobId,
        status: confirmed.status,
        verified: confirmed.verified,
        message: confirmed.message
      };
      outputResult(output, isJson);
    });
}

function outputResult(result: MachineOutput, isJson: boolean) {
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.ok) {
    logger.info(`✅ ${result.message}`);
    logger.info(`  Job ID: ${result.jobId}`);
    logger.info(`  当前状态: ${result.status}`);
  } else {
    logger.error(`❌ ${result.error?.message}`);
  }
}
