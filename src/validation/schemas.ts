import { z } from "zod";

export const FactStatusSchema = z.enum(["verified", "unknown", "needs_confirmation"]);

export const ProfileItemSchema = z.object({
  title: z.string().min(1),
  organization: z.string().optional(),
  date_range: z.string().optional(),
  description: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  source: z.string().optional(),
  status: FactStatusSchema.default("verified"),
});

export const MasterProfileSchema = z.object({
  schema_version: z.string().min(1),
  last_verified: z.string().min(1),
  identity: z.object({
    full_name: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().min(1),
    location: z.string().min(1),
    links: z.array(z.string()).default([]),
  }),
  summary: z.string().min(1),
  education: z.array(ProfileItemSchema).default([]),
  experience: z.array(ProfileItemSchema).default([]),
  projects: z.array(ProfileItemSchema).default([]),
  skills: z.array(z.string()).default([]),
  preferences: z.record(z.string(), z.unknown()).default({}),
  conflicts: z.array(z.string()).default([]),
  source_resumes: z.array(z.string()).default([]),
});

export type MasterProfile = z.infer<typeof MasterProfileSchema>;

export const JobInputSchema = z.object({
  sourceUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().trim().max(50_000).optional().or(z.literal("")),
}).refine((value) => Boolean(value.sourceUrl || value.description), {
  message: "Provide a job URL or paste the job description.",
});

export const JobAnalysisSchema = z.object({
  id: z.string(),
  sourceUrl: z.string().nullable(),
  company: z.string().nullable(),
  role: z.string().nullable(),
  location: z.string().nullable(),
  employmentType: z.string().nullable(),
  description: z.string().min(1),
  requirements: z.array(z.string()),
  evidence: z.array(z.object({
    requirement: z.string(),
    evidence: z.array(z.string()),
    status: z.enum(["supported", "unknown"]),
  })),
  analyzedAt: z.string(),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export const ResumeRecordSchema = z.object({
  applicationId: z.string(),
  fileName: z.string(),
  htmlPath: z.string(),
  pdfPath: z.string(),
  contentHash: z.string(),
  version: z.string(),
  changeSummary: z.array(z.string()),
  generatedAt: z.string(),
});

export const FieldRecordSchema = z.object({
  field_label: z.string(),
  field_type: z.string(),
  available_options: z.array(z.string()),
  proposed_value: z.string().nullable(),
  source: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  risk: z.enum(["low", "medium", "high"]),
  status: z.enum(["verified_autofill", "proposed_for_review", "needs_user_input", "not_applicable", "filled_verified", "blocked"]),
  reason: z.string(),
});

export const ApprovalRequestSchema = z.object({
  applicationId: z.string().min(1),
  contentHash: z.string().min(1),
  approval: z.literal("APPROVE_RESUME"),
});

export const FinalApprovalRequestSchema = z.object({
  applicationId: z.string().min(1),
  reviewHash: z.string().min(1),
  approval: z.literal("APPROVE_SUBMISSION"),
});

export const ApplicationReviewSchema = z.object({
  applicationId: z.string().min(1),
  resumeHash: z.string().min(1),
  fields: z.array(FieldRecordSchema),
  coverLetter: z.string().default(""),
  reviewHash: z.string().min(1),
  createdAt: z.string(),
});

export type ApplicationReview = z.infer<typeof ApplicationReviewSchema>;
