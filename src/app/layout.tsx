import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Personal Job Application Agent", description: "Local-first, review-first job application workflow" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
