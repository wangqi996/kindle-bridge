import { Command } from 'commander';
import { getJob, listRecentJobs } from '../../core/tracker';
import { logger } from '../../core/logger';
import { ExitCodes, KindleErrorCode, MachineOutput } from '../../types';

export function registerStatusCommand(program: Command) {
  program
    .command('status [jobId]')
    .alias('jobs')
    .description('查看任务投递状态或历史任务列表')
    .action(async (jobId?: string) => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      logger.setDebug(!!globalOpts.debug);

      if (jobId) {
        const job = getJob(jobId);
        if (!job) {
          const errOutput: MachineOutput = {
            ok: false,
            jobId,
            status: 'failed',
            error: {
              code: KindleErrorCode.INVALID_PARAMS,
              message: `未找到 Job ID 为 "${jobId}" 的任务`
            }
          };
          if (isJson) {
            console.log(JSON.stringify(errOutput, null, 2));
          } else {
            logger.error(errOutput.error!.message);
          }
          process.exit(ExitCodes[KindleErrorCode.INVALID_PARAMS]);
        }

        const output: MachineOutput = {
          ok: job.status !== 'failed',
          jobId: job.jobId,
          input: job.inputPath,
          output: job.outputPath,
          status: job.status,
          verified: job.verified,
          message: job.message,
          error: job.error
        };

        if (isJson) {
          console.log(JSON.stringify(output, null, 2));
        } else {
          logger.info(`📋 任务详情 [${job.jobId}]:`);
          logger.info(`  输入: ${job.inputPath}`);
          logger.info(`  状态: ${job.status}`);
          logger.info(`  说明: ${job.message}`);
          logger.info(`  创建时间: ${job.createdAt}`);
        }
      } else {
        const jobs = listRecentJobs(10);
        if (isJson) {
          console.log(JSON.stringify({ ok: true, jobs }, null, 2));
        } else {
          logger.info('📜 最近任务记录 (最新10条):');
          if (jobs.length === 0) {
            logger.info('  暂无任务历史记录。');
          } else {
            jobs.forEach(j => {
              logger.info(`  - [${j.jobId}] ${j.status.padEnd(16)} ${j.title || j.inputPath}`);
            });
          }
        }
      }
    });
}
