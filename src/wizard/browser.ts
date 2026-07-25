import path from 'path';
import fs from 'fs';
import { chromium, BrowserContext } from 'playwright';
import { logger } from '../core/logger';
import { getAmazonSettingsUrl } from '../core/amazon';
import { getProductStateDir } from '../core/paths';

export function getBrowserProfileDir(): string {
  // Keep the historical storage key so the dedicated browser profile survives.
  const profileDir = path.join(getProductStateDir(), 'browser-profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  return profileDir;
}

export async function launchAmazonWizard(region: string = 'amazon.com'): Promise<{
  context: BrowserContext;
  autoDiscover: (smtpUserToApproved?: string) => Promise<{ kindleEmail?: string; approvedSenderAdded: boolean }>;
  close: () => Promise<void>;
}> {
  const userDataDir = getBrowserProfileDir();
  const amazonUrl = getAmazonSettingsUrl(region);

  logger.info(`🌐 启动 Kindle Connect 浏览器向导...`);
  logger.info(`  配置目录: ${userDataDir}`);
  logger.info(`  目标网址: ${amazonUrl}`);
  logger.info(`  ⚠️ 提示: 请在打开的浏览器界面中亲自完成 Amazon 登录与二次验证。程序不会收集或保存您的密码。`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await context.newPage();
  await page.goto(amazonUrl, { waitUntil: 'domcontentloaded' });

  const autoDiscover = async (smtpUserToApproved?: string): Promise<{ kindleEmail?: string; approvedSenderAdded: boolean }> => {
    let kindleEmail: string | undefined = undefined;
    let approvedSenderAdded = false;

    logger.info('🔍 正在监测 Amazon 页面，等待登录完成...');

    // 轮询等待登录并识别包含 @kindle.com / @kindle.cn 的页面内容
    const startTime = Date.now();
    const timeoutMs = 180000; // 最多等待 3 分钟

    while (Date.now() - startTime < timeoutMs) {
      try {
        const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
        const match = bodyText.match(/([a-zA-Z0-9._%+-]+@kindle\.(?:com|cn))/i);
        if (match && match[1]) {
          kindleEmail = match[1].toLowerCase();
          logger.info(`🎉 自动抓取到 Kindle 接收邮箱: ${kindleEmail}`);
          break;
        }
      } catch (err) {
        // 页面跳转中，忽略重试
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    // 如果指定了发件邮箱，且检测到已进入设置页，尝试自动点击“添加已认可电子邮箱”
    if (smtpUserToApproved) {
      try {
        const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
        if (!bodyText.includes(smtpUserToApproved)) {
          logger.info(`⚙️ 正在尝试为您自动添加发件邮箱 (${smtpUserToApproved}) 到 Amazon 许可列表...`);
          // 查找“添加新的已认可电子邮箱”按钮或链接
          const addLink = page.locator('text=/Add a new approved e-mail address|添加新的已认可电子邮箱/i').first();
          if (await addLink.isVisible({ timeout: 5000 })) {
            await addLink.click();
            await page.waitForTimeout(1000);
            const inputField = page.locator('input[type="text"]').last();
            if (await inputField.isVisible({ timeout: 3000 })) {
              await inputField.fill(smtpUserToApproved);
              const saveBtn = page.locator('text=/Add Address|添加地址|保存/i').first();
              if (await saveBtn.isVisible({ timeout: 3000 })) {
                await saveBtn.click();
                approvedSenderAdded = true;
                logger.info(`✅ 已成功自动添加已认可发件人: ${smtpUserToApproved}`);
              }
            }
          }
        } else {
          approvedSenderAdded = true;
          logger.info(`ℹ️ 发件邮箱 (${smtpUserToApproved}) 已在 Amazon 许可列表中，无需重复添加。`);
        }
      } catch (err) {
        logger.warn(`⚠️ 自动添加发件邮箱时遇到阻碍，请在页面上手动添加: ${(err as Error).message}`);
      }
    }

    return { kindleEmail, approvedSenderAdded };
  };

  return {
    context,
    autoDiscover,
    close: async () => {
      await context.close();
    }
  };
}
