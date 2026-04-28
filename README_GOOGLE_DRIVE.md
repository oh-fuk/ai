# Google Drive integration — AthenaAI StudyBuddy

**Audience:** Product, engineering, and stakeholders preparing a **presentation** or hand-off document.  
**Scope:** How students connect Google Drive, **import** files into study tools, and **save** generated work back to Drive — including the **Connectors → Google Drive** hub.

---

## 1. Executive summary

AthenaAI links each learner’s Google account (Drive scope) so they can:

| Capability | Where it happens |
|------------|------------------|
| **Connect** Drive once | **Connectors** (`/connectors` or `/connectors?section=drive`) |
| **Browse & choose** a file | Same page → **Browse Drive files** (Google Picker) |
| **Send that file into a tool** | After picking → **Import into a tool** buttons (new) |
| **Import from inside any tool** | **Import from Drive** on Summarize, Notes, Paper, Quiz, Planner, Guess Paper, Chat |
| **Save results to Drive** | **Save to Drive** on supported outputs (PDF/text) |

Students stay inside AthenaAI; OAuth and file transfer use **Google’s official APIs** (OAuth 2.0, Drive REST, Picker).

---

## 2. User journeys (for slides)

### Journey A — “Hub first” (Connectors)

1. Open **Connectors** → **Google Drive** (or `/connectors?section=drive`).
2. Tap **Connect** → Google consent → account linked; token stored on the user profile in **Firestore** (encrypted in transit; app stores access token as provided by Google for API calls).
3. Tap **Browse Drive files** → Google Picker opens → student selects e.g. a PDF.
4. New panel: **Import into a tool** → choose **Quiz Generator**, **Notes Maker**, etc.
5. App opens that tool with `?applyDrive=1`, downloads the file in the background, and **pre-fills** the same “Drive import” payload as if the student had pressed **Import from Drive** inside the tool.
6. Student completes the form (subject, options) and runs generation.

### Journey B — “Tool first”

1. Student opens e.g. **Notes Maker** directly.
2. Taps **Import from Drive** (visible only when Drive is connected).
3. Picker → file → notes flow as today.

### Journey C — **AI Chat** with a document

1. From Connectors: pick file → **AI Chat**, *or* in Chat use the **Drive** icon.
2. PDF / Google Doc → text extraction; image → vision extraction.
3. Text is attached to the **next** message context (chip UI); student types the actual question.

### Journey D — **Save to Drive**

After generating notes, quiz results PDF, paper PDFs, study plan PDF, guess paper report, etc., **Save to Drive** uploads via Drive **multipart upload** API.

---

## 3. Architecture (technical slide)

```text
┌─────────────────┐     OAuth 2.0      ┌──────────────────────┐
│  Browser (Next) │ ◄────────────────► │ Google Identity (GIS) │
│  Connectors UI   │                    │ + Token client        │
└────────┬────────┘                    └──────────────────────┘
         │
         │  Firestore: users/{uid}.googleDrive
         │  { connected, email, accessToken, connectedAt }
         ▼
┌─────────────────┐     Picker API     ┌──────────────────────┐
│ use-drive hook  │ ◄────────────────► │ Google Picker (iframe)│
│ openPicker()    │   + Developer key   │ File metadata          │
└────────┬────────┘                    └──────────────────────┘
         │
         │  drive/v3 files (download / upload)
         ▼
┌─────────────────┐
│ Google Drive    │
│ (user’s files)  │
└─────────────────┘
```

**Connectors “import to tool” bridge**

- On “Import into **X**”, the app writes a small JSON payload to **`sessionStorage`** (`athenaDriveImportQueue`) and navigates to **`/X?applyDrive=1`**.
- Hook **`useApplyQueuedDriveImport`** (on each destination page) consumes the queue, calls **`downloadFile`** from `useDrive`, then applies the result to the local form / chat attachment state, and removes the query string.

---

## 4. Google Cloud & environment configuration

### 4.1 Required environment variables (e.g. Vercel)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth 2.0 **Web client** ID (GIS token client + consent). |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` | **API key** used as Picker **developer key** (not the client secret). |

Optional but recommended for production docs: document **redirect URIs** are not used the same way for implicit GIS token flow; instead configure **Authorized JavaScript origins** for your production domain(s).

### 4.2 APIs to enable (Google Cloud Console)

- **Google Drive API** — download / upload files.
- **Google Picker API** — file browser UI.

### 4.3 API key restrictions (critical for Vercel)

- Application restriction: **HTTP referrers**.
- Add patterns such as:
  - `https://your-app.vercel.app/*`
  - `https://*.vercel.app/*` (preview deployments)

Without this, the Picker iframe may show **errors / 404-style pages** from Google.

### 4.4 OAuth consent screen

- Scopes used in app (see `src/lib/google-drive-picker.ts`):
  - `https://www.googleapis.com/auth/drive.file`
  - `https://www.googleapis.com/auth/drive.readonly`

Publish the consent screen when moving out of testing mode, or add test users while in **Testing**.

### 4.5 Token lifetime & refresh

Access tokens expire (~**1 hour**). The app **refreshes silently** before opening the Picker (`requestGoogleDriveAccessTokenSilent`) and persists the new `accessToken` on the user document so **Browse Drive** and **Import** keep working on long sessions.

---

## 5. Security & privacy talking points

- **Least privilege:** Read-only + file scopes; no broad “full Drive admin” scope in this integration.
- **Tokens:** Stored in **Firestore** on the user’s own document; treat Firestore security rules as the primary guard (only `uid` may read/write their profile).
- **Client-side flows:** Picker and GIS run in the browser; API keys are **public** (`NEXT_PUBLIC_*`) — restrict by **referrer** and rotate if leaked.
- **No server-side Drive credential** in this design: each user authorizes their own Google account.

---

## 6. Feature matrix (slide-ready)

| Feature | Import (in-tool) | Import from Connectors hub | Save to Drive |
|---------|------------------|----------------------------|----------------|
| Summarizer | Yes | Yes | Yes (summary text) |
| Notes Maker | Yes | Yes | Yes (notes PDF) |
| Paper Generator | Yes | Yes | Yes (question + results PDFs) |
| Quiz Generator | Yes | Yes | Yes (results PDF) |
| Study Planner | Yes | Yes | Yes (plan PDF) |
| Guess Paper | Yes (per slot) | Yes (slot 1) | Yes (report PDF) |
| AI Chat | Yes (attach) | Yes | — |

---

## 7. File-type behaviour

| MIME / type | Picker filter (typical) | Behaviour |
|-------------|-------------------------|-----------|
| PDF | `application/pdf` | Native download; text extraction where needed. |
| Google Doc | `application/vnd.google-apps.document` | Exported as **PDF** via Drive export endpoint, then treated as PDF. |
| Images (`image/*`) | Images | Vision / OCR flows per tool. |
| Guess Paper | Prefer PDF / Docs | Multi-paper flow expects PDF-like content; Connectors sends to **slot 1** for convenience. |

---

## 8. Troubleshooting (FAQ for Q&A)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Picker blank / Google error | API key referrer or Picker API disabled | Fix key restrictions + enable APIs; redeploy. |
| “Drive session expired” | Refresh token failed | Disconnect → Connect again on Connectors. |
| Import works on Wi‑Fi but not mobile | Popup / third-party cookies | Try same browser; ensure GIS scripts not blocked. |
| `applyDrive=1` then “Nothing to import” | `sessionStorage` cleared / private tab | Pick file again on Connectors, then tap tool button immediately. |

---

## 9. Code map (for developers)

| Path | Role |
|------|------|
| `src/hooks/use-drive.ts` | Connection state, Picker, download, upload, silent refresh, `setOrigin`. |
| `src/lib/google-drive-picker.ts` | Shared OAuth scope string, picker origin, silent token request. |
| `src/lib/drive-form-file.ts` | `__driveImport` shape + MIME helpers for forms. |
| `src/lib/drive-import-queue.ts` | Connectors → tool hand-off (`sessionStorage` + destination list). |
| `src/hooks/use-apply-queued-drive-import.ts` | Applies queued import after navigation. |
| `src/components/app/drive-import-button.tsx` | Reusable **Import from Drive** button. |
| `src/app/(main)/connectors/page.tsx` | Connect / disconnect / browse / **Import into a tool**. |

---

## 10. Future enhancements (roadmap slide)

- Optional **server-side** token storage / refresh with a Cloud Function for stricter secret handling.
- **OneDrive / Notion** connectors (placeholders already on Connectors).
- Per–guess-paper **slot** selection when importing from Connectors.
- Deep links with **file ID** only (no `sessionStorage`) for shareable URLs.

---

*Document version: aligned with AthenaAI StudyBuddy `main` branch (Connectors hub import + in-tool Drive flows).*
