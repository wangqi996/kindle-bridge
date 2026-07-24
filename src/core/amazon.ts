export const AMAZON_REGION = 'amazon.com';
export const AMAZON_SETTINGS_URL = 'https://www.amazon.com/hz/mycd/myx';

export class UnsupportedAmazonRegionError extends Error {
  constructor(region: string) {
    super(`当前版本仅支持 Amazon.com Kindle 账户设置；不再使用 ${region} 的旧 Kindle 管理地址`);
    this.name = 'UnsupportedAmazonRegionError';
  }
}

export function getAmazonSettingsUrl(region: string = AMAZON_REGION): string {
  const normalizedRegion = region.trim().toLowerCase();
  if (normalizedRegion !== AMAZON_REGION) {
    throw new UnsupportedAmazonRegionError(region);
  }
  return AMAZON_SETTINGS_URL;
}
