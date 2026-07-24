import fs from 'fs';
import JSZip from 'jszip';
import { ValidationIssue, ValidationResult } from '../types';

export async function validateEpub(epubFilePath: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  if (!fs.existsSync(epubFilePath)) {
    return {
      valid: false,
      issues: [{ severity: 'error', message: `EPUB 文件不存在: ${epubFilePath}` }]
    };
  }

  try {
    const data = fs.readFileSync(epubFilePath);
    const zip = await JSZip.loadAsync(data);

    // 1. Check mimetype file
    const mimetypeFile = zip.file('mimetype');
    if (!mimetypeFile) {
      issues.push({ severity: 'error', message: '缺少 mimetype 文件' });
    } else {
      const mimeText = (await mimetypeFile.async('string')).trim();
      if (mimeText !== 'application/epub+zip') {
        issues.push({ severity: 'error', message: `mimetype 内容无效: "${mimeText}"，应为 "application/epub+zip"` });
      }
    }

    // 2. Check META-INF/container.xml
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) {
      issues.push({ severity: 'error', message: '缺少 META-INF/container.xml 文件' });
    } else {
      const containerText = await containerFile.async('string');
      if (!containerText.includes('full-path="OEBPS/content.opf"') && !containerText.includes('full-path=')) {
        issues.push({ severity: 'error', message: 'META-INF/container.xml 中未包含有效 rootfile 路径' });
      }
    }

    // 3. Check OEBPS/content.opf
    const opfFile = zip.file('OEBPS/content.opf') || zip.file('content.opf');
    if (!opfFile) {
      issues.push({ severity: 'error', message: '缺少 OPF 包定义文件' });
    } else {
      const opfText = await opfFile.async('string');
      if (!opfText.includes('<dc:language>') && !opfText.includes('<dc:language ')) {
        issues.push({ severity: 'error', message: 'OPF 元数据中缺少语言标记 <dc:language>' });
      }
      if (!opfText.includes('<dc:title>') && !opfText.includes('<dc:title ')) {
        issues.push({ severity: 'error', message: 'OPF 元数据中缺少标题标记 <dc:title>' });
      }
      if (!opfText.includes('<manifest>') || !opfText.includes('<spine')) {
        issues.push({ severity: 'error', message: 'OPF 文件缺少 manifest 或 spine 节点' });
      }
    }
  } catch (err) {
    issues.push({
      severity: 'error',
      message: `EPUB 无法解压或包含坏块: ${(err as Error).message}`
    });
  }

  const hasError = issues.some(i => i.severity === 'error');
  return {
    valid: !hasError,
    issues
  };
}
