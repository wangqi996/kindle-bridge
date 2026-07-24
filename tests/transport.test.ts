import { describe, it, expect } from 'vitest';
import { EmailTransport } from '../src/transport/email';

describe('Email Transport Layer', () => {
  it('should instantiate and reject unconfigured transport safely', async () => {
    const transport = new EmailTransport({});
    const res = await transport.send({
      to: 'test@kindle.com',
      subject: 'Test Subject',
      attachments: []
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('未检测到有效的 SMTP');
  });
});
