ALTER TABLE subscription_plans ALTER COLUMN currency SET DEFAULT 'KWD';

UPDATE subscription_plans
SET currency = 'KWD', duration_months = 1, updated_at = now()
WHERE slug IN ('basic', 'premium');
