import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./TrustPage.module.css";

type TrustPageProps = Readonly<{
  eyebrow: string;
  title: string;
  introduction: string;
  lastReviewed?: string;
  contents: readonly Readonly<{ id: string; label: string }>[];
  children: ReactNode;
}>;

export function TrustPage({
  eyebrow,
  title,
  introduction,
  lastReviewed = "6 August 2026",
  contents,
  children,
}: TrustPageProps) {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroIndex} aria-hidden="true">
          Trust record
        </div>
        <div className={styles.heroCopy}>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className={styles.heroAside}>
          <p>{introduction}</p>
          <dl>
            <div>
              <dt>Operator</dt>
              <dd>Emmanuel Kingsford Owusu</dd>
            </div>
            <div>
              <dt>Working name</dt>
              <dd>kingXford &amp; Co</dd>
            </div>
            <div>
              <dt>Last reviewed</dt>
              <dd>{lastReviewed}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className={styles.document}>
        <nav className={styles.contents} aria-label={`${title} contents`}>
          <p className="eyebrow">On this page</p>
          <ol>
            {contents.map((item, index) => (
              <li key={item.id}>
                <Link href={`#${item.id}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <article className={styles.body}>{children}</article>
      </div>

      <nav className={styles.related} aria-label="Trust and legal pages">
        <p className="eyebrow">Related records</p>
        <div>
          {[
            ["/privacy", "Privacy"],
            ["/terms", "Terms"],
            ["/accessibility", "Accessibility"],
            ["/ai-transparency", "AI transparency"],
          ].map(([href, label]) => (
            <Link href={href} key={href}>
              <span>{label}</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}

export function TrustSection({
  id,
  title,
  children,
}: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section className={styles.section} id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
      <Link className={styles.backLink} href="#main-content">
        Back to top
      </Link>
    </section>
  );
}

export function TrustCallout({ children }: Readonly<{ children: ReactNode }>) {
  return <aside className={styles.callout}>{children}</aside>;
}
