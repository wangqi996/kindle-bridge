import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJob, getJob, updateJobStatus } from '../src/core/tracker';

describe('Job tracker output lifecycle', () => {
  const originalLocalAppData = process.env.LOCALAPPDATA;
  let tempLocalAppData = '';

  beforeEach(() => {
    tempLocalAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-bridge-jobs-'));
    process.env.LOCALAPPDATA = tempLocalAppData;
  });

  afterEach(() => {
    process.env.LOCALAPPDATA = originalLocalAppData;
    fs.rmSync(tempLocalAppData, { recursive: true, force: true });
  });

  it('removes a stale output path after a temporary EPUB is cleaned up', () => {
    const job = createJob('sample.md');
    updateJobStatus(job.jobId, 'validated', 'validated', { outputPath: 'temporary.epub' });
    updateJobStatus(job.jobId, 'validated', 'cleaned', { outputPath: null });

    expect(getJob(job.jobId)?.outputPath).toBeUndefined();
  });
});
