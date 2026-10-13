import { readFile } from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";
import { applicationRoot, fileExists } from "@/storage/files";


async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; } catch { return fallback; }
}

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9-]+$/.test(id)) notFound();
  const directory = path.join(applicationRoot, id);
  if (!(await fileExists(directory))) notFound();
  const status = await readJson<{ status?: string; nextAction?: string; updatedAt?: string }>(path.join(directory, "status.json"), {});
  const review = await readJson<{ reviewHash?: string; resumeHash?: string; fields?: Array<{ field_label: string; status: string; proposed_value: string | null }> }>(path.join(directory, "application-review.json"), {});
  const resume = await readJson<{ fileName?: string; version?: string; contentHash?: string }>(path.join(directory, "resume-record.json"), {});
  const confirmation = await readJson<{ status?: string; evidenceText?: string; referenceNumber?: string; verifiedAt?: string }>(path.join(directory, "confirmation.json"), {});
  const audit = (await readJson<string>(path.join(directory, "audit.jsonl"), "")).split(/\r?\n/).filter(Boolean).slice(-20).reverse().map((line) => { try { return JSON.parse(line) as { action: string; createdAt: string; details: Record<string, unknown> }; } catch { return null; } }).filter(Boolean);
  return <main className="shell"><div className="eyebrow">Application tracker</div><h1>{id}</h1><p className="subtle">Local audit view. This page reports recorded evidence and does not submit anything.</p><div className="grid"><section><div className="card"><h2>Current status</h2><p><strong>{status.status ?? "unknown"}</strong></p><p className="small">Next action: {status.nextAction ?? "Not recorded"}<br />Updated: {status.updatedAt ?? "Not recorded"}</p></div><div className="card"><h2>Resume version</h2><p className="small">{resume.fileName ?? "No resume record"}</p><p className="mono">Version: {resume.version ?? "-"}<br />SHA-256: {resume.contentHash ?? "-"}</p></div><div className="card"><h2>Confirmation evidence</h2>{confirmation.status ? <><p><strong>{confirmation.status}</strong> on {confirmation.verifiedAt}</p><p>{confirmation.evidenceText}</p><p className="small">Reference: {confirmation.referenceNumber || "Not supplied"}</p></> : <p className="small">No confirmation evidence recorded. Do not claim success.</p>}</div></section><aside><div className="card"><h2>Form review</h2><p className="small">Review hash: <span className="mono">{review.reviewHash ?? "-"}</span></p><table className="table"><thead><tr><th>Field</th><th>Status</th><th>Value</th></tr></thead><tbody>{(review.fields ?? []).map((field) => <tr key={field.field_label}><td>{field.field_label}</td><td>{field.status}</td><td>{field.proposed_value ?? "-"}</td></tr>)}</tbody></table></div><div className="card"><h2>Audit history</h2>{audit.length ? <ul className="list">{audit.map((event, index) => <li key={`${event?.createdAt}-${index}`}><strong>{event?.action}</strong><br /><span className="small">{event?.createdAt}</span></li>)}</ul> : <p className="small">No audit events recorded yet.</p>}</div></aside></div></main>;
}
