"use client";

import {
  CircleSlash,
  CircleStop,
  Gavel,
  ListOrdered,
  Play,
  ScanSearch,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  councilLensLabels,
  councilLenses,
  councilStageEventSchema,
  type CouncilChallenge,
  type CouncilLens,
  type CouncilMove,
  type CouncilSessionRequest,
  type CouncilSessionResult,
  type CouncilSurvey,
} from "@/lib/council/contracts";
import { executeLocalCouncilSession } from "@/lib/council/local-council";

import styles from "./AdvancementCouncil.module.css";

export type AdvancementCouncilProps = Readonly<{
  buildRequest: () => CouncilSessionRequest | null;
  /**
   * A provider-backed session needs a saved cloud project and a write role.
   * Without one the council still convenes locally over the record on this
   * device, so the structure is never hidden behind configuration.
   */
  cloudSessionAvailable: boolean;
  unavailableReason?: string;
}>;

type Deliberation = Readonly<{
  id: string;
  lens: CouncilLens;
  move: CouncilMove;
  challenge?: CouncilChallenge;
  survivesChallenge?: boolean;
}>;

type SessionState = Readonly<{
  status: "idle" | "running" | "complete" | "failed";
  source: "gateway" | "local" | null;
  survey: CouncilSurvey | null;
  deliberations: readonly Deliberation[];
  result: CouncilSessionResult | null;
  message: string;
}>;

const initialState: SessionState = {
  status: "idle",
  source: null,
  survey: null,
  deliberations: [],
  result: null,
  message: "",
};

const verdictLabels: Readonly<Record<CouncilChallenge["verdict"], string>> = {
  upheld: "Upheld",
  qualified: "Qualified",
  refuted: "Refuted",
};

const gateLabels: Readonly<
  Record<CouncilSessionResult["synthesis"]["gateReadiness"]["assessment"], string>
> = {
  "not-ready": "Not ready",
  "evidence-incomplete": "Evidence incomplete",
  "ready-for-human-decision": "Ready for a human decision",
};

export function AdvancementCouncil({
  buildRequest,
  cloudSessionAvailable,
  unavailableReason,
}: AdvancementCouncilProps) {
  const [selectedLenses, setSelectedLenses] = useState<readonly CouncilLens[]>([
    "evidence-gap",
    "smallest-test",
  ]);
  const [session, setSession] = useState<SessionState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const toggleLens = (lens: CouncilLens) => {
    setSelectedLenses((current) => {
      if (current.includes(lens)) {
        return current.length > 1
          ? current.filter((item) => item !== lens)
          : current;
      }
      return [...current, lens];
    });
  };

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const start = useCallback(async () => {
    const request = buildRequest();
    if (!request) {
      setSession({
        ...initialState,
        status: "failed",
        message:
          "Add an objective and at least one artifact to this project before convening the council.",
      });
      return;
    }

    if (!cloudSessionAvailable) {
      const local = executeLocalCouncilSession(
        { ...request, lenses: [...selectedLenses] },
        {
          sessionId: `council_local_${request.projectContext.projectId}`,
          inputDigest: "0".repeat(64),
        },
      );
      setSession({
        status: "complete",
        source: "local",
        survey: local.survey,
        deliberations: local.deliberations,
        result: local,
        message: "",
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSession({ ...initialState, status: "running" });

    try {
      const response = await fetch("/api/intelligence/council", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request, lenses: selectedLenses }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await response
          .json()
          .then((body: { error?: { message?: string } }) => body?.error?.message)
          .catch(() => undefined);
        setSession({
          ...initialState,
          status: "failed",
          message:
            detail ||
            "The council session could not be started. No project revision was applied.",
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Stage events arrive as newline-delimited JSON; a partial line is held
      // until its newline arrives.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = councilStageEventSchema.safeParse(
            JSON.parse(line) as unknown,
          );
          if (!parsed.success) continue;
          const event = parsed.data;

          setSession((current) => {
            if (event.stage === "accepted") {
              return { ...current, source: event.source };
            }
            if (event.stage === "survey") {
              return { ...current, survey: event.survey };
            }
            if (event.stage === "proposal") {
              return {
                ...current,
                deliberations: [
                  ...current.deliberations,
                  { id: event.id, lens: event.lens, move: event.move },
                ],
              };
            }
            if (event.stage === "challenge") {
              return {
                ...current,
                deliberations: current.deliberations.map((item) =>
                  item.id === event.id
                    ? {
                        ...item,
                        challenge: event.challenge,
                        survivesChallenge: event.survivesChallenge,
                      }
                    : item,
                ),
              };
            }
            if (event.stage === "complete") {
              return {
                ...current,
                status: "complete",
                result: event.result,
                source: event.result.source,
              };
            }
            return { ...current, status: "failed", message: event.message };
          });
        }
      }

      setSession((current) =>
        current.status === "running"
          ? {
              ...current,
              status: "failed",
              message:
                "The council session ended before it completed. No project revision was applied.",
            }
          : current,
      );
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setSession((current) => ({
        ...current,
        status: "failed",
        message: cancelled
          ? "The council session was stopped. No project revision was applied."
          : "The council session could not be completed. No project revision was applied.",
      }));
    } finally {
      abortRef.current = null;
    }
  }, [buildRequest, cloudSessionAvailable, selectedLenses]);

  const ranked = useMemo(() => {
    if (!session.result) return [];
    return session.result.synthesis.rankedMoveTitles.map((title) => ({
      title,
      deliberation: session.deliberations.find(
        (item) => item.move.title === title,
      ),
    }));
  }, [session.deliberations, session.result]);

  const running = session.status === "running";
  const gate = session.result?.synthesis.gateReadiness;

  return (
    <section className={styles.council} aria-labelledby="advancement-council-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            <Gavel aria-hidden="true" /> Advancement council
          </p>
          <h3 id="advancement-council-title">
            Four members propose. Each proposal is challenged.
          </h3>
          <p className={styles.lede}>
            The council reads the project record, proposes moves through separate
            lenses, and tests each one against the record before ranking it. It
            proposes only: it cannot change the project or record a gate decision.
          </p>
        </div>
        <div className={styles.controls}>
          {running ? (
            <button type="button" onClick={stop} className={styles.stop}>
              <CircleStop aria-hidden="true" /> Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              className={styles.start}
            >
              <Play aria-hidden="true" />{" "}
              {cloudSessionAvailable ? "Convene council" : "Read record locally"}
            </button>
          )}
        </div>
      </header>

      {!cloudSessionAvailable ? (
        <p className={styles.notice} role="status">
          <CircleSlash aria-hidden="true" />{" "}
          {unavailableReason ||
            "A reviewed session needs a saved cloud project. The council reads this device's record instead."}
        </p>
      ) : null}

      <fieldset className={styles.lensPicker} disabled={running}>
        <legend>Council members</legend>
        {councilLenses.map((lens) => (
          <label key={lens} data-selected={selectedLenses.includes(lens)}>
            <input
              type="checkbox"
              checked={selectedLenses.includes(lens)}
              onChange={() => toggleLens(lens)}
            />
            <span>{councilLensLabels[lens]}</span>
          </label>
        ))}
      </fieldset>

      <div className={styles.stream} aria-live="polite" aria-busy={running}>
        {session.status === "idle" ? (
          <p className={styles.idle}>
            Convene the council to read the current record and propose the next
            moves.
          </p>
        ) : null}

        {session.source === "local" ? (
          <p className={styles.notice}>
            <TriangleAlert aria-hidden="true" /> This session ran locally without a
            model provider. It reads record structure only.
          </p>
        ) : null}

        {session.survey ? (
          <article className={styles.survey}>
            <h4>
              <ScanSearch aria-hidden="true" /> Position
            </h4>
            <p>{session.survey.positionSummary}</p>
            <div className={styles.surveyColumns}>
              <SurveyList title="Established" items={session.survey.established} />
              <SurveyList title="Assumed" items={session.survey.assumed} />
              <SurveyList title="Missing" items={session.survey.missing} />
              <SurveyList title="Contested" items={session.survey.contested} />
            </div>
          </article>
        ) : running ? (
          <p className={styles.pending}>
            <Sparkles aria-hidden="true" /> Reading the project record…
          </p>
        ) : null}

        {session.deliberations.map((deliberation) => (
          <article
            className={styles.move}
            key={deliberation.id}
            data-verdict={deliberation.challenge?.verdict ?? "pending"}
          >
            <header>
              <span className={styles.lensTag}>
                {councilLensLabels[deliberation.lens]}
              </span>
              <strong>{deliberation.move.title}</strong>
              <span className={styles.verdict}>
                {deliberation.challenge
                  ? verdictLabels[deliberation.challenge.verdict]
                  : "Under challenge…"}
              </span>
            </header>
            <p>{deliberation.move.action}</p>
            <dl className={styles.moveMeta}>
              <div>
                <dt>Expected outcome</dt>
                <dd>{deliberation.move.expectedOutcome}</dd>
              </div>
              <div>
                <dt>Basis</dt>
                <dd>
                  {deliberation.move.evidenceBasis.unsupported
                    ? "No supporting evidence in the record"
                    : `${deliberation.move.evidenceBasis.evidenceIds.length} cited evidence ${
                        deliberation.move.evidenceBasis.evidenceIds.length === 1
                          ? "entry"
                          : "entries"
                      }`}
                </dd>
              </div>
              <div>
                <dt>Effort · risk</dt>
                <dd>
                  {deliberation.move.effort} · {deliberation.move.risk}
                </dd>
              </div>
            </dl>
            {deliberation.challenge ? (
              <div className={styles.challenge}>
                <p>
                  <ShieldQuestion aria-hidden="true" />{" "}
                  {deliberation.challenge.grounds}
                </p>
                {deliberation.challenge.unsupportedClaims.length > 0 ? (
                  <ul>
                    {deliberation.challenge.unsupportedClaims.map((claim) => (
                      <li key={claim}>{claim}</li>
                    ))}
                  </ul>
                ) : null}
                {deliberation.challenge.smallerAlternative ? (
                  <p className={styles.alternative}>
                    Smaller alternative: {deliberation.challenge.smallerAlternative}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}

        {session.result ? (
          <article className={styles.synthesis}>
            <h4>
              <ListOrdered aria-hidden="true" /> Advancement order
            </h4>
            <p>{session.result.synthesis.summary}</p>
            <ol className={styles.ranked}>
              {ranked.map(({ title, deliberation }) => (
                <li key={title} data-verdict={deliberation?.challenge?.verdict}>
                  <strong>{title}</strong>
                  {deliberation?.challenge ? (
                    <span>{verdictLabels[deliberation.challenge.verdict]}</span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className={styles.sequence}>
              {session.result.synthesis.sequenceRationale}
            </p>

            {gate ? (
              <div className={styles.gate} data-assessment={gate.assessment}>
                <p className={styles.gateHeading}>
                  Gate readiness: <strong>{gateLabels[gate.assessment]}</strong>
                </p>
                <p>{gate.rationale}</p>
                {gate.missingCriteria.length > 0 ? (
                  <ul>
                    {gate.missingCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <ul className={styles.boundaries}>
              {session.result.boundaries.map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ul>
          </article>
        ) : null}

        {session.status === "failed" && session.message ? (
          <p className={styles.error} role="alert">
            <TriangleAlert aria-hidden="true" /> {session.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SurveyList({
  title,
  items,
}: Readonly<{ title: string; items: readonly string[] }>) {
  if (items.length === 0) return null;
  return (
    <div>
      <p>{title}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
