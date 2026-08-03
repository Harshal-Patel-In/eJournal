import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24 bg-background">
      <main className="flex flex-col items-center justify-center text-center max-w-2xl gap-8">
        {/* App Logo & Branding */}
        <div className="flex flex-col items-center gap-3 select-none">
          <img
            src="/logo.png"
            alt="eJournal Platform"
            className="h-20 w-auto object-contain"
          />
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
            eJournal
          </h1>
          <p className="text-xl text-muted-foreground">
            Academic Document Platform & Review System
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left w-full mt-6">
          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="font-semibold text-lg">Block-Based Editor</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Construct journals with independent drag-and-drop structural elements.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="font-semibold text-lg">Visual Math System</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create equations visually with automatic LaTeX and KaTeX rendering.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="font-semibold text-lg">Review Annotations</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Inline threaded comments and suggestion cards for teachers.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <h3 className="font-semibold text-lg">Version Control</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Restore and audit revisions using a Hybrid Snapshot + Delta model.
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          <Button asChild size="lg" className="px-8">
            <Link href="/auth/login">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-8">
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

