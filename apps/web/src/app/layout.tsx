import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "ClipFork — Fork any viral. Ship your version.",
  description:
    "AI-powered viral structure cloning platform for UGC video automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-[#FAFAFA] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
