# Personal Job Application Agent

A local-only, review-first Windows application for preparing truthful job applications. It never scrapes ChatGPT conversations, stores credentials, uploads a resume, or submits an application without the required separate approvals.

## Current working milestone

- Local Profile Pack validation with Zod; missing or conflicting facts block resume drafting.
- Job URL or pasted-description analysis with a conservative requirements-to-verified-evidence table.
- ATS-friendly single-column HTML resume source rendered to an actual PDF through Playwright Chromium.
- In-app PDF preview, exact SHA-256 content hash, and `Approve this resume` version-specific approval.
- Playwright form-control inspection, guarded low-risk fill, approval-gated resume upload, and an opt-in submit endpoint.
- SQLite/Prisma schema for applications, approvals, and audit events; JSON files retain the local artifacts for the first milestone.

The current UI implements Phase 0 and the first usable profile-to-PDF/form review flow. Submit clicks remain disabled by default and require `ALLOW_BROWSER_SUBMIT=true`, current final approval, and a single accessible Submit button.

## Start locally

1. Install Node.js 20 LTS or newer.
2. In `D:\jobsapply`, copy `.env.example` to `.env.local`. Leave OpenAI values blank unless you want a future OpenAI-powered enhancement; the current deterministic MVP does not require an API key.
3. Install dependencies with `npm install`.
4. Install the browser runtime once: `npx playwright install chromium`.
5. Create the local SQLite database/client when you begin tracker work: `npm run db:generate` then `npm run db:push`.
6. Start the local UI: `npm run dev`, then open the localhost URL shown in the terminal.

On Windows, double-click `start-agent.bat` for the same setup/start flow. To initialize the optional local Prisma tracker database, run `npm run db:setup` once.

Run `npm test`, `npm run lint`, and `npx tsc --noEmit` before changes are considered verified.

## One-time Profile Pack handoff

This application is not connected to the ChatGPT `Resume` Project. It must not automate or scrape that Project. In the local UI, open **One-time Resume Project handoff** and copy the exact supplied prompt into your existing Resume Project.

Download/save the generated files yourself to these exact local paths:

- `data/profile/MASTER_PROFILE.md`
- `data/profile/master-profile.json`

The expected JSON contract is in `data/profile/master-profile.template.json`. Preserve unmodified source resumes in `data/profile/resumes/original/`. The application validates the JSON and surfaces invalid, unknown, or conflicting information; it does not silently choose a more impressive value. To refresh later, regenerate the same pack in the Resume Project and replace only those two local files.

## Workflow and approvals

1. Paste a job description or give an authorized job URL.
2. Review the extracted requirements and evidence. Anything without profile evidence stays unknown.
3. Generate a PDF draft only after the Profile Pack validates with no conflicts.
4. Review the embedded PDF preview, filename, change summary, and SHA-256 version. Press **Approve this resume** only for the exact reviewed version.
5. A future browser upload must check the approved PDF hash. Resume approval never authorizes application submission.
6. Before any final submit, a complete field/review version must receive a separate explicit `APPROVE SUBMISSION`. The code’s final-submission guard rejects every other state, and no submit-click code exists in this milestone.

## Local data and privacy

Personal artifacts are intentionally ignored by Git:

- `data/profile/` holds the handoff pack and untouched originals.
- `data/resumes/drafts/` holds HTML sources and PDF previews.
- `data/resumes/approved/` holds exact approved copies.
- `data/applications/` holds job snapshots, approval state, and future form reports.
- `playwright-profile/` is reserved for a manual signed-in browser session; do not copy cookies, passwords, MFA codes, or tokens into the project.

`examples/sample-application-record.json` is synthetic and illustrates the desired tracker shape.

After a job is analyzed, open `/applications/<application-id>` on the local server for the tracker dashboard. It shows the recorded status, resume hash, form decisions, audit history, and any manually supplied confirmation evidence.

## Supported browser/site behavior today

The Playwright implementation can inspect visible text, textarea, and select controls on an authorized application URL and save structured field candidates. The guarded filler accepts only explicitly classified low-risk `verified_autofill` values and refuses resume/files, authorization, sponsorship, compensation, demographic, criminal-history, and similar sensitive fields. It does not bypass login, MFA, OTP, CAPTCHA, anti-bot controls, or site restrictions.

No ATS is claimed as fully supported yet. If a site requires login, an OTP, CAPTCHA, unsupported control, or a personal/legal answer, stop and take over manually.

## Test checklist

- `npm test` validates conservative evidence mapping and the final submission gate.
- `npx tsc --noEmit` checks TypeScript contracts.
- Generate a PDF from a non-personal fixture and visually inspect its rendered page for clipping/overlap.
- Manually confirm: no profile means no resume; profile conflicts block drafting; a changed PDF hash cannot reuse approval; `APPROVE RESUME` does not submit; no browser submit control is called.
