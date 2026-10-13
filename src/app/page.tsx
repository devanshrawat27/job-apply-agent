"use client";

import { useEffect, useState } from "react";

type ProfileStatus = { ready: boolean; errors: string[]; summary: { name: string; lastVerified: string; conflicts: string[] } | null };
type Job = { id: string; company: string | null; role: string | null; location: string | null; evidence: { requirement: string; evidence: string[] }[] };
type Resume = { applicationId: string; fileName: string; contentHash: string; version: string; changeSummary: string[] };
type Field = { field_label: string; field_type: string; available_options: string[]; proposed_value: string | null; status: string; reason: string; risk?: string };
type TrackerStatus = "resume_draft" | "resume_approved" | "form_in_progress" | "needs_user_input" | "ready_for_review" | "confirmation_unverified" | "blocked";
type AIStatus = { configured: boolean; available: boolean; model: string; message: string };
const HANDOFF_PROMPT = `Using all career-related context available in this Project and its uploaded files, create my Personal Career Master Profile Pack for job applications. Do not invent or infer facts as if they were verified. Consolidate my personal/contact details, education, expected graduation, CGPA, experience/internships, dates, responsibilities, skills, projects, achievements, certifications, links, job preferences, previously used application answers, and resume-writing preferences. Preserve exact names, dates, metrics, and URLs when available. If facts conflict, show each conflicting value with its source/context and mark it NEEDS_MY_CONFIRMATION; do not silently pick one. Mark missing facts UNKNOWN. Separate verified facts from preferences and suggested wording. Create two outputs: (1) MASTER_PROFILE.md, readable and comprehensive; (2) master-profile.json, structured and valid JSON. Also provide a short checklist of conflicts/questions I should resolve and list the source files/resumes that should be preserved unchanged. Tailor nothing to a particular job yet. The goal is a reusable, truthful source of career facts for my personal job-application agent.`;

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload as T;
}

export default function Home() {
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [profileJson, setProfileJson] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [resumeApproved, setResumeApproved] = useState(false);
  const [finalApproved, setFinalApproved] = useState(false);
  const [confirmationUrl, setConfirmationUrl] = useState("");
  const [confirmationEvidence, setConfirmationEvidence] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formUrl, setFormUrl] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [reviewHash, setReviewHash] = useState<string | null>(null);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>("resume_draft");
  const [nextAction, setNextAction] = useState("Review the generated resume PDF.");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const refreshProfile = () => api<ProfileStatus>("/api/profile/status").then(setProfile).catch((error) => setMessage(error.message));
  useEffect(() => { refreshProfile(); api<AIStatus>("/api/ai/status").then(setAiStatus).catch(() => setAiStatus(null)); }, []);

  async function analyze() {
    setWorking(true); setMessage(""); setAiSuggestions(null); setResume(null); setResumeApproved(false); setFinalApproved(false); setPreviewUrl(null); setFields([]);
    try { const result = await api<{ job: Job; warning: string | null }>("/api/jobs/analyze", { sourceUrl, description }); setJob(result.job); setMessage(result.warning ?? "Job analyzed locally."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Analysis failed."); } finally { setWorking(false); }
  }
  async function importProfile() {
    setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/profile/import", JSON.parse(profileJson)); setMessage(result.message); setProfileJson(""); await refreshProfile(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Profile import failed. Check that the JSON is valid."); } finally { setWorking(false); }
  }
  async function generate() {
    if (!job) return; setWorking(true); setMessage("");
    try { const result = await api<{ record: Resume; previewUrl: string }>("/api/resumes/generate", job); setResume(result.record); setPreviewUrl(result.previewUrl); setMessage("PDF draft generated. Review the exact preview."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Resume generation failed."); } finally { setWorking(false); }
  }
  async function generateAISuggestions() {
    if (!job) return; setWorking(true); setMessage("");
    try { const result = await api<{ suggestions: string; message: string }>("/api/ai/tailor", job); setAiSuggestions(result.suggestions); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Local AI suggestions unavailable."); } finally { setWorking(false); }
  }
  async function approveResume() {
    if (!resume) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/resumes/approve", { applicationId: resume.applicationId, contentHash: resume.contentHash, approval: "APPROVE_RESUME" }); setResumeApproved(true); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Resume approval failed."); } finally { setWorking(false); }
  }
  async function uploadApprovedResume() {
    if (!resume || !formUrl || !resumeApproved) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/forms/upload", { applicationId: resume.applicationId, url: formUrl, resumeHash: resume.contentHash, approval: "UPLOAD_APPROVED_RESUME" }); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Resume upload failed."); } finally { setWorking(false); }
  }
  async function inspectForm() {
    if (!resume || !formUrl) return; setWorking(true); setMessage("");
    try { await api<{ message: string }>("/api/browser/open", { url: formUrl }); const result = await api<{ fields: Field[]; adapter: { label: string; supported: boolean; notes: string }; review: { reviewHash: string } }>("/api/forms/inspect", { url: formUrl, applicationId: resume.applicationId, resumeHash: resume.contentHash }); setFields(result.fields); setReviewHash(result.review.reviewHash); setMessage(`Manual browser session opened. Form inspected (${result.adapter.label}). ${result.adapter.notes} No values were entered.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Form inspection failed."); } finally { setWorking(false); }
  }
  async function saveFieldReview() {
    if (!resume || !fields.length) return; setWorking(true); setMessage("");
    try { const result = await api<{ reviewHash: string; message: string }>("/api/forms/review", { applicationId: resume.applicationId, fields, coverLetter: "" }); setReviewHash(result.reviewHash); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Field review save failed."); } finally { setWorking(false); }
  }
  async function fillVerified() {
    if (!resume || !formUrl) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string; reviewHash: string; result: { filled: string[]; verified: Array<{ label: string; value: string }>; skipped: number } }>("/api/forms/fill", { applicationId: resume.applicationId, url: formUrl }); setReviewHash(result.reviewHash); setFields((current) => current.map((field) => result.result.verified.some((item) => item.label === field.field_label) ? { ...field, status: "filled_verified", reason: "Browser value matched after filling." } : field)); setMessage(`${result.message} Verified: ${result.result.verified.map((item) => `${item.label}=${item.value}`).join(", ") || "none"}. Skipped: ${result.result.skipped}.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Safe fill failed."); } finally { setWorking(false); }
  }
  async function approveSubmission() {
    if (!resume || !reviewHash) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/applications/approve", { applicationId: resume.applicationId, reviewHash, approval: "APPROVE_SUBMISSION" }); setFinalApproved(true); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Final approval failed."); } finally { setWorking(false); }
  }
  async function submitAfterApproval() {
    if (!resume || !reviewHash || !finalApproved || !formUrl) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/applications/submit", { applicationId: resume.applicationId, url: formUrl, reviewHash, confirmation: "SUBMIT_AFTER_FINAL_APPROVAL" }); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Submission blocked."); } finally { setWorking(false); }
  }
  async function recordConfirmation() {
    if (!resume || !confirmationEvidence.trim()) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/applications/confirmation", { applicationId: resume.applicationId, confirmationUrl, evidenceText: confirmationEvidence, referenceNumber }); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Confirmation evidence failed."); } finally { setWorking(false); }
  }
  async function updateTracker() {
    if (!resume) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/applications/status", { applicationId: resume.applicationId, status: trackerStatus, nextAction }); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Tracker update failed."); } finally { setWorking(false); }
  }

  function updateField(index: number, patch: Partial<Field>) { setFields((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field)); setReviewHash(null); }
  const unresolved = fields.filter((field) => ["needs_user_input", "proposed_for_review", "blocked"].includes(field.status)).length;
  const safeFields = fields.filter((field) => field.status === "verified_autofill" && field.risk === "low").length;
  const progressStep = resume ? 4 : job ? 3 : profile?.ready ? 2 : 1;

  return <main className="shell">
    <div className="eyebrow">Your private job application workspace</div>
    <h1>Let’s prepare your application</h1>
    <p className="subtle">You only need to do one step at a time. The app explains the job, creates a resume preview, and asks before anything is uploaded or submitted.</p>
    <div className="welcome card"><div><strong>You are on step {progressStep} of 4</strong><p className="small">{progressStep === 1 ? "First, add or check your personal profile." : progressStep === 2 ? "Next, paste the job link or description." : progressStep === 3 ? "Review what the job asks for before making a resume." : "Review your PDF and choose what happens next."}</p></div><div className="progress" aria-label={`Step ${progressStep} of 4`}><span className={progressStep >= 1 ? "active" : ""} /><span className={progressStep >= 2 ? "active" : ""} /><span className={progressStep >= 3 ? "active" : ""} /><span className={progressStep >= 4 ? "active" : ""} /></div></div>
    {message && <p className={`notice ${message.toLowerCase().includes("blocked") || message.toLowerCase().includes("failed") ? "warning" : ""}`}>{message}</p>}
    <div className="grid"><section>
      <div className="card"><h2>Step 1: Check your profile</h2><p className="helper">This is the source of truth for your resume. We never invent missing facts.</p>{profile?.ready ? <div className="notice success"><strong>{profile.summary?.name}</strong> is ready. {profile.summary?.conflicts.length ? `Resolve ${profile.summary.conflicts.length} profile question(s) before creating a resume.` : "You can continue to a job."}</div> : <div className="notice warning">Your profile is not loaded yet. Import the JSON from your Resume Project below.</div>}<div className="actions"><button className="secondary" onClick={refreshProfile}>Check profile again</button></div><details><summary>Import or replace my profile</summary><p className="small">Choose the JSON file you received from your one-time Resume Project handoff.</p><input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) file.text().then(setProfileJson); }} /><textarea value={profileJson} onChange={(event) => setProfileJson(event.target.value)} placeholder='Paste profile JSON here if you do not have a file' /><div className="actions"><button className="secondary" disabled={working || !profileJson.trim()} onClick={importProfile}>Save my profile</button><a className="secondary" href="/profile-template.json" target="_blank" rel="noreferrer">View example</a></div></details><details><summary>Why do I need this?</summary><p className="small">The profile lets the app use your real skills and experience without claiming anything you have not confirmed.</p></details></div>
      <div className="card"><h2>Step 2: Add the job</h2><p className="helper">Paste a careers link, or paste the job description if the website blocks access.</p><label htmlFor="url">Job link</label><input id="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://company.com/careers/job/..." /><label htmlFor="description">Job description <span className="small">(optional if link works)</span></label><textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Paste the text from the job page here..." /><div className="actions"><button className="primary" disabled={working || (!sourceUrl && !description)} onClick={analyze}>{working ? "Reading the job…" : "Understand this job"}</button></div></div>
      {job && <div className="card"><h2>Step 3: Understand the job</h2><p className="helper">Green rows have evidence in your profile. “Unknown” means we will not claim it.</p><p><strong>{job.role ?? "Role not identified"}</strong>{job.company ? ` at ${job.company}` : ""}{job.location ? ` · ${job.location}` : ""}</p><table className="table"><thead><tr><th>What they ask for</th><th>What your profile proves</th></tr></thead><tbody>{job.evidence.map((item) => <tr key={item.requirement}><td>{item.requirement}</td><td>{item.evidence.length ? item.evidence.join("; ") : <span className="small">Not found — this will not be claimed.</span>}</td></tr>)}</tbody></table><div className="actions"><button className="secondary" disabled={working || !aiStatus?.available} onClick={generateAISuggestions}>Get free AI suggestions</button><button className="primary" disabled={working || !profile?.ready || Boolean(profile.summary?.conflicts.length)} onClick={generate}>Create my PDF resume</button></div>{aiSuggestions && <><h3>Suggestions to review</h3><pre className="small">{aiSuggestions}</pre><p className="small">Nothing changes in your resume until you review it.</p></>}</div>}
    </section><aside>
      <div className="card"><h2>AI provider</h2>{aiStatus?.available ? <div className="notice success">Free local Ollama model ready: {aiStatus.model}.</div> : <div className="notice warning">{aiStatus?.message ?? "Checking local AI provider…"}</div>}<p className="small">OpenAI is optional. The deterministic workflow works without any API key.</p></div>
      <div className="card"><h2>Safety gates</h2><ol className="list"><li>Validated local profile.</li><li>Exact PDF preview and resume approval.</li><li>Form inspection and field review.</li><li>Verified safe fill with audit trail.</li><li>Separate final application approval.</li><li>Submit click requires explicit environment opt-in.</li></ol><p className="small">Upload is approval-gated. Submit is disabled by default.</p></div>
      {resume && <>
        <div className="card"><h2>Application tracker</h2><p className="small">Track this application locally; this does not upload or submit anything.</p><p><a className="secondary" href={`/applications/${resume.applicationId}`}>Open tracker dashboard</a></p><label htmlFor="tracker-status">Status</label><select id="tracker-status" value={trackerStatus} onChange={(event) => setTrackerStatus(event.target.value as TrackerStatus)}><option value="resume_draft">Resume draft</option><option value="resume_approved">Resume approved</option><option value="form_in_progress">Form in progress</option><option value="needs_user_input">Needs user input</option><option value="ready_for_review">Ready for review</option><option value="confirmation_unverified">Confirmation unverified</option><option value="blocked">Blocked</option></select><label htmlFor="next-action">Next action</label><input id="next-action" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="What should happen next?" /><div className="actions"><button className="secondary" disabled={working || !nextAction.trim()} onClick={updateTracker}>Update tracker</button></div></div>
        <div className="card"><h2>4. Resume approval</h2><p className="small"><strong>{resume.fileName}</strong></p><p className="mono">Version {resume.version}<br />SHA-256 {resume.contentHash}</p><ul className="list">{resume.changeSummary.map((change) => <li key={change}>{change}</li>)}</ul>{previewUrl && <><iframe title="Resume PDF preview" src={previewUrl} /><div className="actions"><a className="secondary" href={previewUrl} target="_blank" rel="noreferrer">Open PDF</a><button className="primary" disabled={working} onClick={approveResume}>Approve this resume</button></div></>}<p className="small">Version-specific approval only. It never authorizes submission.</p></div>
        <div className="card"><h2>5. Application form review</h2><p className="small">Login, MFA, OTP, CAPTCHA, and sensitive questions require manual handling.</p><label htmlFor="form-url">Application form URL</label><input id="form-url" value={formUrl} onChange={(event) => setFormUrl(event.target.value)} placeholder="https://careers.example.com/apply/..." /><div className="actions"><button className="secondary" disabled={working || !formUrl} onClick={inspectForm}>Inspect visible fields</button><button className="secondary" disabled={working || !formUrl || !resumeApproved} onClick={uploadApprovedResume}>Upload approved resume</button></div>{fields.length > 0 && <><p className="small">Verified safe fields ready: {safeFields}. Unresolved fields: {unresolved}.</p><table className="table"><thead><tr><th>Field</th><th>Decision</th></tr></thead><tbody>{fields.map((field, index) => <tr key={`${field.field_label}-${field.field_type}`}><td>{field.field_label}<br /><span className="small">{field.field_type}{field.available_options.length ? `: ${field.available_options.join(", ")}` : ""}</span></td><td><select value={field.status} onChange={(event) => updateField(index, { status: event.target.value })}><option value="needs_user_input">Needs my input</option><option value="verified_autofill">Verified autofill</option><option value="proposed_for_review">Proposed for review</option><option value="not_applicable">Not applicable</option><option value="blocked">Blocked</option></select><input value={field.proposed_value ?? ""} onChange={(event) => updateField(index, { proposed_value: event.target.value || null })} placeholder="Proposed answer" /><span className="small">{field.reason}</span></td></tr>)}</tbody></table><div className="actions"><button className="secondary" disabled={working || !reviewHash} onClick={saveFieldReview}>Save field decisions</button><button className="secondary" disabled={working || !reviewHash || safeFields === 0} onClick={fillVerified}>Fill verified fields</button><button className="primary" disabled={working || unresolved > 0 || !reviewHash} onClick={approveSubmission}>Approve final application</button><button className="primary" disabled={working || !finalApproved || !reviewHash || !formUrl} onClick={submitAfterApproval}>Submit after final approval</button></div><p className="small">Review hash: <span className="mono">{reviewHash ?? "unsaved changes"}</span><br />Safe fill never uploads or submits. Upload is enabled only after separate resume approval. Submit also requires explicit environment opt-in.</p></>}</div>
        <div className="card"><h2>6. Confirmation evidence</h2><p className="small">After you observe a confirmation page or email, record the exact evidence manually. The app never assumes success.</p><label htmlFor="confirmation-url">Confirmation URL (optional)</label><input id="confirmation-url" value={confirmationUrl} onChange={(event) => setConfirmationUrl(event.target.value)} placeholder="https://careers.example.com/confirmation/..." /><label htmlFor="reference-number">Reference number (optional)</label><input id="reference-number" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Application reference" /><label htmlFor="confirmation-evidence">Observed evidence</label><textarea id="confirmation-evidence" value={confirmationEvidence} onChange={(event) => setConfirmationEvidence(event.target.value)} placeholder="Paste the confirmation message or describe what you observed..." /><div className="actions"><button className="secondary" disabled={working || confirmationEvidence.trim().length < 3} onClick={recordConfirmation}>Record confirmation evidence</button></div></div>
      </>}
    </aside></div>
  </main>;
}
