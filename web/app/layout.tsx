import type { Metadata } from "next";
import { JetBrains_Mono, Public_Sans, Vollkorn } from "next/font/google";
import "./globals.css";

const sans = Public_Sans({
  variable: "--font-sans-var",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const display = Vollkorn({
  variable: "--font-display-var",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "PO Automation — BuildCo Infra",
  description: "Vendor invoice extraction and review",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
