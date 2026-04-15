import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "RegInspector — مُفتِّش الأنظمة",
  description:
    "Regulatory Intelligence Platform for Saudi Banks — منصة الذكاء التنظيمي للبنوك السعودية",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-white text-kpmg-dark`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
