ALTER TABLE subscription_plans ALTER COLUMN currency SET DEFAULT 'JOD';

UPDATE subscription_plans
SET currency = 'JOD', duration_months = 3, updated_at = now()
WHERE slug IN ('basic', 'premium');
