"use client";

import { useEffect, useState } from "react";

type ProfileStatus = { ready: boolean; errors: string[]; summary: { name: string; lastVerified: string; conflicts: string[] } | null };
type Job = { id: string; company: string | null; role: string | null; location: string | null; evidence: { requirement: string; evidence: string[] }[] };
type Resume = { applicationId: string; fileName: string; contentHash: string; version: string; changeSummary: string[] };
type Field = { field_label: string; field_type: string; available_options: string[]; proposed_value: string | null; status: string; reason: string; risk?: string };
type TrackerStatus = "resume_draft" | "resume_approved" | "form_in_progress" | "needs_user_input" | "ready_for_review" | "confirmation_unverified" | "blocked";

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload as T;
}

export default function Home() {
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formUrl, setFormUrl] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [reviewHash, setReviewHash] = useState<string | null>(null);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>("resume_draft");
  const [nextAction, setNextAction] = useState("Review the generated resume PDF.");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const refreshProfile = () => api<ProfileStatus>("/api/profile/status").then(setProfile).catch((error) => setMessage(error.message));
  useEffect(() => { refreshProfile(); }, []);

  async function analyze() {
    setWorking(true); setMessage(""); setResume(null); setPreviewUrl(null); setFields([]);
    try { const result = await api<{ job: Job; warning: string | null }>("/api/jobs/analyze", { sourceUrl, description }); setJob(result.job); setMessage(result.warning ?? "Job analyzed locally."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Analysis failed."); } finally { setWorking(false); }
  }
  async function generate() {
    if (!job) return; setWorking(true); setMessage("");
    try { const result = await api<{ record: Resume; previewUrl: string }>("/api/resumes/generate", job); setResume(result.record); setPreviewUrl(result.previewUrl); setMessage("PDF draft generated. Review the exact preview."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Resume generation failed."); } finally { setWorking(false); }
  }
  async function approveResume() {
    if (!resume) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/resumes/approve", { applicationId: resume.applicationId, contentHash: resume.contentHash, approval: "APPROVE_RESUME" }); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Resume approval failed."); } finally { setWorking(false); }
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
    try { const result = await api<{ message: string }>("/api/applications/approve", { applicationId: resume.applicationId, reviewHash, approval: "APPROVE_SUBMISSION" }); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Final approval failed."); } finally { setWorking(false); }
  }
  async function updateTracker() {
    if (!resume) return; setWorking(true); setMessage("");
    try { const result = await api<{ message: string }>("/api/applications/status", { applicationId: resume.applicationId, status: trackerStatus, nextAction }); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Tracker update failed."); } finally { setWorking(false); }
  }

  function updateField(index: number, patch: Partial<Field>) { setFields((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field)); setReviewHash(null); }
  const unresolved = fields.filter((field) => ["needs_user_input", "proposed_for_review", "blocked"].includes(field.status)).length;
  const safeFields = fields.filter((field) => field.status === "verified_autofill" && field.risk === "low").length;

  return <main className="shell">
    <div className="eyebrow">Local-only • Review-first • No blind submission</div>
    <h1>Personal Job Application Agent</h1>
    <p className="subtle">Analyze a role, generate a truthful PDF draft, inspect an application form, fill only verified low-risk fields, and keep final submission separately gated.</p>
    {message && <p className={`notice ${message.toLowerCase().includes("blocked") || message.toLowerCase().includes("failed") ? "warning" : ""}`}>{message}</p>}
    <div className="grid"><section>
      <div className="card"><h2>1. Profile Pack status</h2>{profile?.ready ? <div className="notice success"><strong>{profile.summary?.name}</strong> - verified {profile.summary?.lastVerified}. {profile.summary?.conflicts.length ? `Blocked by ${profile.summary.conflicts.length} unresolved conflict(s).` : "Ready for evidence-backed drafting."}</div> : <div className="notice warning">Profile Pack not installed. Job analysis works, but resume drafting stays blocked.</div>}<div className="actions"><button className="secondary" onClick={refreshProfile}>Recheck local profile</button></div></div>
      <div className="card"><h2>2. Analyze a job</h2><label htmlFor="url">Job URL</label><input id="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://careers.example.com/jobs/..." /><label htmlFor="description">Job description</label><textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Paste the complete job description here..." /><div className="actions"><button className="primary" disabled={working || (!sourceUrl && !description)} onClick={analyze}>{working ? "Working…" : "Analyze job"}</button></div></div>
      {job && <div className="card"><h2>3. Job evidence review</h2><p><strong>{job.role ?? "Role not identified"}</strong>{job.company ? ` at ${job.company}` : ""}{job.location ? ` · ${job.location}` : ""}</p><table className="table"><thead><tr><th>Requirement</th><th>Evidence</th></tr></thead><tbody>{job.evidence.map((item) => <tr key={item.requirement}><td>{item.requirement}</td><td>{item.evidence.length ? item.evidence.join("; ") : <span className="small">Unknown - will not be claimed.</span>}</td></tr>)}</tbody></table><div className="actions"><button className="primary" disabled={working || !profile?.ready} onClick={generate}>Generate PDF draft</button></div></div>}
    </section><aside>
      <div className="card"><h2>Safety gates</h2><ol className="list"><li>Validated local profile.</li><li>Exact PDF preview and resume approval.</li><li>Form inspection and field review.</li><li>Verified safe fill with audit trail.</li><li>Separate final application approval.</li></ol><p className="small">Upload and Submit remain disabled.</p></div>
      {resume && <>
        <div className="card"><h2>Application tracker</h2><p className="small">Track this application locally; this does not upload or submit anything.</p><p><a className="secondary" href={`/applications/${resume.applicationId}`}>Open tracker dashboard</a></p><label htmlFor="tracker-status">Status</label><select id="tracker-status" value={trackerStatus} onChange={(event) => setTrackerStatus(event.target.value as TrackerStatus)}><option value="resume_draft">Resume draft</option><option value="resume_approved">Resume approved</option><option value="form_in_progress">Form in progress</option><option value="needs_user_input">Needs user input</option><option value="ready_for_review">Ready for review</option><option value="confirmation_unverified">Confirmation unverified</option><option value="blocked">Blocked</option></select><label htmlFor="next-action">Next action</label><input id="next-action" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="What should happen next?" /><div className="actions"><button className="secondary" disabled={working || !nextAction.trim()} onClick={updateTracker}>Update tracker</button></div></div>
        <div className="card"><h2>4. Resume approval</h2><p className="small"><strong>{resume.fileName}</strong></p><p className="mono">Version {resume.version}<br />SHA-256 {resume.contentHash}</p><ul className="list">{resume.changeSummary.map((change) => <li key={change}>{change}</li>)}</ul>{previewUrl && <><iframe title="Resume PDF preview" src={previewUrl} /><div className="actions"><a className="secondary" href={previewUrl} target="_blank" rel="noreferrer">Open PDF</a><button className="primary" disabled={working} onClick={approveResume}>Approve this resume</button></div></>}<p className="small">Version-specific approval only. It never authorizes submission.</p></div>
        <div className="card"><h2>5. Application form review</h2><p className="small">Login, MFA, OTP, CAPTCHA, and sensitive questions require manual handling.</p><label htmlFor="form-url">Application form URL</label><input id="form-url" value={formUrl} onChange={(event) => setFormUrl(event.target.value)} placeholder="https://careers.example.com/apply/..." /><div className="actions"><button className="secondary" disabled={working || !formUrl} onClick={inspectForm}>Inspect visible fields</button></div>{fields.length > 0 && <><p className="small">Verified safe fields ready: {safeFields}. Unresolved fields: {unresolved}.</p><table className="table"><thead><tr><th>Field</th><th>Decision</th></tr></thead><tbody>{fields.map((field, index) => <tr key={`${field.field_label}-${field.field_type}`}><td>{field.field_label}<br /><span className="small">{field.field_type}{field.available_options.length ? `: ${field.available_options.join(", ")}` : ""}</span></td><td><select value={field.status} onChange={(event) => updateField(index, { status: event.target.value })}><option value="needs_user_input">Needs my input</option><option value="verified_autofill">Verified autofill</option><option value="proposed_for_review">Proposed for review</option><option value="not_applicable">Not applicable</option><option value="blocked">Blocked</option></select><input value={field.proposed_value ?? ""} onChange={(event) => updateField(index, { proposed_value: event.target.value || null })} placeholder="Proposed answer" /><span className="small">{field.reason}</span></td></tr>)}</tbody></table><div className="actions"><button className="secondary" disabled={working || !reviewHash} onClick={saveFieldReview}>Save field decisions</button><button className="secondary" disabled={working || !reviewHash || safeFields === 0} onClick={fillVerified}>Fill verified fields</button><button className="primary" disabled={working || unresolved > 0 || !reviewHash} onClick={approveSubmission}>Approve final application</button></div><p className="small">Review hash: <span className="mono">{reviewHash ?? "unsaved changes"}</span><br />Safe fill never uploads or submits.</p></>}</div>
      </>}
    </aside></div>
  </main>;
}
