export interface DeliveryAttachment {
  filename: string;
  path: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments: DeliveryAttachment[];
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerAcceptedTime?: string;
}

export interface Transport {
  send(options: SendEmailOptions): Promise<DeliveryResult>;
  verify(): Promise<boolean>;
}
