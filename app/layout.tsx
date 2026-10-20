import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "할 일 관리",
  description: "1년 목표 → 주간 계획 → 일일 할 일",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col">
        <Nav />
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
