export type AdapterId = "greenhouse" | "lever" | "workday" | "generic";
export type AdapterInfo = { id: AdapterId; label: string; supported: boolean; notes: string };

export function fieldNameHints(adapter: AdapterId, label: string) {
  const value = label.toLowerCase();
  const hints = value.includes("first") ? ["first", "given"] : value.includes("last") ? ["last", "family", "surname"] : value.includes("email") ? ["email"] : value.includes("phone") ? ["phone", "mobile"] : value.includes("location") ? ["location", "city"] : [];
  if (adapter === "lever" && value === "name") return ["name"];
  if (adapter === "greenhouse" && value.includes("resume")) return ["resume", "cv"];
  return hints;
}

export function detectAdapter(url: string, pageText = ""): AdapterInfo {
  const value = `${url} ${pageText}`.toLowerCase();
  if (value.includes("greenhouse.io") || value.includes("boards.greenhouse")) return { id: "greenhouse", label: "Greenhouse", supported: true, notes: "Visible-field inspection and guarded basic-field filling are supported; verify each page manually." };
  if (value.includes("lever.co") || value.includes("jobs.lever")) return { id: "lever", label: "Lever", supported: true, notes: "Visible-field inspection is supported; site-specific conditional fields may need manual review." };
  if (value.includes("myworkdayjobs") || value.includes("workday")) return { id: "workday", label: "Workday", supported: false, notes: "Not enabled yet. Use manual application flow; do not bypass login, MFA, or anti-bot controls." };
  return { id: "generic", label: "Generic form", supported: false, notes: "Generic inspection only. No ATS-specific behavior is claimed." };
}
