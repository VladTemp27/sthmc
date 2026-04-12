# Custom Auth Manual Operations

## 1) Create CMS collections and fields

Create two collections in Wix CMS with exact IDs:

1. `CustomUsers`
2. `AuthSessions`

Add fields exactly as documented in `docs/auth-data-model.md`.

## 2) Configure field uniqueness

- `CustomUsers.email` must be unique.
- `AuthSessions.sessionId` must be unique.

## 3) Collection permissions

Grant backend code access to read/write these collections.

Recommended:

- Do not expose either collection directly to site visitors.
- Keep collection operations backend-only via `http-functions`.

## 4) Seed at least one active user

Insert at least one user into `CustomUsers`:

- `email`: normalized lowercase email
- `passwordHash`: generated with PBKDF2 format (`pbkdf2$iterations$salt$hash`)
- `isActive`: `true`
- `role`: your desired role (for example `admin`)
- `failedLoginCount`: `0`

You can generate a ready-to-paste JSON item with:

```bash
node scripts/generate-auth-user.mjs --email "admin@example.com" --password "StrongPassword123!" --role "admin"
```

Copy the output and create a new item in the `CustomUsers` collection.

## 5) Verify page element IDs on Login page

Current frontend code attempts these IDs:

- Inputs: `#emailInput`, `#passwordInput`
- Buttons: `#loginButton`, `#submitButton`, `#signInButton`
- Error text: `#errorText`
- Optional form container: `#loginForm`

If your actual IDs differ, rename elements in the editor or update `src/pages/Log in.pv6yk.js` accordingly.
