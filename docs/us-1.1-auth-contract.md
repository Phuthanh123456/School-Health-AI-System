# US-1.1 Authentication Contract

This contract uses the Admin, Nurse, and Parent accounts created by the shared SCRUM-27 seed command. It does not add another account seed or registration flow.

## Login

`POST /auth/login` accepts JSON:

```json
{
  "email": "admin@schoolhealth.example",
  "password": "<the password supplied to the SCRUM-27 seed command>"
}
```

A successful response is HTTP 200:

```json
{
  "access_token": "<signed access token>",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "admin",
    "email": "admin@schoolhealth.example",
    "role": "admin"
  }
}
```

Roles are lowercase: `admin`, `nurse`, and `parent`. Invalid credentials return HTTP 401 with the same generic message, whether the email or password is wrong. The response never includes a password or password hash.

## Authenticated user

`GET /auth/me` requires `Authorization: Bearer <access_token>` and returns the authenticated user's `id`, `email`, and `role`. Missing, invalid, and expired tokens return HTTP 401. This endpoint verifies authentication for US-1.1; authorization for protected student data remains in SCRUM-20.

## Frontend landing routes

After login, the frontend stores the token for the current browser tab and routes by the returned role:

| Role | Landing route |
| --- | --- |
| Admin | `/admin` |
| Nurse | `/nurse` |
| Parent | `/parent` |

The Nurse route uses the nurse student screen. Admin and Parent routes are placeholders until their dashboard stories are implemented. The public landing page remains available at `/`; the login form is at `/login`.

## Token configuration

The API signs one-hour HS256 tokens with `AUTH_TOKEN_SECRET`. Supply a unique random value of at least 32 characters through the local environment or approved secret store. Never commit the real value. The browser stores the access token in `sessionStorage` and discards it when the tab session ends or the user signs out.
