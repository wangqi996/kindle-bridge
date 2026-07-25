import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { Writable } from 'stream';
import { Command } from 'commander';
import { saveConfig } from '../../core/config';
import {
  saveCredentials,
  CredentialStore,
  getCredentialStorageDescription,
  ensureCredentialStorageSupported
} from '../../core/credentials';
import { logger, maskEmail } from '../../core/logger';
import { launchAmazonWizard } from '../../wizard/browser';
import { openInSystemBrowser } from '../../wizard/external-browser';
import { launchMacSetupTerminal } from '../../wizard/terminal';
import { EmailTransport } from '../../transport/email';
import { createJob, updateJobStatus } from '../../core/tracker';
import { buildEpub } from '../../converter/epub-builder';
import { validateEpub } from '../../converter/validator';
import { MachineOutput, ExitCodes, KindleErrorCode } from '../../types';
import {
  AMAZON_REGION,
  getAmazonSettingsUrl,
  UnsupportedAmazonRegionError
} from '../../core/amazon';

export function registerConnectCommand(program: Command) {
  program
    .command('connect')
    .alias('setup')
    .description('配置 Kindle 接收邮箱与 SMTP 发送通道（含测试投递）')
    .option('--region <region>', 'Amazon Kindle 账户站点（当前仅支持 amazon.com）', AMAZON_REGION)
    .option('--provider <provider>', '邮箱向导，目前支持 qq')
    .option('--smtp-host <host>', 'SMTP 服务器地址 (如 smtp.qq.com, smtp.gmail.com)')
    .option('--smtp-port <port>', 'SMTP 端口 (如 465, 587)', '587')
    .option('--smtp-user <user>', '发件邮箱账号 (如 user@qq.com)')
    .option('--kindle-email <email>', 'Kindle 接收邮箱 (如 username@kindle.com)')
    .option('--browser', '启动浏览器协助定位 Amazon Send-to-Kindle 设置', false)
    .option('--agent-assisted', 'Agent 已完成浏览器导航与设置核对', false)
    .option('--test-send-confirmed', '用户已在 Agent 对话中明确同意发送测试书', false)
    .option('--open-terminal', 'macOS：在可见 Terminal 窗口中打开授权码安全输入', false)
    .action(async (options: {
      region?: string;
      provider?: string;
      smtpHost?: string;
      smtpPort?: string;
      smtpUser?: string;
      kindleEmail?: string;
      agentAssisted?: boolean;
      testSendConfirmed?: boolean;
      browser?: boolean;
      openTerminal?: boolean;
    }) => {
      const globalOpts = program.opts();
      const isJson = !!globalOpts.json;
      logger.setDebug(!!globalOpts.debug);

      const askQuestion = (query: string): Promise<string> => {
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
      };

      const askSecret = (query: string): Promise<string> => {
        return new Promise(resolve => {
          let muted = false;
          const hiddenOutput = new Writable({
            write(chunk, _encoding, callback) {
              if (!muted) {
                process.stdout.write(chunk);
              }
              callback();
            }
          });
          const rl = readline.createInterface({
            input: process.stdin,
            output: hiddenOutput,
            terminal: true
          });
          process.stdout.write(query);
          muted = true;
          rl.question('', answer => {
            muted = false;
            rl.close();
            process.stdout.write('\n');
            resolve(answer.trim());
          });
        });
      };

      let testEpubPath: string | undefined;

      try {
        if (options.openTerminal) {
          if (
            !options.agentAssisted
            || !options.testSendConfirmed
            || options.provider?.toLowerCase() !== 'qq'
            || !options.smtpUser
            || !options.kindleEmail
          ) {
            throw new Error(
              '--open-terminal 必须与 --provider qq、--agent-assisted、--test-send-confirmed、--smtp-user 和 --kindle-email 一起使用'
            );
          }
          launchMacSetupTerminal({
            smtpUser: options.smtpUser,
            kindleEmail: options.kindleEmail,
            region: options.region
          });
          outputResult({
            ok: true,
            message: '已打开 macOS Terminal 安全输入窗口。授权码只能粘贴到该窗口，绝不能发送到聊天。'
          }, isJson);
          return;
        }

        ensureCredentialStorageSupported();
        const amazonRegion = (options.region || AMAZON_REGION).toLowerCase();
        const amazonSettingsUrl = getAmazonSettingsUrl(amazonRegion);

        if (options.testSendConfirmed && !options.agentAssisted) {
          throw new Error('--test-send-confirmed 只能与 --agent-assisted 一起使用');
        }
        if (process.platform === 'darwin' && options.agentAssisted && !process.stdin.isTTY) {
          throw new Error(
            'macOS Agent 辅助配置需要可见安全终端。请使用 --open-terminal 重新启动；绝不能在聊天中索要或发送授权码'
          );
        }

        let discoveredKindleEmail: string | undefined = undefined;

        // Option 1: Browser Wizard
        if (options.browser) {
          logger.info('正在打开浏览器引导页面...');
          const wizard = await launchAmazonWizard(options.region);
          logger.info('\n💡 [自动化提示] 请在打开的浏览器窗口中登录您的 Amazon 账号。');
          logger.info('   完成登录后，程序会尝试识别 Kindle 邮箱；页面设置仍需由您核对。');

          const discovered = await wizard.autoDiscover(options.smtpUser);
          if (discovered.kindleEmail) {
            discoveredKindleEmail = discovered.kindleEmail;
          }
          await wizard.close();
        }

        // Collect Credentials interactively if missing from flags
        let kindleEmail = options.kindleEmail
          || process.env.KINDLE_BRIDGE_KINDLE_EMAIL
          || discoveredKindleEmail;
        let smtpHost = options.smtpHost;
        let smtpPort = options.smtpPort ? parseInt(options.smtpPort, 10) : 587;
        let smtpUser = options.smtpUser || process.env.KINDLE_BRIDGE_SMTP_USER;
        let smtpPass: string | undefined;

        if (!isJson && options.provider?.toLowerCase() === 'qq') {
          logger.info('\n📮 QQ 邮箱连接向导');
          logger.info(`授权码只会保存在这台电脑的${getCredentialStorageDescription()}中。`);

          if (!smtpUser) {
            smtpUser = await askQuestion('1. 请输入你的 QQ 邮箱地址（例如 123456@qq.com）: ');
          }
          if (!smtpUser.toLowerCase().endsWith('@qq.com')) {
            throw new Error('QQ 向导需要使用 @qq.com 邮箱地址');
          }

          smtpHost = 'smtp.qq.com';
          smtpPort = 465;

          if (!options.agentAssisted) {
            const qqMailUrl = 'https://mail.qq.com/';
            logger.info('\n2. 正在用系统默认浏览器打开 QQ 邮箱。');
            logger.info(`   如果浏览器没有自动打开，请访问: ${qqMailUrl}`);
            logger.info('   登录后依次查找：右上角“设置” → 左下“账号与安全” → “安全设置” → POP3/IMAP/SMTP/Exchange/CardDAV 服务。');
            logger.info('   开启服务，完成安全验证并复制生成的 16 位授权码。');
            openInSystemBrowser(qqMailUrl);
          } else {
            logger.info('\n浏览器设置已由 Agent 核对完成。');
          }
          smtpPass = await askSecret(
            options.agentAssisted
              ? '请粘贴刚刚复制的 QQ 授权码（输入不会显示）: '
              : '3. 生成授权码后直接粘贴到这里（不会显示，也不要发送到聊天中）: '
          );
          if (!/^[A-Za-z0-9]{16}$/.test(smtpPass)) {
            throw new Error('QQ 邮箱授权码应为 16 位字符；请勿输入 QQ 密码或留空');
          }

          if (!options.agentAssisted) {
            logger.info('\n4. 正在用系统默认浏览器打开 Amazon“管理我的内容和设备”。');
            logger.info(`   如果浏览器没有自动打开，请访问: ${amazonSettingsUrl}`);
            logger.info('   在 “Manage Your Content and Devices” 页面点击右侧英文标签 “Preferences”。');
            logger.info('   展开 “Personal Document Settings”。');
            logger.info('   在 “Send-to-Kindle E-Mail Settings” 中找到你的 Kindle 接收地址。');
            logger.info(`   在 “Approved Personal Document E-mail List” 中添加 ${maskEmail(smtpUser)}。`);
            openInSystemBrowser(amazonSettingsUrl);
          }

          if (!kindleEmail) {
            kindleEmail = await askQuestion('5. 请粘贴你在 Amazon 页面看到的 Kindle 接收邮箱: ');
          }
          const approved = options.agentAssisted
            ? 'yes'
            : (await askQuestion('6. 是否已经把上面的 QQ 邮箱加入 Amazon 认可列表？请输入 yes 确认: ')).toLowerCase();
          if (approved !== 'yes') {
            const cancelledOutput: MachineOutput = {
              ok: false,
              status: 'failed',
              error: {
                code: KindleErrorCode.INVALID_PARAMS,
                message: '尚未完成 Amazon 认可发件人设置，未保存凭据，也未发送邮件'
              }
            };
            outputResult(cancelledOutput, false);
            process.exitCode = ExitCodes[KindleErrorCode.INVALID_PARAMS];
            return;
          }
        } else if (!isJson && (!kindleEmail || !smtpUser || !smtpPass)) {
          logger.info('\n📝 请填写连接与发送配置 (输入后按回车确认):');
          if (!kindleEmail) {
            kindleEmail = await askQuestion('1. 请输入您的 Kindle 接收邮箱 (例如 xxxx@kindle.com): ');
          }
          if (!smtpUser) {
            smtpUser = await askQuestion('2. 请输入您的发件邮箱地址 (例如 user@qq.com / user@gmail.com): ');
          }
          if (!smtpPass) {
            smtpPass = await askSecret('3. 请输入发件邮箱的 SMTP 授权码（输入内容不会显示）: ');
          }
          if (!smtpHost) {
            if (smtpUser.includes('@qq.com')) {
              smtpHost = 'smtp.qq.com';
              smtpPort = 465;
            } else if (smtpUser.includes('@163.com')) {
              smtpHost = 'smtp.163.com';
              smtpPort = 465;
            } else if (smtpUser.includes('@gmail.com')) {
              smtpHost = 'smtp.gmail.com';
              smtpPort = 587;
            } else if (smtpUser.includes('@outlook.com') || smtpUser.includes('@hotmail.com')) {
              smtpHost = 'smtp-mail.outlook.com';
              smtpPort = 587;
            } else {
              smtpHost = await askQuestion('4. 请输入 SMTP 服务器地址 (如 smtp.example.com): ');
            }
          }
        }

        if (!kindleEmail || !smtpUser || !smtpPass || !smtpHost) {
          const errOutput: MachineOutput = {
            ok: false,
            status: 'failed',
            error: {
              code: KindleErrorCode.INVALID_PARAMS,
              message: '必需的连接参数缺失 (Kindle 接收邮箱、发件邮箱及 SMTP 授权密码)'
            }
          };
          outputResult(errOutput, isJson);
          process.exitCode = ExitCodes[KindleErrorCode.INVALID_PARAMS];
          return;
        }

        if (!isJson) {
          logger.info('\n发送前确认：');
          logger.info(`  Kindle 接收邮箱: ${maskEmail(kindleEmail)}`);
          logger.info(`  发件邮箱: ${maskEmail(smtpUser)}`);
          logger.info(`  SMTP 服务: ${smtpHost}:${smtpPort}`);
          logger.info('  请确认发件邮箱已加入 Amazon“已认可的个人文档发件人列表”。');
          const confirmation = options.testSendConfirmed
            ? 'yes'
            : (await askQuestion('确认现在发送一本测试书？请输入 yes 继续，其他内容取消: ')).toLowerCase();
          if (confirmation !== 'yes') {
            const cancelledOutput: MachineOutput = {
              ok: false,
              status: 'failed',
              error: {
                code: KindleErrorCode.INVALID_PARAMS,
                message: '用户取消了测试发送，未保存凭据，也未发送邮件'
              }
            };
            outputResult(cancelledOutput, false);
            process.exitCode = ExitCodes[KindleErrorCode.INVALID_PARAMS];
            return;
          }
        }

        const creds: CredentialStore = {
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          kindleEmail
        };

        // Test Delivery Process with Sample Test EPUB
        logger.info('\n🧪 正在生成并发送无版权风险测试 EPUB 进行连通性校验...');
        const tempDir = path.join(process.cwd(), '.kindle-for-agents-temp');
        testEpubPath = path.join(tempDir, `test_connection_${Date.now()}.epub`);

        const testDoc = {
          title: 'Kindle for Agents 首次连接测试书',
          author: 'Kindle for Agents Team',
          language: 'zh-CN',
          chapters: [
            {
              id: 'test_chap_1',
              title: '连接成功测试页',
              htmlContent: '<p>恭喜！Kindle for Agents 本地连接与邮件投递管道已成功跑通。</p>'
            }
          ]
        };

        await buildEpub(testDoc, testEpubPath);
        const valRes = await validateEpub(testEpubPath);

        if (!valRes.valid) {
          throw new Error('测试 EPUB 生成校验失败');
        }

        const job = createJob(testEpubPath, testDoc.title, testDoc.author, 'setup_test');
        const transport = new EmailTransport(creds);

        const deliveryRes = await transport.send({
          to: kindleEmail,
          subject: testDoc.title,
          text: 'Kindle for Agents connection test document.',
          attachments: [
            {
              filename: `${testDoc.title}.epub`,
              path: testEpubPath
            }
          ]
        });

        if (!deliveryRes.success) {
          updateJobStatus(job.jobId, 'failed', deliveryRes.error || '测试邮件投递失败', {
            error: {
              code: KindleErrorCode.DELIVERY_FAILED,
              message: deliveryRes.error || '测试邮件投递失败'
            }
          });
          const errOutput: MachineOutput = {
            ok: false,
            jobId: job.jobId,
            status: 'failed',
            error: {
              code: KindleErrorCode.DELIVERY_FAILED,
              message: `连接测试邮件投递失败: ${deliveryRes.error}。请核对发件邮箱授权码及 Amazon “已认可的发件人列表”设置。`
            }
          };
          outputResult(errOutput, isJson);
          process.exitCode = ExitCodes[KindleErrorCode.DELIVERY_FAILED];
          return;
        }

        updateJobStatus(job.jobId, 'provider_accepted', '测试邮件投递成功，已被邮件服务提供商接收');

        // Only persist credentials after the SMTP provider has accepted a real test message.
        saveConfig({
          amazonRegion,
          setupVersion: 1,
          provider: options.provider?.toLowerCase() === 'qq' ? 'qq' : undefined,
          kindleAddressMasked: maskEmail(kindleEmail),
          connectedAt: new Date().toISOString(),
          lastVerifiedAt: null,
          transport: 'smtp',
          capabilityState: 'awaiting_device_confirmation',
          deviceVerified: false
        });
        saveCredentials(creds);
        logger.info(`\n🔐 已通过${getCredentialStorageDescription()}安全保存发送配置。`);

        const successOutput: MachineOutput = {
          ok: true,
          jobId: job.jobId,
          status: 'provider_accepted',
          verified: false,
          message: `测试投递已被邮件服务商接收，但能力尚未部署完成。\n请在真实 Kindle 设备或 Kindle App 确认测试书《${testDoc.title}》出现，再运行 kindle confirm ${job.jobId}。`
        };

        outputResult(successOutput, isJson);

      } catch (error) {
        const message = (error as Error).message;
        const code = error instanceof UnsupportedAmazonRegionError
          ? KindleErrorCode.INVALID_PARAMS
          : KindleErrorCode.UNKNOWN;
        const errOutput: MachineOutput = {
          ok: false,
          status: 'failed',
          error: {
            code,
            message
          }
        };
        outputResult(errOutput, isJson);
        process.exitCode = ExitCodes[code];
      } finally {
        if (testEpubPath && fs.existsSync(testEpubPath)) {
          fs.unlinkSync(testEpubPath);
        }
      }
    });
}

function outputResult(result: MachineOutput, isJson: boolean) {
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.ok) {
      logger.info(`\n🎉 [成功] ${result.message}`);
      if (result.jobId) logger.info(`  Job ID: ${result.jobId}`);
      if (result.status) logger.info(`  当前状态: ${result.status}`);
      if (result.status === 'provider_accepted') {
        logger.info('  当前阶段: 等待 Kindle 设备确认；确认前不能视为能力部署完成');
      }
    } else {
      logger.error(`\n❌ [失败] (${result.error?.code}): ${result.error?.message}`);
    }
  }
}
