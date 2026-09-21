import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Providers } from "./providers";
import { LiquidGlassScrollbar } from "@/components/ui/liquid-glass-scrollbar";
import { LiquidTooltipProvider } from "@/components/ui/liquid-tooltip";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "eJournal — Journal Management & Review System",
  description: "Academic Document Platform for structured scientific journals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${firaCode.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <Providers>
          {children}
          <LiquidGlassScrollbar />
          <LiquidTooltipProvider />
        </Providers>
      </body>
    </html>
  );
}

