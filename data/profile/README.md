# Profile Pack handoff

This application does not read, scrape, or synchronize your ChatGPT Resume Project. It uses a one-time local profile pack that you generate and save yourself.

Save the two files produced by the Resume Project here:

- `data/profile/MASTER_PROFILE.md`
- `data/profile/master-profile.json`

Keep original resumes, unchanged, in `data/profile/resumes/original/`. This folder is ignored by Git. The app will validate the structured file before using it and will flag incomplete or conflicting facts instead of guessing.

The expected JSON shape is documented in `master-profile.template.json`. Use the exact prompt shown in the application before creating the pack.
