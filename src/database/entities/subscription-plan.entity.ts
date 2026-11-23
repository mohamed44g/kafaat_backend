export interface SubscriptionPlanFeature {
  id: string;
  planId: string;
  featureKey: string;
  label: string;
  createdAt: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  durationMonths: number;
  isActive: boolean;
  features: SubscriptionPlanFeature[];
  createdAt: Date;
  updatedAt: Date;
}
