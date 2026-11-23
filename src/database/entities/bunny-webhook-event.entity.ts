export interface BunnyWebhookEvent {
  eventId: string;
  videoGuid: string;
  status: number;
  eventTimestamp: Date;
  receivedAt: Date;
}
