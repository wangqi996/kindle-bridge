import fs from 'fs';
import path from 'path';
import { JobKind, JobRecord, JobStatus, KindleErrorCode } from '../types';
import { getProductStateDir } from './paths';

export function getJobsDir(): string {
  // Keep the historical storage key so existing job history survives the rename.
  const jobsDir = path.join(getProductStateDir(), 'jobs');
  if (!fs.existsSync(jobsDir)) {
    fs.mkdirSync(jobsDir, { recursive: true });
  }
  return jobsDir;
}

export function createJob(
  inputPath: string,
  title?: string,
  author?: string,
  kind: JobKind = 'delivery'
): JobRecord {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  const record: JobRecord = {
    jobId,
    kind,
    inputPath,
    title,
    author,
    status: 'created',
    verified: false,
    message: '任务已创建',
    createdAt: now,
    updatedAt: now
  };

  saveJob(record);
  return record;
}

export function saveJob(job: JobRecord): void {
  const filePath = path.join(getJobsDir(), `${job.jobId}.json`);
  job.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2), 'utf-8');
}

export function getJob(jobId: string): JobRecord | null {
  const filePath = path.join(getJobsDir(), `${jobId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as JobRecord;
  } catch (err) {
    return null;
  }
}

export function updateJobStatus(
  jobId: string,
  status: JobStatus,
  message: string,
  extra?: { outputPath?: string | null; error?: { code: KindleErrorCode; message: string }; verified?: boolean }
): JobRecord {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  job.status = status;
  job.message = message;
  if (extra?.outputPath === null) {
    delete job.outputPath;
  } else if (extra?.outputPath) {
    job.outputPath = extra.outputPath;
  }
  if (extra?.error) job.error = extra.error;
  if (typeof extra?.verified === 'boolean') job.verified = extra.verified;

  saveJob(job);
  return job;
}

export function listRecentJobs(limit: number = 10): JobRecord[] {
  const jobsDir = getJobsDir();
  const files = fs.readdirSync(jobsDir).filter(f => f.endsWith('.json'));

  const jobs: JobRecord[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(jobsDir, file), 'utf-8');
      jobs.push(JSON.parse(raw) as JobRecord);
    } catch (e) {
      // skip corrupted job files
    }
  }

  return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
}

export function clearJobs(): number {
  const jobsDir = getJobsDir();
  const files = fs.readdirSync(jobsDir).filter(file => file.endsWith('.json'));
  for (const file of files) {
    fs.unlinkSync(path.join(jobsDir, file));
  }
  return files.length;
}
