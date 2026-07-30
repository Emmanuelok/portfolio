# Kingxford

Kingxford is a multidisciplinary creative company: three connected worlds for
bringing complex ideas into unforgettable form.

- **Studio** creates digital tools, web apps, websites, cinematography, motion,
  identities, and complete visual systems.
- **The Living Room** makes space for open-ended commissions, strategy,
  experiences, stories, and collaborations that do not fit a fixed category.
- **Lab** serves scientific and academic audiences through research platforms,
  data experiences, knowledge tools, and scientific communication.

The landing page uses a long native-scroll cinematic built from high-resolution
licensed documentary photography, clearly disclosed photoreal conceptual
editorial imagery, and the dominant Kingxford X-Frame. Conceptual imagery is
never presented as documentary evidence, a measured outcome, or literal product
UI. A purpose-built static composition preserves the full story for
reduced-motion visitors.

## Media

`/media` publishes Kingxford field notes, essays, briefings, and future
conversations. The first complete article is
`/media/how-to-get-ahead-in-the-ai-era`, with a practical 30-day framework and
institutional research notes.

Articles support an optional narrated edition, but no audio asset is shipped in
this release. A player appears only when an approved audio record exists;
future narration must meet the consent, editorial, disclosure, transcript, and
listening-review requirements in `creative/narration-policy.md`.

The current build is expected to generate 22 public and framework routes,
including eight case studies, the Media index, and the first Media article.

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
```

The project uses Next.js App Router and is designed for Vercel deployment. No environment variables are required for the public portfolio.
