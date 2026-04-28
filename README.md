# AthenaAI StudyBuddy

AthenaAI StudyBuddy is a **student-facing web application** that combines **Firebase** (authentication, profile data, storage) with **Anthropic Claude** (via **Genkit**) to help learners chat with an AI tutor, generate quizzes and exam papers, summarize and analyze documents, plan study time, track progress, and manage tasks. The UI is built with **Next.js 15** (App Router), **React 19**, **Tailwind CSS**, and **Radix** primitives.

This document is a **full product and technical overview**: what the app is for, how each major area works, how Google Drive fits in, and how to run and deploy the project.

---

## 1. Purpose and audience

The app targets **students** who want one place to:

- Ask course-related questions in natural language (**AI Chat**).
- Turn notes, PDFs, or topics into **quizzes**, **practice papers**, and **study plans**.
- Produce **structured notes**, **summaries**, and **writing** (essays, emails, applications, letters).
- **OCR** handwritten or printed pages (**Image to text**).
- Run lightweight **text analysis** and **grammar** checks.
- Use a **Pomodoro-style timer** and **task list** tied to study habits.
- See **history** and **progress** charts across subjects.
- Optionally link **Google Drive** to browse files and import them **inside each tool** (not from a global “push to tool” hub).

New accounts created via **Register** get a profile document in Firestore, complete **onboarding** (profile and subjects), sign in again, and land on the **Dashboard**.

---

## 2. Tech stack (summary)


| Layer                   | Technology                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Framework               | Next.js 15 (App Router), TypeScript                                                      |
| UI                      | React 19, Tailwind CSS, Radix UI, Framer Motion, Lucide icons, Recharts (progress)       |
| Auth & data             | Firebase Auth, Firestore, Firebase Storage                                               |
| AI                      | Genkit, `@genkit-ai/anthropic`, `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`          |
| Google Drive (optional) | Google Identity Services (OAuth token client), Google Picker, Drive REST from the client |


---

## 3. Route map and features (in depth)

Paths below match the **sidebar** and **dashboard** quick links unless noted.

### 3.1 Dashboard (`/dashboard`)

- **Role:** Home after login; personalized greeting, date, and quick stats (study time from logged sessions, average quiz score, “subjects mastered” heuristic).
- **Quick access grid:** Cards for major tools (AI Chat, Generator hub, Analyzer hub, Writing hub, Study Planner, Timer, Tasks, Progress, History). Cards can be reordered; order can be **exported/imported** as JSON and persisted on the user document (`dashboardQuickOrder`).

### 3.2 AI Chat (`/chat`)

- **Role:** Multi-session chat stored in Firestore; AI replies use Genkit flows (e.g. `generate-chat-response`).
- **Documents:** Users can attach context from a **PDF**, **Google Doc** (exported as PDF), or **image** (vision/OCR-style extraction) so follow-up questions use that text. **Google Drive** attachment uses the same connection as elsewhere (`useDrive`).
- **Layout:** Full-width route without the main app sidebar chrome (custom back header).

### 3.3 Quiz Generator (`/quiz`)

- **Role:** Build **multiple-choice** quizzes from a **topic** or from **PDF** (and similar) sources; remedial quizzes can lean on **past attempt history**.
- **Drive:** **Import from Drive** fills the file field like a local upload; grading and explanations use bulk check flows.

### 3.4 Paper Generator (`/paper-generator`)

- **Role:** Generate **practice exams** with configurable counts of MCQs, short answers, and long answers; supports **remedial** mode using quiz/paper history.
- **Drive:** Import syllabus or source PDFs via **Import from Drive**; outputs can be saved where the UI exposes **Save to Drive**.

### 3.5 Guess Paper (`/guess-paper`)

- **Role:** Upload **past papers** (multiple slots) to produce **predicted-style** question/report output using AI.
- **Drive:** Per-slot **Import from Drive**; export/report flows may offer Drive upload.

### 3.6 Summarizer (`/summarize`)

- **Role:** Summarize **pasted text** or **PDFs** (including optional **page range** / focus). Uses PDF text extraction + summarization flows.
- **Drive:** **Import from Drive** for the file path.

### 3.7 Notes Maker (`/notes-maker`)

- **Role:** Generate **structured notes** from a **document** (PDF/image) or from a **topic** + difficulty; supports rotation/preview for images.
- **Drive:** **Import from Drive**; notes PDFs can be saved to Drive when implemented in UI.

### 3.8 Image to Text (`/image-to-text`)

- **Role:** Extract text from images and optionally explain terms or content (Genkit image flow).

### 3.9 Analyzer hub (`/analyzer`) and tools

- **Text Analyzer** (`/analyzer/text-analyzer`): Deeper textual analysis (e.g. keywords, structure—per flow definitions).
- **Grammar Checker** (`/analyzer/grammar-checker`): Grammar-focused feedback.

### 3.10 Writing hub (`/writing`) and tools

- **Essay** (`/writing/essay`), **Email** (`/writing/email`), **Application** (`/writing/application`), **Letter** (`/writing/letter`): templated prompts and AI drafting for each genre.

### 3.11 Study Planner (`/planner`)

- **Role:** AI-generated **study plans** from topic, timeframe, optional syllabus PDF, etc.
- **Drive:** Import syllabus PDF via **Import from Drive**; plan PDFs may be saved to Drive.

### 3.12 Study Timer (`/timer`)

- **Role:** Pomodoro-style sessions; durations can be logged to Firestore for dashboard stats.

### 3.13 My Tasks (`/tasks`)

- **Role:** Task list with optional AI assistance per task (notification hooks in sidebar).

### 3.14 Progress (`/progress`)

- **Role:** Charts and aggregates (e.g. quiz performance, study time) using Recharts.

### 3.15 History (`/history`)

- **Role:** Unified log of past quizzes, papers, summaries, etc., with revisit/download affordances.

### 3.16 Connectors (`/connectors`)

- **Hub (default):** A **two-column grid** of cards: **Google Drive** (available) and **Gmail**, **Notion**, **OneDrive** (coming soon). Each card navigates to `**/connectors?section=…`**.
- **Google Drive (`?section=drive`):** **Only here** do users see **Connect / Disconnect** and **Browse Drive files** (Picker). Browsing confirms access and shows a toast; **real imports** happen via **Import from Drive** inside each tool.
- **Coming-soon sections:** Placeholder detail pages explaining future integrations and linking back to the hub.

See [README_GOOGLE_DRIVE.md](./README_GOOGLE_DRIVE.md) for OAuth, APIs, and security notes.

### 3.17 Profile (`/profile`) and Settings (`/settings`)

- **Profile:** Avatar, name, and quick link from the header.
- **Settings:** Theme (also **Theme toggler** in header), subjects, and account-related options.

### 3.18 Auth and onboarding

- **Register** (`/register`): Creates Firebase user + Firestore `users/{uid}` with `hasCompletedOnboarding: false`.
- **Onboarding** (`/onboarding`): Multi-step form (personal, academic, subjects); sets `hasCompletedOnboarding: true` and writes subject subcollections.
- **Login** (`/login`): Redirects to onboarding if incomplete, else **Dashboard**.
- **Main app layout** (`(main)/layout.tsx`): **Auth guard** enforces login + completed onboarding before showing the shell (sidebar, header, children).

### 3.19 Marketing / landing (`/`)

- Public landing with links to register/login (not covered in detail here).

### 3.20 Generator hub (`/generator`)

- Entry point to generation-related areas (depends on internal links).

---

## 4. Environment variables

Create `.env.local` (or set in Vercel / Firebase App Hosting).

### Firebase (client)

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)

If `FIREBASE_CONFIG` is set (e.g. App Hosting), the Firebase client may parse JSON from that instead.

### AI

- `ANTHROPIC_API_KEY` (required for Claude features)
- `ANTHROPIC_MODEL` (optional; default in `src/ai/model.ts`)

### Google Drive (optional)

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`

Details: [README_GOOGLE_DRIVE.md](./README_GOOGLE_DRIVE.md).

---

## 5. Local development

```bash
npm install
npm run dev
```

Other scripts:


| Script               | Description            |
| -------------------- | ---------------------- |
| `npm run build`      | Production build       |
| `npm run start`      | Serve production build |
| `npm run lint`       | Next.js ESLint         |
| `npm run typecheck`  | `tsc --noEmit`         |
| `npm run genkit:dev` | Genkit dev tooling     |


---

## 6. Favicon and logo

- The **Athena logo** is imported from `@/LOGO/logo.png` (same asset as `AthenaLogo` in `src/components/app/logo.tsx`).
- **Root metadata** (`src/app/layout.tsx`) sets `icons.icon` and `icons.apple` from that import so the tab icon matches the in-app logo. Ensure `src/LOGO/logo.png` exists in your checkout (binary assets may be gitignored in some setups).

---

## 7. Project structure (orientation)

- `src/app/` — App Router: `(main)` authenticated shell, `login`, `register`, `onboarding`, `api/ai/...`.
- `src/components/` — Shared UI, `logo.tsx`, etc.
- `src/ai/` — Genkit instance, flows, schemas.
- `src/firebase/` — Client init, hooks, provider.
- `src/hooks/` — `use-drive.ts` and others.
- `src/lib/` — Utilities (e.g. Google Picker helpers, Drive form value helpers).

Short marketing-style feature list (duplicate summary): [src/README.md](./src/README.md).

---

## 8. Security and privacy (high level)

- **Firestore rules** must ensure users only read/write their own `users/{uid}` and subcollections.
- **Google tokens** for Drive are stored on the user document for client-side API calls; restrict API keys by **HTTP referrer**; prefer least-privilege OAuth scopes (see Drive README).
- **Anthropic API key** is **server-side** only; do not expose as `NEXT_PUBLIC_`*.

---

## 9. Contributing and scope

- Keep **Drive import** on **tool pages**; the Connectors hub remains **browse + account management** only unless product requirements change.
- Avoid unrelated refactors in PRs that fix a single feature.

---

## 10. Related docs

- [README_GOOGLE_DRIVE.md](./README_GOOGLE_DRIVE.md) — Drive OAuth, Picker, import/save matrix, troubleshooting.
- [src/docs/host.md](./src/docs/host.md) — Hosting notes (if present).

