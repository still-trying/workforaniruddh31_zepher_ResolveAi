import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResolveAI",
  description: "Autonomous customer-resolution agent",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-zinc-900 dark:text-zinc-100 relative overflow-x-hidden">
        <div className="fixed inset-0 z-[-1] bg-zinc-50 dark:bg-zinc-950">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-400/30 dark:bg-emerald-500/25 rounded-full blur-[120px] animate-blob"></div>
          <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] bg-teal-400/30 dark:bg-teal-500/25 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-sky-400/30 dark:bg-sky-500/25 rounded-full blur-[120px] animate-blob animation-delay-4000"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        </div>
        {children}
      </body>
    </html>
  );
}
