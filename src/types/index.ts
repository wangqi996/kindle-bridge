export type JobStatus =
  | 'created'
  | 'converted'
  | 'validated'
  | 'submitted'
  | 'provider_accepted'
  | 'amazon_accepted'
  | 'amazon_rejected'
  | 'device_confirmed'
  | 'failed';

export type JobKind = 'setup_test' | 'delivery' | 'dry_run';

export type CapabilityState =
  | 'needs_setup'
  | 'awaiting_device_confirmation'
  | 'ready'
  | 'needs_reauth'
  | 'needs_repair';

export enum KindleErrorCode {
  INVALID_PARAMS = 'KINDLE_INVALID_PARAMS',
  CONFIG_MISSING = 'KINDLE_CONFIG_MISSING',
  CONFIG_INVALID = 'KINDLE_CONFIG_INVALID',
  CONVERSION_FAILED = 'KINDLE_CONVERSION_FAILED',
  EPUB_INVALID = 'KINDLE_EPUB_INVALID',
  DELIVERY_FAILED = 'KINDLE_DELIVERY_FAILED',
  AUTH_EXPIRED = 'KINDLE_AUTH_EXPIRED',
  TIMEOUT = 'KINDLE_TIMEOUT',
  UNKNOWN = 'KINDLE_UNKNOWN_ERROR'
}

export const ExitCodes: Record<KindleErrorCode, number> = {
  [KindleErrorCode.INVALID_PARAMS]: 2,
  [KindleErrorCode.CONFIG_MISSING]: 3,
  [KindleErrorCode.CONFIG_INVALID]: 3,
  [KindleErrorCode.CONVERSION_FAILED]: 4,
  [KindleErrorCode.EPUB_INVALID]: 5,
  [KindleErrorCode.DELIVERY_FAILED]: 6,
  [KindleErrorCode.AUTH_EXPIRED]: 7,
  [KindleErrorCode.TIMEOUT]: 8,
  [KindleErrorCode.UNKNOWN]: 1
};

export interface KindleConfig {
  version: number;
  setupVersion: number;
  amazonRegion: string;
  kindleAddressMasked?: string;
  transport: 'user-oauth' | 'smtp' | 'relay';
  provider?: 'qq';
  capabilityState: CapabilityState;
  deviceVerified: boolean;
  defaultAuthor: string;
  language: string;
  keepGeneratedEpub: boolean;
  connectedAt?: string;
  lastVerifiedAt?: string | null;
}

export interface ConvertOptions {
  inputPath: string;
  title?: string;
  author?: string;
  coverPath?: string;
  language?: string;
  keepEpub?: boolean;
  outputPath?: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface JobRecord {
  jobId: string;
  kind: JobKind;
  inputPath: string;
  outputPath?: string;
  title?: string;
  author?: string;
  status: JobStatus;
  verified: boolean;
  message: string;
  createdAt: string;
  updatedAt: string;
  error?: {
    code: KindleErrorCode;
    message: string;
  };
}

export interface CapabilityStatus {
  schemaVersion: 1;
  installed: true;
  state: CapabilityState;
  ready: boolean;
  provider?: string;
  credentialsAvailable: boolean;
  kindleAddressMasked?: string;
  deviceVerified: boolean;
  setupVersion: number;
  connectedAt?: string;
  lastVerifiedAt?: string | null;
  nextAction?: string;
}

export interface MachineOutput<T = unknown> {
  ok: boolean;
  jobId?: string;
  input?: string;
  output?: string;
  status?: JobStatus;
  verified?: boolean;
  message?: string;
  data?: T;
  error?: {
    code: KindleErrorCode;
    message: string;
  };
}
