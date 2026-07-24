import { describe, expect, it } from 'vitest';
import {
  AMAZON_SETTINGS_URL,
  getAmazonSettingsUrl
} from '../src/core/amazon';

describe('Amazon Kindle settings URL', () => {
  it('uses the stable Amazon.com content and devices entry', () => {
    expect(getAmazonSettingsUrl()).toBe('https://www.amazon.com/hz/mycd/myx');
    expect(getAmazonSettingsUrl('AMAZON.COM')).toBe(AMAZON_SETTINGS_URL);
  });

  it('rejects the discontinued Amazon.cn Kindle management route', () => {
    expect(() => getAmazonSettingsUrl('amazon.cn')).toThrow(
      '当前版本仅支持 Amazon.com'
    );
  });
});
