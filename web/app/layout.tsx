import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Classroom MIS Forms",
  description: "Public forms and admin builder for Classroom MIS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
