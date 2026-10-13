import type { MasterProfile } from "@/validation/schemas";
import type { DetectedField } from "@/browser/form-inspector";

const text = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function classifyFields(fields: DetectedField[], profile: MasterProfile | null): DetectedField[] {
  return fields.map((field) => {
    const label = text(field.field_label);
    const sensitive = /authorization|sponsor|salary|compensation|relocat|notice|gender|race|ethnic|disab|veteran|criminal|background|legal|consent|resume|cv|upload|file|password|otp|captcha/.test(label);
    if (sensitive) return { ...field, confidence: 0, risk: "high", status: "needs_user_input", proposed_value: null, source: null, reason: "Sensitive or consequential question. The agent will not infer this answer." };
    if (!profile) return { ...field, confidence: 0, risk: "high", status: "needs_user_input", proposed_value: null, source: null, reason: "Verified Profile Pack is not available." };
    const match = label.match(/(?:^| )first name$/) ? profile.identity.full_name.split(/\s+/)[0] : label.match(/(?:^| )last name$/) ? profile.identity.full_name.split(/\s+/).slice(-1)[0] : /full name|^name$/.test(label) ? profile.identity.full_name : /e mail|email/.test(label) && profile.identity.email !== "UNKNOWN" ? profile.identity.email : /phone|mobile|telephone/.test(label) && profile.identity.phone !== "UNKNOWN" ? profile.identity.phone : /city|location|address/.test(label) && profile.identity.location !== "UNKNOWN" ? profile.identity.location : null;
    if (match && match !== "UNKNOWN") return { ...field, confidence: 1, risk: "low", status: "verified_autofill", proposed_value: match, source: "master-profile.json:identity", reason: "Exact value is present in the verified local Profile Pack." };
    return { ...field, confidence: 0, risk: "high", status: "needs_user_input", proposed_value: null, source: null, reason: "No exact verified profile value matches this field." };
  });
}
