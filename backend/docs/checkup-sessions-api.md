# Checkup sessions API

These endpoints back US-4.1 and use the same `schoolhealth_demo` schema,
authentication, and seeded data as the US-4.2 result-entry API. Every endpoint
requires HTTP Basic credentials for an account with the Nurse role. The stable
demo IDs come from the shared `backend/scripts/seed_demo.sql` command.

## `GET /checkups/sessions`

Returns predefined sessions ordered by checkup date, newest first.
`class_name` is derived from participating students; it is `null` when a
session has no participants and comma-separated when it includes more than one
class. `participant_count` counts each participating student once.

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

No sessions returns `[]` with HTTP 200. A session without participants remains
in the response with `class_name: null` and `participant_count: 0`.

## `GET /checkups/sessions/{session_id}`

Returns one session with the participating students. The roster comes from
`checkup_results`, ordered by student name and ID. A valid session without
participants returns `students: []`; an unknown ID returns HTTP 404.

```json
{
  "id": "DEMO-CURRENT",
  "title": "Term health checkup",
  "checkup_date": "2026-11-03",
  "class_name": "6A1",
  "participant_count": 24,
  "students": [
    { "id": "DEMO-001", "student_code": "DEMO-001", "full_name": "Nguyễn Minh An", "class_name": "6A1" },
    { "id": "DEMO-002", "student_code": "DEMO-002", "full_name": "Trần Ngọc Vy", "class_name": "6A1" }
  ]
}
```

The example roster is shortened; the API returns all participants. The selector
continues to `#/checkup-sessions/{sessionId}/results` and hands the selected
session to the existing SCRUM-40 result-entry flow. This feature lists existing
sessions; scheduling, editing sessions, and selecting multiple classes remain
out of scope.
