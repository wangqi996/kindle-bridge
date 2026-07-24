import path from 'path';
import { describe, it, expect } from 'vitest';
import { validateEpub } from '../src/converter/validator';

describe('EPUB Validator', () => {
  it('should return error for non-existent file', async () => {
    const res = await validateEpub(path.join(__dirname, 'non_existent.epub'));
    expect(res.valid).toBe(false);
    expect(res.issues[0].message).toContain('不存在');
  });
});
