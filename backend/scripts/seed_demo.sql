\set ON_ERROR_STOP on
\getenv demo_password SCHOOLHEALTH_DEMO_PASSWORD
\if :{?demo_password}
SELECT length(:'demo_password') >= 8
   AND octet_length(:'demo_password') <= 72 AS valid_password \gset
\else
\set valid_password false
\endif
\if :valid_password
\else
DO $$ BEGIN
    RAISE EXCEPTION 'Set a demo password with at least 8 characters and at most 72 bytes';
END $$;
\endif

BEGIN;
CREATE SCHEMA IF NOT EXISTS schoolhealth_demo;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET LOCAL search_path = schoolhealth_demo, public;

CREATE TABLE IF NOT EXISTS students (
    id text PRIMARY KEY,
    full_name text NOT NULL,
    class_name text NOT NULL
);

CREATE TABLE IF NOT EXISTS health_profiles (
    student_id text PRIMARY KEY REFERENCES students(id),
    allergies text,
    medical_notes text
);

CREATE TABLE IF NOT EXISTS accounts (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'nurse', 'parent')),
    password_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS parent_students (
    parent_id text REFERENCES accounts(id),
    student_id text REFERENCES students(id),
    PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS checkup_sessions (
    id text PRIMARY KEY,
    title text NOT NULL,
    checkup_date date NOT NULL
);

CREATE TABLE IF NOT EXISTS checkup_results (
    session_id text REFERENCES checkup_sessions(id),
    student_id text REFERENCES students(id),
    status text NOT NULL CHECK (status IN ('completed', 'follow_up', 'pending', 'absent', 'Normal', 'Needs Follow-up')),
    height_cm numeric(5, 1),
    weight_kg numeric(4, 1),
    bmi numeric(16, 6),
    vision text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, student_id)
);

ALTER TABLE checkup_results ADD COLUMN IF NOT EXISTS bmi numeric(16, 6);
ALTER TABLE checkup_results ADD COLUMN IF NOT EXISTS vision text;
ALTER TABLE checkup_results ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE checkup_results ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE checkup_results DROP CONSTRAINT IF EXISTS checkup_results_status_check;
ALTER TABLE checkup_results ADD CONSTRAINT checkup_results_status_check
    CHECK (status IN ('completed', 'follow_up', 'pending', 'absent', 'Normal', 'Needs Follow-up'));

-- Rename the original demo student IDs while preserving profile edits and links.
LOCK TABLE students, health_profiles, parent_students, checkup_results
    IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE demo_student_id_map ON COMMIT DROP AS
SELECT id AS old_id, replace(id, '-', '') AS new_id
FROM students
WHERE id IN (
    SELECT 'DEMO-' || lpad(n::text, 3, '0') FROM generate_series(1, 24) AS ids(n)
);

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM demo_student_id_map m JOIN students s ON s.id = m.new_id
    ) THEN
        RAISE EXCEPTION 'Both old and new demo student IDs exist. Resolve the collision before seeding.';
    END IF;
END $$;

INSERT INTO students (id, full_name, class_name)
SELECT m.new_id, s.full_name, s.class_name
FROM students s JOIN demo_student_id_map m ON s.id = m.old_id;
UPDATE health_profiles p SET student_id = m.new_id
FROM demo_student_id_map m WHERE p.student_id = m.old_id;
UPDATE parent_students p SET student_id = m.new_id
FROM demo_student_id_map m WHERE p.student_id = m.old_id;
UPDATE checkup_results r SET student_id = m.new_id
FROM demo_student_id_map m WHERE r.student_id = m.old_id;
DELETE FROM students s USING demo_student_id_map m WHERE s.id = m.old_id;

INSERT INTO students (id, full_name, class_name)
SELECT 'DEMO' || lpad(position::text, 3, '0'), full_name, '6A1'
FROM unnest(ARRAY[
    'Nguyễn Minh An', 'Trần Ngọc Vy', 'Lê Gia Bảo', 'Phạm Hà My',
    'Võ Nhật Nam', 'Đặng Thảo Linh', 'Bùi Hoàng Khang', 'Đỗ Khánh Chi',
    'Ngô Tú Anh', 'Phan Đức Huy', 'Vũ Bảo Ngọc', 'Hoàng Minh Quân',
    'Dương Mai Anh', 'Trương Tuấn Kiệt', 'Hồ Quỳnh Như', 'Lý An Nhiên',
    'Nguyễn Hải Đăng', 'Trần Thanh Trúc', 'Lê Thiên Phúc', 'Phạm Bích Ngân',
    'Võ Anh Khoa', 'Đặng Minh Châu', 'Bùi Gia Hân', 'Đỗ Thành Đạt'
]) WITH ORDINALITY AS names(full_name, position)
ON CONFLICT (id) DO NOTHING;

INSERT INTO health_profiles (student_id, allergies, medical_notes)
SELECT 'DEMO' || lpad(n::text, 3, '0'),
       CASE n WHEN 1 THEN 'Peanuts' WHEN 9 THEN 'Shrimp' WHEN 17 THEN 'Dust mites' END,
       CASE n WHEN 1 THEN 'Parent reported a food allergy.'
              WHEN 5 THEN 'Wears glasses in class.'
              WHEN 14 THEN 'Recheck vision at the next school session.' END
FROM generate_series(1, 24) AS students(n)
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO accounts (id, email, role, password_hash)
SELECT role, role || '@schoolhealth.example', role, crypt(:'demo_password', gen_salt('bf', 10))
FROM unnest(ARRAY['admin', 'nurse', 'parent']) AS roles(role)
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE id = roles.role)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parent_students (parent_id, student_id)
VALUES ('parent', 'DEMO001'), ('parent', 'DEMO017')
ON CONFLICT DO NOTHING;

INSERT INTO checkup_sessions (id, title, checkup_date)
VALUES ('DEMO-BASELINE', 'Start-of-year checkup', DATE '2026-09-14'),
       ('DEMO-CURRENT', 'Term health checkup', DATE '2026-11-03')
ON CONFLICT (id) DO NOTHING;

WITH sample AS (
    SELECT n, session_id, current_session,
           CASE
               WHEN current_session AND n IN (3, 10, 19) THEN 'pending'
               WHEN n IN (8, 24) THEN 'absent'
               WHEN n IN (1, 5, 14, 21) THEN 'follow_up'
               ELSE 'completed'
           END AS status
    FROM generate_series(1, 24) AS students(n)
    CROSS JOIN (VALUES ('DEMO-BASELINE', false), ('DEMO-CURRENT', true))
        AS sessions(session_id, current_session)
)
INSERT INTO checkup_results (session_id, student_id, status, height_cm, weight_kg, notes)
SELECT session_id, 'DEMO' || lpad(n::text, 3, '0'), status,
       CASE WHEN status IN ('completed', 'follow_up')
            THEN 138 + (n * 13 % 24) + CASE WHEN current_session THEN 0.8 ELSE 0.0 END END,
       CASE WHEN status IN ('completed', 'follow_up')
            THEN 32 + (n * 7 % 22) + CASE WHEN current_session THEN 0.5 ELSE 0.0 END END,
       CASE status
           WHEN 'follow_up' THEN CASE n
               WHEN 1 THEN 'Confirm the allergy note with the parent.'
               WHEN 5 THEN 'Repeat the vision screening with glasses.'
               WHEN 14 THEN 'Schedule a repeat vision screening.'
               ELSE 'Ask the family to confirm the follow-up appointment.' END
           WHEN 'absent' THEN 'Student was absent on the checkup date.'
       END
FROM sample
ON CONFLICT (session_id, student_id) DO NOTHING;

UPDATE checkup_results
SET bmi = round(weight_kg / power(height_cm / 100, 2), 6), updated_at = now()
WHERE bmi IS NULL AND height_cm > 0 AND weight_kg > 0;
COMMIT;
