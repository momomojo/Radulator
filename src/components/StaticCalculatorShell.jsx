import React from "react";

function getStaticPageData() {
  if (typeof window === "undefined") return null;
  return window.__RADULATOR_STATIC_PAGE__ || null;
}

export default function StaticCalculatorShell({ data = getStaticPageData() }) {
  if (!data) return null;

  const refs = Array.isArray(data.refs) ? data.refs : [];
  const related = Array.isArray(data.related) ? data.related : [];

  return (
    <main
      id="main-content"
      data-testid="static-calculator-shell"
      aria-labelledby="static-calculator-heading"
      className="min-h-screen bg-background px-4 py-8 text-foreground md:px-8"
    >
      <article className="mx-auto max-w-4xl space-y-8">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <a href="/" className="hover:text-foreground hover:underline">
                Radulator
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li>{data.category}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">
              {data.title}
            </li>
          </ol>
        </nav>

        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            {data.category}
          </p>
          <h1
            id="static-calculator-heading"
            className="text-3xl font-bold tracking-normal text-foreground md:text-4xl"
          >
            {data.title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            {data.description}
          </p>
        </header>

        {refs.length > 0 && (
          <section
            aria-labelledby="static-references-heading"
            className="rounded-lg border border-border bg-muted/30 p-5"
          >
            <h2
              id="static-references-heading"
              className="text-lg font-semibold text-foreground"
            >
              References
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {refs.map((ref) => (
                <li key={ref.u}>
                  <a
                    href={ref.u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {ref.t}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}

        {related.length > 0 && (
          <section
            aria-labelledby="static-related-heading"
            className="rounded-lg border border-border bg-card p-5"
          >
            <h2
              id="static-related-heading"
              className="text-lg font-semibold text-foreground"
            >
              Related calculators
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {related.map((calc) => (
                <li key={calc.id}>
                  <a
                    href={`/calculators/${calc.id}/`}
                    className="block rounded-md border border-border px-3 py-2 text-sm font-medium text-primary hover:bg-muted hover:underline"
                  >
                    {calc.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </main>
  );
}
