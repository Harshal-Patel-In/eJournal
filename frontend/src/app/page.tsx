import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24 bg-background select-none">
      <main className="flex flex-col items-center justify-center text-center max-w-2xl gap-8">
        {/* App Logo & Branding */}
        <div className="flex flex-col items-center gap-2">
          <img
            src="/logo.png"
            alt="eJournal Platform"
            className="h-16 w-auto object-contain mb-2"
          />
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
            eJournal
          </h1>
          <p className="text-base text-muted-foreground">
            Academic Journal, Laboratory Review & Continuous Evaluation Platform
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left w-full mt-2">
          <div className="p-4 rounded-lg border border-border bg-card text-card-foreground shadow-2xs">
            <h3 className="font-semibold text-sm">Block-Based Document Editor</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Draft laboratory journals with independent structural code, tables, charts, and theory blocks.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card text-card-foreground shadow-2xs">
            <h3 className="font-semibold text-sm">Visual Mathematical System</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Formulate scientific derivations visually with automatic LaTeX and KaTeX rendering.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card text-card-foreground shadow-2xs">
            <h3 className="font-semibold text-sm">Teacher Review & Annotations</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Inline threaded reviews, criterion-based rubrics, and continuous evaluation marking.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card text-card-foreground shadow-2xs">
            <h3 className="font-semibold text-sm">NBA/NAAC Accreditation Dossier</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Automated continuous journal compilation, similarity verification, and portfolio ZIP export.
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          <Button asChild size="default" className="px-6">
            <Link href="/auth/login">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="default" className="px-6">
            <Link href="/auth/register">Student registration</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
