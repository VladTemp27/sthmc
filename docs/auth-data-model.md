# Custom Auth Data Model

This project uses a custom email/password authentication model (no Wix Members dependency).

## Collection: `CustomUsers`

Required fields:

- `email` (Text, unique, normalized lowercase)
- `passwordHash` (Text, format: `pbkdf2$iterations$salt$hash`)
- `isActive` (Boolean)
- `role` (Text)
- `failedLoginCount` (Number)
- `lockUntil` (Date/Time, nullable)
- `lastLoginAt` (Date/Time, nullable)

Notes:

- `email` must be unique at the collection level.
- `passwordHash` is never returned by API responses.
- Lockout policy: after 5 failed attempts, account is locked for 15 minutes.

## Collection: `AuthSessions`

Required fields:

- `sessionId` (Text, unique, opaque random token)
- `userId` (Text, references `CustomUsers._id`)
- `createdAt` (Date/Time)
- `expiresAt` (Date/Time)
- `ipHash` (Text)
- `userAgent` (Text)

Notes:

- Sessions expire after 24 hours.
- Expired sessions are rejected and removed on read.
- Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=86400`.
