-- Apply once to an existing schoolhealth_demo database before deploying the API.
BEGIN;
ALTER TABLE schoolhealth_demo.checkup_results
    ADD COLUMN IF NOT EXISTS bmi numeric(16, 6),
    ADD COLUMN IF NOT EXISTS vision text,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE schoolhealth_demo.checkup_results
    DROP CONSTRAINT IF EXISTS checkup_results_status_check;
ALTER TABLE schoolhealth_demo.checkup_results
    ADD CONSTRAINT checkup_results_status_check
    CHECK (status IN ('completed', 'follow_up', 'pending', 'absent', 'Normal', 'Needs Follow-up'));

UPDATE schoolhealth_demo.checkup_results
SET bmi = round(weight_kg / power(height_cm / 100, 2), 6), updated_at = now()
WHERE bmi IS NULL AND height_cm > 0 AND weight_kg > 0;
COMMIT;
