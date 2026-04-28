# Google Drive integration — AthenaAI StudyBuddy

**Audience:** Product, engineering, and stakeholders preparing a **presentation** or hand-off.  
**Scope:** How students **connect** Google Drive, **browse** files from **Connectors**, **import only inside each study tool**, and **save** generated work back to Drive.

---

## 1. Executive summary


| Capability                        | Where it happens                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Connect** Drive once            | **Connectors** hub → **Google Drive** card → `/connectors?section=drive`                                                                                                        |
| **Browse** files (Picker)         | **Only on the Drive detail page** → **Browse Drive files** — confirms access (toast on pick; **no** import into a tool from the hub)                                         |
| **Import a file into a workflow** | Only inside each tool: **Import from Drive** on Summarize, Notes Maker, Paper Generator, Quiz, Planner, Guess Paper, Chat, etc.                                                |
| **Save results to Drive**         | **Save to Drive** on supported outputs (PDF/text)                                                                                                                              |


OAuth and file transfer use **Google’s official APIs** (OAuth 2.0, Drive REST, Picker).

---

## 2. User journeys (for slides)

### Journey A — Connectors (account + browse)

1. Open **Connectors** (`/connectors`) → tap the **Google Drive** card → `/connectors?section=drive`.
2. Tap **Connect** → Google consent → account linked; access token stored on the user profile in **Firestore** (same pattern as in-app Drive usage).
3. Tap **Browse Drive files** → Google Picker → student can select a file to **verify** access; the app shows a toast explaining that **import** is done from inside each tool.

### Journey B — Tool-first import (primary path)

1. Student opens e.g. **Notes Maker**.
2. Taps **Import from Drive** (when Drive is connected).
3. Picker → file → download → form is filled like a local upload; student continues with subject/options and generation.

### Journey C — AI Chat with a document

Only from **Chat**: use the Drive control / **Import from Drive**, then ask questions against the extracted text attachment.

### Journey D — Save to Drive

After generating notes, quiz PDFs, paper PDFs, study plan PDF, guess paper report, etc., **Save to Drive** uses Drive **multipart upload** where implemented.

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

There is **no** Connectors → tool `sessionStorage` bridge: import always runs in the tool that owns the form or chat attachment state.

---

## 4. Google Cloud & environment configuration

### 4.1 Required environment variables (e.g. Vercel)


| Variable                            | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`      | OAuth 2.0 **Web client** ID (GIS token client + consent).             |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` | **API key** used as Picker **developer key** (not the client secret). |


Configure **Authorized JavaScript origins** for your production domain(s).

### 4.2 APIs to enable (Google Cloud Console)

- **Google Drive API** — download / upload files.  
- **Google Picker API** — file browser UI.

### 4.3 API key restrictions (critical for Vercel)

- Application restriction: **HTTP referrers**.  
- Add patterns such as `https://your-app.vercel.app/`* and preview hosts if needed.

### 4.4 OAuth consent screen

- Scopes (see `src/lib/google-drive-picker.ts`): `drive.file` and `drive.readonly` style access as defined there.  
- Publish the consent screen when leaving **Testing**, or add test users.

### 4.5 Token lifetime & refresh

Access tokens expire (~**1 hour**). The app **refreshes silently** before opening the Picker (`requestGoogleDriveAccessTokenSilent`) and can persist the new `accessToken` on the user document.

---

## 5. Security & privacy talking points

- **Least privilege:** Scoped read/write appropriate for per-file access, not full admin Drive.  
- **Tokens:** Stored in **Firestore** on the user document; security rules must restrict reads/writes to the owning `uid`.  
- **Public keys:** `NEXT_PUBLIC_`* keys must be **referrer-restricted** and rotated if leaked.  
- **No server-side Drive credential** in this design: each user authorizes their own Google account.

---

## 6. Feature matrix (slide-ready)


| Feature         | Import (in-tool) | Browse on Connectors | Save to Drive      |
| --------------- | ---------------- | -------------------- | ------------------ |
| Summarizer      | Yes              | Yes (Picker only)    | Yes (summary text) |
| Notes Maker     | Yes              | Yes (Picker only)    | Yes (notes PDF)    |
| Paper Generator | Yes              | Yes (Picker only)    | Yes (PDFs)         |
| Quiz            | Yes              | Yes (Picker only)    | Yes (results PDF)  |
| Study Planner   | Yes              | Yes (Picker only)    | Yes (plan PDF)     |
| Guess Paper     | Yes              | Yes (Picker only)    | Yes (report PDF)   |
| AI Chat         | Yes              | Yes (Picker only)    | —                  |


---

## 7. File-type behaviour


| MIME / type | Typical handling                                                 |
| ----------- | ---------------------------------------------------------------- |
| PDF         | Download; text extraction in flows that need it.                 |
| Google Doc  | Often exported as **PDF** via Drive export, then treated as PDF. |
| Images      | Vision / OCR per tool.                                           |


---

## 8. Troubleshooting (FAQ)


| Symptom                                       | Likely cause                            | Fix                                                 |
| --------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| Picker blank / Google error                   | API key referrer or Picker API disabled | Fix key restrictions + enable APIs; redeploy.       |
| “Drive session expired”                       | Silent refresh failed                   | Disconnect → Connect again on Connectors.           |
| “I picked on Connectors but nothing imported” | By design                               | Open the target tool and use **Import from Drive**. |


---

## 9. Code map (for developers)


| Path                                         | Role                                                            |
| -------------------------------------------- | --------------------------------------------------------------- |
| `src/hooks/use-drive.ts`                     | Connection state, Picker, download, upload, silent refresh.     |
| `src/lib/google-drive-picker.ts`             | Shared OAuth scope string, picker origin, silent token request. |
| `src/lib/drive-form-file.ts`                 | `__driveImport` shape + MIME helpers for forms.                 |
| `src/components/app/drive-import-button.tsx` | Reusable **Import from Drive** button.                          |
| `src/app/(main)/connectors/page.tsx`         | 2-column hub + section routes; Drive page loads Picker scripts; connect / disconnect / browse. |


---

## 10. Future enhancements

- Server-side token storage / refresh (e.g. Cloud Function) for stricter secret handling.  
- **OneDrive / Notion** connectors (placeholders on Connectors).  
- Optional deep links with file ID for support workflows (still opening a tool, not hub import).

---

*Document version: Connectors = connect + browse; import only in tools.*