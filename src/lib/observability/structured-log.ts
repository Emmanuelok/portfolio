type LogLevel = "info" | "warn" | "error";

type LogLevelInput = LogLevel | "warning" | "critical" | "fatal";

type OperationalValue = string | number | boolean | null | undefined;

const sensitiveFieldPattern =
  /secret|token|authorization|cookie|email|prompt|content|body|draft|document|password|key/i;

// A drain filters on these names, so caller fields must never shadow them.
const reservedFieldNames = new Set([
  "timestamp",
  "level",
  "service",
  "component",
  "event",
]);

function normalizedLevel(level: LogLevelInput): LogLevel {
  const candidate = String(level).trim().toLocaleLowerCase("en");
  if (
    candidate === "error" ||
    candidate === "critical" ||
    candidate === "fatal"
  ) {
    return "error";
  }
  if (candidate === "warn" || candidate === "warning") return "warn";
  return "info";
}

function eventComponent(event: string) {
  const [component] = event.split(".", 1);
  return (component || "platform").slice(0, 40).toLocaleLowerCase("en");
}

function boundedValue(value: OperationalValue) {
  if (typeof value === "string") return value.slice(0, 240);
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  return undefined;
}

function safeFields(fields: Readonly<Record<string, OperationalValue>>) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => !sensitiveFieldPattern.test(key))
      .filter(([key]) => !reservedFieldNames.has(key))
      .slice(0, 32)
      .flatMap(([key, value]) => {
        const bounded = boundedValue(value);
        return bounded === undefined ? [] : [[key.slice(0, 80), bounded]];
      }),
  );
}

/**
 * Emits one privacy-bounded JSON record suitable for Vercel Logs and drains.
 * Project text, prompts, credentials, contact details, and request bodies are
 * deliberately rejected by field name and never belong in operational logs.
 * `level` and `component` are on the record itself so a drain can alert on a
 * failing path without parsing the console method that emitted it.
 */
export function logOperationalEvent(
  level: LogLevelInput,
  event: string,
  fields: Readonly<Record<string, OperationalValue>> = {},
) {
  const severity = normalizedLevel(level);
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level: severity,
    service: "kingxford-platform",
    component: eventComponent(event),
    event: event.slice(0, 120),
    ...safeFields(fields),
  });

  if (severity === "error") console.error(record);
  else if (severity === "warn") console.warn(record);
  else console.info(record);
}
