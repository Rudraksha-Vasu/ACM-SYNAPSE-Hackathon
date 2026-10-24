import type { Metadata } from "next";
export const metadata: Metadata = { title: "PhishGuard · ACM SYNAPSE", description: "Inspect suspicious links and emails, prepare a clearer email draft, and find practical next steps after a suspicious interaction." };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
