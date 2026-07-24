import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';

export interface ParsedChapter {
  id: string;
  title: string;
  htmlContent: string;
}

export interface ParsedDocument {
  title: string;
  author: string;
  language: string;
  chapters: ParsedChapter[];
  coverPath?: string;
  isEpubPassthrough?: boolean;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'code',
    'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br',
    'div', 'span', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'
  ],
  allowedAttributes: {
    'a': ['href', 'title'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    '*': ['id', 'class']
  },
  nonTextTags: ['script', 'style', 'iframe', 'noscript']
};

export async function parseInputFile(
  filePath: string,
  options?: { title?: string; author?: string; coverPath?: string; language?: string }
): Promise<ParsedDocument> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`输入文件不存在: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const fileBaseName = path.basename(filePath, ext);

  let defaultTitle = options?.title || fileBaseName;
  let defaultAuthor = options?.author || 'Unknown';
  let defaultLang = options?.language || 'zh-CN';

  if (ext === '.epub') {
    return {
      title: defaultTitle,
      author: defaultAuthor,
      language: defaultLang,
      chapters: [],
      coverPath: options?.coverPath,
      isEpubPassthrough: true
    };
  }

  const rawContent = fs.readFileSync(filePath, 'utf-8');
  let bodyHtml = '';

  if (ext === '.md' || ext === '.markdown') {
    bodyHtml = await marked.parse(rawContent);
  } else if (ext === '.txt') {
    const lines = rawContent.split(/\r?\n/);
    if (!options?.title && lines.length > 0 && lines[0].trim().length > 0) {
      defaultTitle = lines[0].trim().substring(0, 50);
    }
    bodyHtml = lines.map(line => line.trim() ? `<p>${escapeHtml(line)}</p>` : '').join('\n');
  } else if (ext === '.html' || ext === '.htm') {
    bodyHtml = rawContent;
  } else {
    throw new Error(`不支持的文件格式: ${ext}，请提供 .md, .txt, .html 或 .epub 文件。`);
  }

  // Clean HTML
  const cleanBodyHtml = sanitizeHtml(bodyHtml, SANITIZE_OPTIONS);

  // Split into chapters by <h1> or <h2> tags using cheerio
  const $ = cheerio.load(cleanBodyHtml, null, false);
  const chapters: ParsedChapter[] = [];

  const headers = $('h1, h2');
  if (headers.length > 0) {
    let currentChapterTitle = defaultTitle;
    let currentHtml = '';
    let chapterIndex = 1;

    $('body, div, p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre').each((_, elem) => {
      const tag = 'tagName' in elem ? (elem as { tagName: string }).tagName.toLowerCase() : '';
      if (tag === 'h1' || tag === 'h2') {
        if (currentHtml.trim()) {
          chapters.push({
            id: `chap_${chapterIndex++}`,
            title: currentChapterTitle,
            htmlContent: currentHtml
          });
        }
        currentChapterTitle = $(elem).text().trim() || `Chapter ${chapterIndex}`;
        currentHtml = $.html(elem);
      } else {
        currentHtml += $.html(elem);
      }
    });

    if (currentHtml.trim()) {
      chapters.push({
        id: `chap_${chapterIndex}`,
        title: currentChapterTitle,
        htmlContent: currentHtml
      });
    }
  }

  if (chapters.length === 0) {
    chapters.push({
      id: 'chap_1',
      title: defaultTitle,
      htmlContent: cleanBodyHtml
    });
  }

  return {
    title: defaultTitle,
    author: defaultAuthor,
    language: defaultLang,
    chapters,
    coverPath: options?.coverPath,
    isEpubPassthrough: false
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
