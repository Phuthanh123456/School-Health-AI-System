# Shared student data contract

The combined nurse session and result flows (US-4.1 / US-4.2) use
`schoolhealth_demo.students` as the canonical student table. Session rosters,
result participation, and student IDs all resolve through that table and the
`schoolhealth_demo.checkup_results` composite key.

Student profile work must map its `Student` model and health profile to the same
schema and student IDs before those flows are integrated. A separate
`public.students` table creates two student populations; it cannot be used as
the source for checkup sessions without migrating and reconciling the data.

The demo seed creates both `students` and `health_profiles` in
`schoolhealth_demo`. It is the shared seed entry point for local demo data.
