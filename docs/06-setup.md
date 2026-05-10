# Local Development Setup

This guide walks you through setting up STHMC — a healthcare clinic management app built on Wix Velo — on your local machine for the first time.

---

## Prerequisites

Install and configure the following before proceeding.

**Tools:**
- Git
- Node.js 14.8 or later
- npm (bundled with Node.js)
- Wix CLI: `npm install -g @wix/cli`

**Accounts and access:**
- An SSH key added to your GitHub account
- Access to the STHMC repository
- A Wix account with editor access to the STHMC site

Verify your Node.js version:

```bash
node --version
# Must be v14.8.0 or later
```

Log in to the Wix CLI before doing anything else. If you skip this, the post-install step will fail.

```bash
wix login
```

---

## 1. Clone and Install

1. Clone the repository using SSH:

```bash
git clone <repo-url>
```

2. Enter the project directory:

```bash
cd <directory>
```

3. Install dependencies:

```bash
npm install
```

The `postinstall` script runs `wix sync-types` automatically. This pulls down Wix platform type definitions into the project. If this step fails with an authentication error, run `wix login` and then re-run `npm install`.

---

## 2. CMS Setup

The app requires four CMS collections to exist in your Wix site before it will function. You must create these manually in the Wix CMS dashboard. Collection IDs are case-sensitive — use the exact IDs listed below.

### Create Collections

**Collection 1: `CustomUsers`**

| Field name | Type | Notes |
|---|---|---|
| `email` | Text | Must be unique |
| `passwordHash` | Text | |
| `isActive` | Boolean | |
| `role` | Text | |
| `failedLoginCount` | Number | |
| `lockUntil` | Date/Time | |
| `lastLoginAt` | Date/Time | |

**Collection 2: `AuthSessions`**

| Field name | Type | Notes |
|---|---|---|
| `sessionId` | Text | Must be unique |
| `userId` | Text | |
| `createdAt` | Date/Time | |
| `expiresAt` | Date/Time | |
| `ipHash` | Text | |
| `userAgent` | Text | |

**Collection 3: `Patients`**

| Field name | Type |
|---|---|
| `firstName` | Text |
| `lastName` | Text |
| `birthday` | Date/Time |
| `age` | Number |
| `sex` | Text |
| `address` | Text |
| `phone` | Text |
| `emergencyContactName` | Text |
| `emergencyContactPhone` | Text |
| `sourceForm` | Text |
| `createdAt` | Date/Time |

**Collection 4: `Charts`**

| Field name | Type |
|---|---|
| `patientId` | Text |
| `isActive` | Boolean |
| `status` | Text |
| `createdAt` | Date/Time |
| `updatedAt` | Date/Time |
| `deactivatedAt` | Date/Time |
| `weight` | Number |
| `height` | Number |
| `temperature` | Number |
| `bp` | Text |
| `heartRate` | Number |
| `respiratoryRate` | Number |
| `department` | Text |
| `findings` | Text |
| `medicationsAd` | Text |
| `chartDate` | Date/Time |

### Set Field Uniqueness

After creating the collections, enforce uniqueness on the following fields:

1. In `CustomUsers`, open the `email` field settings and enable the **Unique** constraint.
2. In `AuthSessions`, open the `sessionId` field settings and enable the **Unique** constraint.

### Collection Permissions

All four collections must be inaccessible to site visitors and site members. The app accesses them exclusively through backend web modules.

For each of the four collections (`CustomUsers`, `AuthSessions`, `Patients`, `Charts`):

1. Open the collection in the Wix CMS dashboard.
2. Go to **Permissions**.
3. Set **Read**, **Create**, **Update**, and **Delete** to **None** for both site visitors and site members.
4. Save the permission settings.

This ensures no client-side code can query or write to these collections directly.

---

## 3. Seed the First User

Before you can log in, you need at least one user record in `CustomUsers`. The `generate-auth-user.mjs` script creates a properly hashed credential object you can paste directly into the CMS.

1. Run the script from the project root:

```bash
node scripts/generate-auth-user.mjs --email "admin@example.com" --password "StrongPassword123!" --role "admin"
```

2. The script outputs a JSON object. Copy the entire object.

3. Open the `CustomUsers` collection in the Wix CMS dashboard.

4. Click **+ New Item** and paste the JSON values into the corresponding fields.

5. Confirm the following before saving:
   - `email` is lowercase
   - `passwordHash` is populated (a bcrypt hash string)
   - `isActive` is set to `true`
   - `role` matches the role you passed (e.g., `admin`)
   - `failedLoginCount` is set to `0`

6. Save the item.

---

## 4. Verify Editor Element IDs

The login page code references specific element IDs. If your Wix Editor has different IDs, the login form will not work. Open the login page in Wix Editor and confirm the following element IDs:

| Element | Expected ID |
|---|---|
| Email input | `#emailInput` |
| Password input | `#passwordInput` |
| Submit button | `#loginButton`, `#submitButton`, or `#signInButton` (the code tries all three) |
| Error text | `#errorText` |
| Form container (optional) | `#loginform` or `#loginForm` |

To check an element's ID in Wix Editor: click the element, then open its **Properties** panel. The ID is shown under the element name.

---

## 5. Run Locally

Start the local development server:

```bash
wix dev
```

This opens the Wix Local Editor in your browser. Any changes you make to code files in your IDE sync to the Local Editor in real time. The Local Editor uses your live Wix site's CMS data, so the collections you created in step 2 are available immediately.

**Note on HTTP functions in preview:** HTTP function routes (`/_functions/*`) behave differently in Wix Preview compared to production. The `Secure` cookie attribute does not apply in preview because preview runs over HTTP, not HTTPS. Web module calls (`.jsw` files) work the same in both environments. When testing authentication locally, use the web module path (`auth-api.jsw`) rather than HTTP function routes.

---

## Troubleshooting

**Login always fails — no error shown**

Check that the `CustomUsers` collection exists and that all field names match exactly (they are case-sensitive). Confirm that `isActive` is `true` on the user record you created. Open the login page in Wix Editor and verify that the element IDs (`#emailInput`, `#passwordInput`, `#errorText`, and a button ID) match what the code expects. A mismatch on any element ID silently breaks form submission.

**Page redirects to login in a loop**

The session storage key must be exactly `custom_auth_session_id`. Open browser DevTools, go to **Application > Session Storage**, and confirm the key is present and spelled correctly after a successful login. A single-character typo in page code will cause the session check to fail on every load.

**CMS queries return empty**

Verify the collection IDs are spelled exactly as listed in this guide — they are case-sensitive (`CustomUsers` is not the same as `customusers`). Confirm that `suppressAuth: true` is passed in all backend CMS queries. Check that the backend code file has the correct collection ID strings and that no copy-paste error introduced extra whitespace.

**`wix sync-types` fails after `npm install`**

You are not logged in to the Wix CLI. Run `wix login`, complete the browser authentication flow, then re-run `npm install`. The `postinstall` hook will re-run `wix sync-types` automatically.

**Mismatch between preview and production auth behavior**

HTTP function cookies use the `Secure` flag, which only takes effect over HTTPS. Wix Preview runs over HTTP, so cookies set with `Secure` are silently dropped. To test authentication in preview, use the web module auth path (`auth-api.jsw`) instead of the HTTP function route. Production behavior over HTTPS is unaffected.
