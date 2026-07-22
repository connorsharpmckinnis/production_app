import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  aboutContent,
  ABOUT_FEEDBACK_EMAIL,
  feedbackMailtoHref,
} from "@/aboutContent";

export default function AboutPage() {
  const { appDetails, currentState, futureState } = aboutContent;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">About the App</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What this is, what works today, and where I want it to go.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{appDetails.title}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Version
            </dt>
            <dd className="mt-1 font-medium">{appDetails.version}</dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Author
            </dt>
            <dd className="mt-1 font-medium">{appDetails.author}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">{appDetails.purpose}</p>
        <div>
          <h3 className="text-sm font-medium">Stack</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {appDetails.stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium">Critical settings</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {appDetails.criticalSettings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{currentState.title}</h2>
        <p className="text-sm text-muted-foreground">{currentState.intro}</p>
        <div>
          <h3 className="text-sm font-medium">What works</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {currentState.whatWorks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium">How to use it</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {currentState.howToUse.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{futureState.title}</h2>
        <p className="text-sm text-muted-foreground">{futureState.intro}</p>
        <div className="space-y-5">
          {futureState.sections.map((section) => (
            <div key={section.heading}>
              <h3 className="text-sm font-medium">{section.heading}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            Prefer the in-app form: open your name in the header and choose{" "}
            <span className="font-medium text-foreground">Send feedback</span> (bug or
            idea). Or email{" "}
            <span className="font-medium text-foreground">{ABOUT_FEEDBACK_EMAIL}</span>.
          </p>
          <Button asChild className="mt-3" variant="outline">
            <a href={feedbackMailtoHref()}>
              <Mail />
              Email me
            </a>
          </Button>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Content for this page lives in{" "}
        <code className="rounded bg-muted px-1 py-0.5">frontend/src/aboutContent.ts</code>
        .
      </p>
    </div>
  );
}
