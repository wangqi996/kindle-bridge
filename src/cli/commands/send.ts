import path from 'path';
import fs from 'fs';
import { Command } from 'commander';
import { loadConfig } from '../../core/config';
import { loadCredentials } from '../../core/credentials';
import { createJob, updateJobStatus } from '../../core/tracker';
import { parseInputFile } from '../../converter/parser';
import { buildEpub } from '../../converter/epub-builder';
import { validateEpub } from '../../converter/validator';
import { EmailTransport } from '../../transport/email';
import { logger } from '../../core/logger';
import { ExitCodes, KindleErrorCode, MachineOutput } from '../../types';

export function registerSendCommand(program: Command) {
  program
    .command('send <file>')
    .description('转换并发送本地文档到 Kindle')
    .option('--title <title>', '设置文档标题')
    .option('--author <author>', '设置作者名称')
    .option('--cover <path>', '设置封面图片路径')
    .option('--keep-epub', '保留生成的临时 EPUB 文件', false)
    .option('--dry-run', '仅执行解析、转换与 EPUB 校验，不实际发送', false)
    .option('--timeout <seconds>', '设置发送超时时间（秒）', '60')
    .action(async (filePath: string, options: {
      title?: string;
      author?: string;
      cover?: string;
      keepEpub?: boolean;
      dryRun?: boolean;
      timeout?: string;
    }) => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      logger.setDebug(!!globalOpts.debug);

      const absoluteInputPath = path.resolve(process.cwd(), filePath);
      const job = createJob(absoluteInputPath, options.title, options.author);

      try {
        if (!fs.existsSync(absoluteInputPath)) {
          const errOutput: MachineOutput = {
            ok: false,
            jobId: job.jobId,
            input: absoluteInputPath,
            status: 'failed',
            error: {
              code: KindleErrorCode.INVALID_PARAMS,
              message: `输入文件不存在: ${absoluteInputPath}`
            }
          };
          updateJobStatus(job.jobId, 'failed', errOutput.error!.message, { error: errOutput.error });
          outputResult(errOutput, isJson);
          process.exit(ExitCodes[KindleErrorCode.INVALID_PARAMS]);
        }

        const config = loadConfig();
        const creds = loadCredentials();

        if (!options.dryRun && (!creds || !creds.kindleEmail || !creds.smtpUser)) {
          const errOutput: MachineOutput = {
            ok: false,
            jobId: job.jobId,
            input: absoluteInputPath,
            status: 'failed',
            error: {
              code: KindleErrorCode.CONFIG_MISSING,
              message: '未发现配置的 Send-to-Kindle 接收邮箱或发送凭据。请先运行 kindle connect 完成连接。'
            }
          };
          updateJobStatus(job.jobId, 'failed', errOutput.error!.message, { error: errOutput.error });
          outputResult(errOutput, isJson);
          process.exit(ExitCodes[KindleErrorCode.CONFIG_MISSING]);
        }

        const author = options.author || config.defaultAuthor;
        const lang = config.language || 'zh-CN';

        // 1. Parsing Input Document
        const doc = await parseInputFile(absoluteInputPath, {
          title: options.title,
          author,
          coverPath: options.cover,
          language: lang
        });

        // 2. Generating EPUB
        let targetEpubPath = absoluteInputPath;
        if (!doc.isEpubPassthrough) {
          const tempDir = path.join(process.cwd(), '.kindle-bridge-temp');
          const ext = path.extname(absoluteInputPath);
          const baseName = path.basename(absoluteInputPath, ext);
          targetEpubPath = path.join(tempDir, `${baseName}_${job.jobId}.epub`);

          await buildEpub(doc, targetEpubPath);
          updateJobStatus(job.jobId, 'converted', 'EPUB 转换成功', { outputPath: targetEpubPath });
        }

        // 3. Validating EPUB
        const valResult = await validateEpub(targetEpubPath);
        if (!valResult.valid) {
          const firstError = valResult.issues.find(i => i.severity === 'error')?.message || 'EPUB 结构不合规';
          const errOutput: MachineOutput = {
            ok: false,
            jobId: job.jobId,
            input: absoluteInputPath,
            output: targetEpubPath,
            status: 'failed',
            error: {
              code: KindleErrorCode.EPUB_INVALID,
              message: `EPUB 验证失败: ${firstError}`
            }
          };
          updateJobStatus(job.jobId, 'failed', errOutput.error!.message, { error: errOutput.error });
          outputResult(errOutput, isJson);
          process.exit(ExitCodes[KindleErrorCode.EPUB_INVALID]);
        }

        updateJobStatus(job.jobId, 'validated', 'EPUB 结构有效性检验通过', { outputPath: targetEpubPath });

        // If dry-run, stop after validation
        if (options.dryRun) {
          let retainedOutput: string | undefined = targetEpubPath;
          if (!options.keepEpub && !doc.isEpubPassthrough && fs.existsSync(targetEpubPath)) {
            fs.unlinkSync(targetEpubPath);
            retainedOutput = undefined;
            updateJobStatus(job.jobId, 'validated', 'EPUB 结构校验通过；临时文件已按默认设置清理', {
              outputPath: null
            });
          }

          const successOutput: MachineOutput = {
            ok: true,
            jobId: job.jobId,
            input: absoluteInputPath,
            output: retainedOutput,
            status: 'validated',
            verified: false,
            message: '[Dry-run] 转换与 EPUB 校验成功，未进行实际发送'
          };
          outputResult(successOutput, isJson);
          return;
        }

        // 4. Executing Delivery Transport
        updateJobStatus(job.jobId, 'submitted', '正在通过邮件服务提交文档到 Send-to-Kindle...');
        const transport = new EmailTransport(creds!);

        const deliveryRes = await transport.send({
          to: creds!.kindleEmail!,
          subject: doc.title,
          text: `Delivered via Kindle Bridge (${doc.title})`,
          attachments: [
            {
              filename: `${doc.title}.epub`,
              path: targetEpubPath
            }
          ]
        });

        if (!deliveryRes.success) {
          const errOutput: MachineOutput = {
            ok: false,
            jobId: job.jobId,
            input: absoluteInputPath,
            output: targetEpubPath,
            status: 'failed',
            error: {
              code: KindleErrorCode.DELIVERY_FAILED,
              message: `投递失败: ${deliveryRes.error}`
            }
          };
          updateJobStatus(job.jobId, 'failed', errOutput.error!.message, { error: errOutput.error });
          outputResult(errOutput, isJson);
          process.exit(ExitCodes[KindleErrorCode.DELIVERY_FAILED]);
        }

        updateJobStatus(job.jobId, 'provider_accepted', '邮件服务商已接受请求，尚未确认 Amazon 或设备端接收');

        let retainedOutput: string | undefined = targetEpubPath;
        if (!options.keepEpub && !doc.isEpubPassthrough && fs.existsSync(targetEpubPath)) {
          fs.unlinkSync(targetEpubPath);
          retainedOutput = undefined;
          updateJobStatus(job.jobId, 'provider_accepted', '邮件服务商已接受请求；临时 EPUB 已清理，尚未确认设备端接收', {
            outputPath: null
          });
        }

        const successOutput: MachineOutput = {
          ok: true,
          jobId: job.jobId,
          input: absoluteInputPath,
          output: retainedOutput,
          status: 'provider_accepted',
          verified: false,
          message: '邮件投递成功提交，已被邮件服务提供商接收。请在 Kindle 设备端确认接收。'
        };

        outputResult(successOutput, isJson);

      } catch (error) {
        const message = (error as Error).message;
        const errOutput: MachineOutput = {
          ok: false,
          jobId: job.jobId,
          input: absoluteInputPath,
          status: 'failed',
          error: {
            code: KindleErrorCode.CONVERSION_FAILED,
            message
          }
        };
        updateJobStatus(job.jobId, 'failed', message, { error: errOutput.error });
        outputResult(errOutput, isJson);
        process.exit(ExitCodes[KindleErrorCode.CONVERSION_FAILED]);
      }
    });
}

function outputResult(result: MachineOutput, isJson: boolean) {
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.ok) {
      logger.info(`✅ [成功] ${result.message}`);
      logger.info(`  Job ID: ${result.jobId}`);
      if (result.output) logger.info(`  EPUB: ${result.output}`);
      logger.info(`  当前状态: ${result.status}`);
    } else {
      logger.error(`❌ [错误] (${result.error?.code}): ${result.error?.message}`);
      logger.error(`  Job ID: ${result.jobId}`);
      logger.error(`  当前状态: ${result.status}`);
    }
  }
}
