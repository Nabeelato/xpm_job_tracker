import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TI Job Management System",
  description: "Internal job tracking for accounting and audit teams",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
