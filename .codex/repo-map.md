# Repository Intelligence

## Project Overview

The workspace is being initialized as a local-first personal job application agent. At discovery, it contained only the implementation brief and no application code, profile pack, resume sources, package manifest, or Git repository.

## Technology Stack

Planned from the implementation brief: Next.js App Router, TypeScript, Tailwind CSS, Zod, Prisma with SQLite, the official OpenAI JavaScript SDK, and Playwright with Chromium.

## Directory Structure

- `Job_Application_Agent_Implementation_Brief (2).md` - authoritative implementation requirements supplied by the user.
- `.codex/repo-map.md` - this durable architecture record.

## Architecture

Not yet implemented. The planned application is a single local Next.js application with local files for profile and resume artifacts, SQLite metadata, API route handlers for deterministic actions, and Playwright for guarded browser automation.

## Application Entry Points

Unknown until the Next.js scaffold is created.

## Configuration

Node.js v20.20.2 and npm v11.8.0 are available. Python 3.14.2 and Git are installed. The workspace is not currently a Git repository. No browser executable was found on `PATH`; Playwright-managed Chromium is required for browser features.

## Risks / Important Constraints

- The profile source is a one-time user-generated file handoff from the existing ChatGPT Resume Project; no automated ChatGPT conversation extraction or private endpoints are permitted.
- No profile or resume source files exist locally yet, so the app must preserve unknown values rather than fabricate them.
- Resume upload and final application submission need separate, code-enforced explicit approval gates.
- Credentials, cookies, OTPs, and API keys must never be stored in project data or logs.
