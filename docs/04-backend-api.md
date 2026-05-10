# Backend API Reference

## Web Modules (.jsw)

Wix Velo `.jsw` files are backend web modules. Their exported functions run server-side and can be called directly from page code using `import { fn } from 'backend/module'` — no HTTP request is made; Velo handles the transport internally.

Access to each module is controlled by a companion `permissions.json` file in the same directory. See [`backend/permissions.json`](../backend/permissions.json) for the current access configuration.

---

## Response Contract

All functions return a plain object. Two shapes are possible:

| Outcome | Shape |
|---|---|
| Success | `{ ok: true, ...data }` |
| Failure | `{ ok: false, type: 'validation' \| 'not-found' \| 'conflict' \| 'server', message: string }` |

`auth-api.jsw` uses a different failure shape (see that section). All other modules follow the table above.

---

## auth-api.jsw

Authentication functions. Failure responses in this module use `{ ok: false, status: number, error: string }` instead of the standard failure shape.

---

### login(email, password)

```js
login(email: string, password: string): Promise<LoginResult>
```

**Parameters**

- `email` — user email address
- `password` — plaintext password

**Returns**

Success (`200`):
```json
{
  "ok": true,
  "status": 200,
  "sessionId": "<uuid>",
  "user": { "id": "...", "email": "...", "role": "..." }
}
```

Failure:
```json
{ "ok": false, "status": 400 | 401 | 429 | 500, "error": "<message>" }
```

| Status | Meaning |
|---|---|
| `400` | Missing or malformed input |
| `401` | Invalid credentials, or account is locked |
| `429` | Too many attempts — rate limited |
| `500` | Unexpected server error |

**Notes**

On success, the caller must persist `sessionId` in session storage under the key `custom_auth_session_id`. Subsequent calls to `me()` and `logout()` depend on this value being present.

---

### me(sessionId)

```js
me(sessionId: string): Promise<MeResult>
```

**Parameters**

- `sessionId` — value from session storage key `custom_auth_session_id`

**Returns**

Success:
```json
{
  "ok": true,
  "status": 200,
  "user": { "id": "...", "email": "...", "role": "..." }
}
```

Failure:
```json
{ "ok": false, "status": 401, "error": "Unauthorized" }
```

A `500` response is also possible on unexpected errors.

**Notes**

Returns `401` if the session ID is missing, has expired, or belongs to an inactive user.

---

### logout(sessionId)

```js
logout(sessionId: string): Promise<LogoutResult>
```

**Parameters**

- `sessionId` — value from session storage key `custom_auth_session_id`

**Returns**

Success:
```json
{ "ok": true, "status": 200 }
```

Failure: `{ "ok": false, "status": 500, "error": "..." }` on unexpected server error only.

**Notes**

This function is idempotent. It returns `ok: true` even if the session does not exist. Internally it deletes the matching `AuthSessions` CMS record.

---

## homepage.jsw

Read-only summary and search functions for the homepage dashboard. All three functions require no authentication parameters — they are intended for use after `me()` confirms a valid session on the page.

---

### getHomepageSummary()

```js
getHomepageSummary(): Promise<SummaryResult>
```

**Parameters**

None.

**Returns**

Success:
```json
{
  "ok": true,
  "totalPatients": 142,
  "totalConsultations": 317,
  "activeCharts": 89
}
```

Failure: `{ ok: false, message: string }`

**Notes**

All three counts are fetched in parallel via `Promise.all`. A failure in any one count propagates as a single failure response.

---

### getRecentConsultations(limit)

```js
getRecentConsultations(limit?: number): Promise<ConsultationListResult>
```

**Parameters**

- `limit` — number of results to return (default: `2`, max: `10`)

**Returns**

Success:
```json
{
  "ok": true,
  "items": [
    {
      "patientId": "...",
      "patientName": "Jane Doe",
      "patientAge": 34,
      "patientSex": "Female",
      "chartId": "...",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "status": "open",
      "source": "chart"
    }
  ]
}
```

Failure: `{ ok: false, message: string }`

**`ConsultationItem` fields**

| Field | Type | Notes |
|---|---|---|
| `patientId` | string | |
| `patientName` | string | |
| `patientAge` | number | |
| `patientSex` | string | |
| `chartId` | string | Empty string when `status` is `'new-patient'` |
| `createdAt` | ISO date string | |
| `status` | string | `'open'`, `'new-patient'`, or chart status value |
| `source` | string | `'chart'` or `'patient'` |

**Notes**

Results are deduplicated by `patientId`. When a patient has multiple entries, the most recently active one is kept. The final list is sorted descending by activity time. `status: 'new-patient'` indicates the patient exists but has no chart yet.

---

### searchPatientsForHomepage(query, limit)

```js
searchPatientsForHomepage(query?: string, limit?: number): Promise<ConsultationListResult>
```

**Parameters**

- `query` — search string (default: `''`)
- `limit` — max results (default: `20`, max: `50`)

**Returns**

Same shape as `getRecentConsultations`. Items always have `status: 'search-result'` and `chartId: ''`.

```json
{
  "ok": true,
  "items": [
    {
      "patientId": "...",
      "patientName": "Jane Doe",
      "patientAge": 34,
      "patientSex": "Female",
      "chartId": "",
      "createdAt": "...",
      "status": "search-result",
      "source": "patient"
    }
  ]
}
```

**Notes**

If `query` is empty, the function returns `{ ok: true, items: [] }` immediately without hitting the database. The search runs against `firstName` and `lastName` independently and deduplicates the combined results before returning.

---

## patients.jsw

Patient record creation and retrieval.

---

### savePatient(payload)

```js
savePatient(payload: PatientPayload): Promise<SavePatientResult>
```

**Parameters**

`payload` is a plain object. Required and optional fields:

| Field | Required | Notes |
|---|---|---|
| `firstName` | Yes | |
| `lastName` | Yes | |
| `birthday` | Yes | Must be parseable as a `Date` |
| `age` | Yes | Integer, 1–130 |
| `sex` | Yes | |
| `phone` | Yes | |
| `emergencyContactName` | Yes | |
| `emergencyContactPhone` | Yes | |
| `address` | No | |

**Returns**

Success:
```json
{ "ok": true, "patientId": "abc123" }
```

Validation failure:
```json
{
  "ok": false,
  "type": "validation",
  "message": "Validation failed",
  "fields": {
    "age": "Age must be between 1 and 130",
    "birthday": "Birthday is required"
  }
}
```

Server failure:
```json
{ "ok": false, "type": "server", "message": "..." }
```

**Notes**

Validation is performed by `patientValidation.js` before the record is written. `sourceForm` and `createdAt` are set by the backend — do not include them in the payload.

---

### getPatientById(patientId)

```js
getPatientById(patientId: string): Promise<PatientResult>
```

**Parameters**

- `patientId` — the patient's CMS record ID

**Returns**

Success:
```json
{
  "ok": true,
  "patient": {
    "id": "...",
    "firstName": "Jane",
    "lastName": "Doe",
    "birthday": "1990-03-22",
    "age": 36,
    "sex": "Female",
    "address": "123 Main St",
    "phone": "555-0100",
    "emergencyContactName": "John Doe",
    "emergencyContactPhone": "555-0101"
  }
}
```

Failure: `{ ok: false, type: 'validation' | 'not-found' | 'server', message: string }`

---

## charts.jsw

Chart creation, retrieval, and update for patient medical charts.

---

### createChartForPatient(patientId)

```js
createChartForPatient(patientId: string): Promise<CreateChartResult>
```

**Parameters**

- `patientId` — the patient's CMS record ID

**Returns**

Success:
```json
{ "ok": true, "chartId": "xyz789", "patientId": "abc123" }
```

Failure: `{ ok: false, type: 'validation' | 'not-found' | 'server', message: string }`

**Notes**

Before inserting the new chart, all existing charts for this patient with `isActive: true` are set to `isActive: false` and `deactivatedAt: now`. Only one active chart per patient is permitted at any time.

---

### getChartContext(patientId, chartId)

```js
getChartContext(patientId: string, chartId: string): Promise<ChartContextResult>
```

**Parameters**

- `patientId` — the patient's CMS record ID
- `chartId` — the chart's CMS record ID

**Returns**

Success:
```json
{
  "ok": true,
  "patient": {
    "id": "...",
    "firstName": "Jane",
    "lastName": "Doe",
    "age": 36,
    "sex": "Female"
  },
  "chart": {
    "id": "...",
    "patientId": "...",
    "isActive": true,
    "status": "open",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T12:00:00.000Z",
    "weight": 68,
    "height": 165,
    "temperature": 36.6,
    "bp": "120/80",
    "heartRate": 72,
    "respiratoryRate": 16,
    "department": "General",
    "findings": "...",
    "medicationsAd": "...",
    "chartDate": "2026-01-15"
  }
}
```

Failure types:

| Type | Meaning |
|---|---|
| `'validation'` | Missing or invalid parameters |
| `'not-found'` | Patient or chart does not exist |
| `'conflict'` | Chart exists but does not belong to this patient |

---

### getChartsForPatient(patientId, limit)

```js
getChartsForPatient(patientId: string, limit?: number): Promise<ChartListResult>
```

**Parameters**

- `patientId` — the patient's CMS record ID
- `limit` — max results (default: `50`, max: `100`)

**Returns**

Success:
```json
{
  "ok": true,
  "items": [
    {
      "chartId": "...",
      "patientId": "...",
      "department": "General",
      "chartDate": "2026-01-15",
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T12:00:00.000Z",
      "status": "open",
      "isActive": true
    }
  ]
}
```

Failure: `{ ok: false, type: 'validation' | 'not-found' | 'server', message: string }`

**Notes**

Results are sorted descending by `createdAt`. Use `getLatestChartForPatient` when you only need the most recent chart ID.

---

### getLatestChartForPatient(patientId)

```js
getLatestChartForPatient(patientId: string): Promise<LatestChartResult>
```

**Parameters**

- `patientId` — the patient's CMS record ID

**Returns**

Success:
```json
{ "ok": true, "patientId": "abc123", "chartId": "xyz789" }
```

Failure:
```json
{ "ok": false, "type": "not-found", "message": "No charts found for patient" }
```

**Notes**

Sorts by `updatedAt` descending, then `createdAt` descending. This returns the most recently modified chart, which may not be the active one if the active chart has never been edited.

---

### updateChartData(patientId, chartId, payload)

```js
updateChartData(
  patientId: string,
  chartId: string,
  payload: ChartUpdatePayload
): Promise<UpdateChartResult>
```

**Parameters**

- `patientId` — the patient's CMS record ID
- `chartId` — the chart's CMS record ID
- `payload` — object containing any of the updatable chart fields

**Updatable fields in `payload`**

| Field | Type |
|---|---|
| `weight` | number |
| `height` | number |
| `temperature` | number |
| `bp` | string |
| `heartRate` | number |
| `respiratoryRate` | number |
| `department` | string |
| `findings` | string |
| `medicationsAd` | string |
| `chartDate` | string |

**Returns**

Success:
```json
{ "ok": true, "chartId": "xyz789", "updatedAt": "2026-01-15T14:00:00.000Z" }
```

Failure types:

| Type | Meaning |
|---|---|
| `'validation'` | Missing or invalid parameters |
| `'not-found'` | Patient or chart does not exist |
| `'conflict'` | Chart does not belong to this patient |
| `'server'` | Unexpected error |

**Notes**

`updatedAt` is set to `new Date()` on every call. Fields not included in `payload` are written as `null` — they are not preserved from the existing record. Always send all fields you want to keep, even if their values have not changed.

---

## HTTP Functions (http-functions.js)

HTTP functions are defined in `backend/http-functions.js` and are accessible from external clients at `/_functions/<name>`. They use the same underlying `authService.js` and `auth/` modules as the web module equivalents. The only differences are transport (cookies instead of session storage) and IP extraction (read from request headers instead of the fixed value `'web-module'`).

---

### POST /_functions/login

Authenticates a user and sets a session cookie.

**Request**

```
POST /_functions/login
Content-Type: application/json

{ "email": "user@example.com", "password": "secret" }
```

**Response — 200 OK**

```
Set-Cookie: custom_auth_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400

{ "ok": true, "user": { "id": "...", "email": "...", "role": "..." } }
```

**Response — error**

| Status | Body |
|---|---|
| `400` | `{ "error": "Invalid input" }` |
| `401` | `{ "error": "Invalid credentials" }` |
| `429` | `{ "error": "Rate limited" }` |
| `500` | `{ "error": "Internal server error" }` |

---

### POST /_functions/logout

Revokes the current session.

**Request**

```
POST /_functions/logout
Cookie: custom_auth_session=<token>
```

**Response — 200 OK**

```json
{}
```

**Notes**

Always returns `200`, even if the cookie is absent or the session does not exist.

---

### GET /_functions/me

Returns the current user from the session cookie.

**Request**

```
GET /_functions/me
Cookie: custom_auth_session=<token>
```

**Response — 200 OK**

```json
{ "user": { "id": "...", "email": "...", "role": "..." } }
```

**Response — 401 Unauthorized**

```json
{ "error": "Unauthorized" }
```

---

## patientValidation.js

Internal module used by `patients.jsw`. Not exported from a `.jsw` file and not callable from page code.

### validateAndNormalizePatientPayload(payload)

```js
validateAndNormalizePatientPayload(payload: object): ValidationResult
```

**Parameters**

- `payload` — raw patient form data

**Returns**

Success:
```json
{ "ok": true, "data": { /* normalized patient fields */ } }
```

Failure:
```json
{
  "ok": false,
  "errors": {
    "age": "Age must be an integer between 1 and 130",
    "birthday": "Birthday must be a valid date"
  }
}
```

**Required fields validated**

`firstName`, `lastName`, `birthday`, `age`, `sex`, `phone`, `emergencyContactName`, `emergencyContactPhone`

**Validation rules**

- `age` must be an integer in the range 1–130
- `birthday` must be parseable as a JavaScript `Date`
- All required fields must be present and non-empty

`patients.jsw` returns the `errors` object to the caller as `fields` in the validation failure response.
