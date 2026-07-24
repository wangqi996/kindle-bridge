import path from 'path';
import fs from 'fs';
import { describe, it, expect, afterAll } from 'vitest';
import { parseInputFile } from '../src/converter/parser';
import { buildEpub } from '../src/converter/epub-builder';
import { validateEpub } from '../src/converter/validator';

describe('Converter & EPUB Pipeline', () => {
  const sampleMdPath = path.resolve(__dirname, '../test-fixtures/sample.md');
  const tempEpubPath = path.resolve(__dirname, '../test-fixtures/output_test.epub');

  afterAll(() => {
    if (fs.existsSync(tempEpubPath)) {
      fs.unlinkSync(tempEpubPath);
    }
  });

  it('should parse markdown file into structured document and chapters', async () => {
    const doc = await parseInputFile(sampleMdPath, {
      title: 'Kindle Bridge 测试样本',
      author: '测试作者',
      language: 'zh-CN'
    });

    expect(doc.title).toBe('Kindle Bridge 测试样本');
    expect(doc.author).toBe('测试作者');
    expect(doc.language).toBe('zh-CN');
    expect(doc.chapters.length).toBeGreaterThan(0);
  });

  it('should build a valid EPUB file and pass structure validation', async () => {
    const doc = await parseInputFile(sampleMdPath, {
      title: 'Kindle Bridge 测试样本',
      author: '测试作者',
      language: 'zh-CN'
    });

    await buildEpub(doc, tempEpubPath);
    expect(fs.existsSync(tempEpubPath)).toBe(true);

    const valResult = await validateEpub(tempEpubPath);
    expect(valResult.valid).toBe(true);
    expect(valResult.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });
});
