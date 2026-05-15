import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WarungPilot AI",
  description:
    "Autonomous commerce operations agent for Indonesian SMEs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

