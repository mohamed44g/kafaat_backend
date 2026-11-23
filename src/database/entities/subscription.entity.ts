export enum SubscriptionStatus {
  Active = 'active',
  Expired = 'expired',
  Canceled = 'canceled',
}
export enum SubscriptionProvider {
  Mada = 'mada',
  ApplePay = 'apple_pay',
  StcPay = 'stc_pay',
  Card = 'card',
}
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startsAt: Date;
  endAt: Date;
  provider: SubscriptionProvider;
  createdAt: Date;
}
