# Checkup sessions API

These read-only endpoints back US-4.1. They use the `schoolhealth_demo` schema and the stable IDs from the shared `backend/scripts/seed_demo.sql` command. No second seed entry point is needed.

The current backend does not yet enforce nurse authentication or RBAC. These routes are for fictional demo data only; SCRUM-20 must add the nurse authorization dependency before the API is connected to non-demo student records.

## `GET /api/checkup-sessions`

Returns sessions ordered by checkup date, newest first. `class_name` is derived from the participating students; it is `null` for a session with no participants and comma-separated if a session includes more than one class. The current demo seed contains two sessions for class `6A1`.

```json
[
  {
    "id": "DEMO-CURRENT",
    "title": "Term health checkup",
    "checkup_date": "2026-11-03",
    "class_name": "6A1",
    "participant_count": 24
  },
  {
    "id": "DEMO-BASELINE",
    "title": "Start-of-year checkup",
    "checkup_date": "2026-09-14",
    "class_name": "6A1",
    "participant_count": 24
  }
]
```

An empty database returns `[]` with HTTP 200.

## `GET /api/checkup-sessions/{session_id}`

Returns session details and its participating students. The roster is derived from rows in `checkup_results`, ordered by student name and ID. A valid session without participants returns `students: []` and `participant_count: 0`. An unknown session ID returns HTTP 404.

```json
{
  "id": "DEMO-CURRENT",
  "title": "Term health checkup",
  "checkup_date": "2026-11-03",
  "class_name": "6A1",
  "participant_count": 24,
  "students": [
    { "id": "DEMO-001", "full_name": "Nguyễn Minh An", "class_name": "6A1" },
    { "id": "DEMO-002", "full_name": "Trần Ngọc Vy", "class_name": "6A1" }
  ]
}
```

The example roster is shortened; the API returns all 24 seeded students. Result entry remains outside US-4.1. The selector hands the stable session ID to `#/checkup-sessions/{sessionId}/results`, reserved for SCRUM-40.
