export enum StreamStatus {
  NotUploaded = 'not_uploaded',
  Uploading = 'uploading',
  Processing = 'processing',
  Ready = 'ready',
  Failed = 'failed',
  Deleted = 'deleted',
}

export interface BunnyVideo {
  guid: string;
  title: string;
  length: number;
  status: number;
  encodeProgress: number;
  thumbnailUrl?: string | null;
}

export interface BunnyUploadCredentials {
  endpoint: string;
  videoId: string;
  libraryId: string;
  expirationTime: number;
  signature: string;
}
