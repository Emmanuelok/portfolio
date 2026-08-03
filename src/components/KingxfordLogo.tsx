type KingxfordMarkProps = Readonly<{
  className?: string;
  decorative?: boolean;
  label?: string;
  monochrome?: boolean;
}>;

/**
 * A compact K monogram for favicons and places where the full wordmark cannot
 * be used. The short blue terminal is an accent, not a second letterform.
 */
export function KingxfordMark({
  className,
  decorative = false,
  label = "kingXford & Co monogram",
  monochrome = false,
}: KingxfordMarkProps) {
  const rootClass = className
    ? `kingxford-mark ${className}`
    : "kingxford-mark";

  return (
    <svg
      className={rootClass}
      data-monochrome={monochrome ? "true" : "false"}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
      focusable="false"
    >
      {!decorative && <title>{label}</title>}
      <rect
        className="kingxford-mark__frame"
        x="2.5"
        y="2.5"
        width="35"
        height="35"
        rx="8"
      />
      <path className="kingxford-mark__letter" d="M13 10.5v19" />
      <path className="kingxford-mark__letter" d="m14.25 20.25 12.5-9.75" />
      <path className="kingxford-mark__letter" d="m19 16.55 8.75 12.95" />
      <path className="kingxford-mark__accent" d="m24 23.95 3.75 5.55" />
    </svg>
  );
}

type KingxfordLogoProps = Readonly<{
  className?: string;
  decorative?: boolean;
  monochrome?: boolean;
}>;

/**
 * The primary corporate wordmark. Its X stays on the same baseline and at the
 * same optical size as the surrounding letters; colour is the only emphasis.
 */
export function KingxfordLogo({
  className,
  decorative = false,
  monochrome = false,
}: KingxfordLogoProps) {
  const rootClass = className
    ? `kingxford-logo ${className}`
    : "kingxford-logo";

  return (
    <span
      className={rootClass}
      data-monochrome={monochrome ? "true" : "false"}
      aria-label={decorative ? undefined : "kingXford & Co"}
      role={decorative ? undefined : "img"}
    >
      <span className="kingxford-logo__wordmark" aria-hidden="true">
        <span>king</span>
        <span className="kingxford-logo__x">X</span>
        <span>ford</span>
      </span>
      <span className="kingxford-logo__co" aria-hidden="true">
        &amp; Co
      </span>
    </span>
  );
}
