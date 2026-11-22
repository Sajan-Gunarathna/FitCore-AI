import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { GymProvider } from "@/context/gym-context";
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
  title: "FitCore AI — Commercial SaaS Gym Management & AI Fitness Platform",
  description: "Multi-tenant, AI-powered fitness and gym management SaaS platform built with FastAPI, Supabase, and Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-[#090D12] text-[#F8FAFC] antialiased">
        <AuthProvider>
          <GymProvider>{children}</GymProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
