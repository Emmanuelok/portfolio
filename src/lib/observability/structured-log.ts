type LogLevel = "info" | "warn" | "error";

type OperationalValue = string | number | boolean | null | undefined;

const sensitiveFieldPattern =
  /secret|token|authorization|cookie|email|prompt|content|body|draft|document|password|key/i;

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
 */
export function logOperationalEvent(
  level: LogLevel,
  event: string,
  fields: Readonly<Record<string, OperationalValue>> = {},
) {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "kingxford-platform",
    event: event.slice(0, 120),
    ...safeFields(fields),
  });

  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}
