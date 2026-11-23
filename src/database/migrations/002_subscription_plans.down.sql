DROP INDEX IF EXISTS idx_subscriptions_plan;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS plan_id;
DROP TABLE IF EXISTS subscription_plan_features;
DROP TABLE IF EXISTS subscription_plans;
