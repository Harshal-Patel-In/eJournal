import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Providers } from "./providers";
import { LiquidTooltipProvider } from "@/components/ui/liquid-tooltip";
import { GlobalAnnouncementBanner } from "@/components/announcement-banner";
import { MobileBottomDock } from "@/components/navigation/mobile-bottom-dock";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "eJournal — Academic Journal & Lab Review System",
  description: "Archival Document & Laboratory Evaluation Platform for structured scientific journals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${firaCode.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-foreground"
        suppressHydrationWarning
      >
        <Providers>
          <GlobalAnnouncementBanner />
          {children}
          <MobileBottomDock />
          <LiquidTooltipProvider />
        </Providers>
      </body>
    </html>
  );
}
