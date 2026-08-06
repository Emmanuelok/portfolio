import { z } from "zod";

export const AI_READINESS_CONTRACT_VERSION =
  "kx-ai-readiness-2026-08-06.1";

const modelSlugPattern =
  /^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._:-]{0,127}$/i;

const readinessBlockerCodeSchema = z.enum([
  "gateway-auth-missing",
  "gateway-api-key-invalid",
  "usage-protection-missing",
  "model-routing-invalid",
  "governance-boundary-invalid",
]);

const readinessRouteSchema = z
  .object({
    primary: z.string().max(256),
    fallbacks: z.array(z.string().max(256)).max(8),
    reasoning: z.enum(["medium", "xhigh"]),
    maxOutputTokens: z.number().finite(),
  })
  .strict();

/**
 * Public, secret-free readiness contract returned by both Kingxford AI APIs.
 * `providerReady` confirms configuration only; it deliberately does not claim
 * that a credential or provider model was exercised by the diagnostic GET.
 */
export const aiReadinessSchema = z
  .object({
    contractVersion: z.literal(AI_READINESS_CONTRACT_VERSION),
    codeReady: z.boolean(),
    deploymentReady: z.boolean(),
    providerReady: z.boolean(),
    usageProtectionReady: z.boolean(),
    localFallbackReady: z.boolean(),
    status: z.enum([
      "ready",
      "local-fallback",
      "deployment-blocked",
      "configuration-invalid",
    ]),
    blockers: z.array(
      z
        .object({
          code: readinessBlockerCodeSchema,
          message: z.string().min(1).max(240),
        })
        .strict(),
    ),
    provider: z
      .object({
        authMethod: z.enum(["gateway-api-key", "vercel-oidc", "none"]),
        configurationVerified: z.boolean(),
        liveConnectionVerified: z.literal(false),
        modelCatalogVerifiedAtRequest: z.literal(false),
      })
      .strict(),
    usageProtection: z
      .object({
        source: z.enum([
          "configured-secret",
          "development-project-id",
          "development-fallback",
          "missing",
        ]),
        requiredInProduction: z.literal(true),
        minimumSecretCharacters: z.literal(32),
      })
      .strict(),
    routes: z
      .object({
        standard: readinessRouteSchema,
        deep: readinessRouteSchema,
      })
      .strict(),
    governance: z
      .object({
        toolsEnabled: z.boolean(),
        automaticApplyEnabled: z.boolean(),
        gateApprovalMode: z.enum(["human-only", "automatic"]),
      })
      .strict(),
  })
  .strict();

export type AiReadiness = z.infer<typeof aiReadinessSchema>;
export type AiReadinessBlockerCode = z.infer<
  typeof readinessBlockerCodeSchema
>;

type ReadinessModelRoute = Readonly<{
  model: string;
  fallbackModels: readonly string[];
  reasoning: "medium" | "xhigh";
  maxOutputTokens: number;
}>;

type ReadinessEnvironment = Readonly<
  Partial<
    Pick<
      NodeJS.ProcessEnv,
      | "AI_GATEWAY_API_KEY"
      | "VERCEL_OIDC_TOKEN"
      | "KINGXFORD_USAGE_HASH_SALT"
      | "VERCEL_PROJECT_ID"
      | "VERCEL"
      | "NODE_ENV"
    >
  >
>;

type BuildAiReadinessOptions = Readonly<{
  routes: Readonly<{
    standard: ReadinessModelRoute;
    deep: ReadinessModelRoute;
  }>;
  usageProtectionReady: boolean;
  toolsEnabled: boolean;
  automaticApplyEnabled: boolean;
  gateApprovalMode: "human-only" | "automatic";
  environment?: ReadinessEnvironment;
}>;

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function apiKeyTakesPrecedence(value: string | undefined) {
  return typeof value === "string" && value.length > 0;
}

export function gatewayAuthMethod(
  environment: ReadinessEnvironment = process.env,
): AiReadiness["provider"]["authMethod"] {
  if (apiKeyTakesPrecedence(environment.AI_GATEWAY_API_KEY)) {
    return "gateway-api-key";
  }
  if (
    configured(environment.VERCEL_OIDC_TOKEN) ||
    environment.VERCEL === "1"
  ) {
    return "vercel-oidc";
  }
  return "none";
}

export function hasGatewayAuth(
  environment: ReadinessEnvironment = process.env,
) {
  const method = gatewayAuthMethod(environment);
  return method === "gateway-api-key"
    ? configured(environment.AI_GATEWAY_API_KEY)
    : method === "vercel-oidc";
}

function usageProtectionSource(
  environment: ReadinessEnvironment,
  usageProtectionReady: boolean,
): AiReadiness["usageProtection"]["source"] {
  const configuredSalt = environment.KINGXFORD_USAGE_HASH_SALT?.trim();
  if (configuredSalt && configuredSalt.length >= 32) {
    return "configured-secret";
  }
  if (!usageProtectionReady) return "missing";
  if (configured(environment.VERCEL_PROJECT_ID)) {
    return "development-project-id";
  }
  return "development-fallback";
}

function normalizedRoute(route: ReadinessModelRoute) {
  return {
    primary: route.model,
    fallbacks: [...route.fallbackModels],
    reasoning: route.reasoning,
    maxOutputTokens: route.maxOutputTokens,
  };
}

function routeIsValid(route: ReadinessModelRoute) {
  const fallbacks = [...route.fallbackModels];
  return (
    modelSlugPattern.test(route.model) &&
    fallbacks.length <= 2 &&
    fallbacks.every(
      (model) => modelSlugPattern.test(model) && model !== route.model,
    ) &&
    new Set(fallbacks).size === fallbacks.length &&
    Number.isInteger(route.maxOutputTokens) &&
    route.maxOutputTokens > 0
  );
}

export function buildAiReadiness({
  routes,
  usageProtectionReady,
  toolsEnabled,
  automaticApplyEnabled,
  gateApprovalMode,
  environment = process.env,
}: BuildAiReadinessOptions): AiReadiness {
  const authMethod = gatewayAuthMethod(environment);
  const authReady = hasGatewayAuth(environment);
  const routingReady =
    routeIsValid(routes.standard) && routeIsValid(routes.deep);
  const governanceReady =
    toolsEnabled === false &&
    automaticApplyEnabled === false &&
    gateApprovalMode === "human-only";
  const codeReady = routingReady && governanceReady;
  const providerReady = routingReady && authReady;
  const deploymentReady =
    codeReady && providerReady && usageProtectionReady;
  const localFallbackReady = codeReady && usageProtectionReady;
  const blockers: Array<{
    code: AiReadinessBlockerCode;
    message: string;
  }> = [];

  if (!routingReady) {
    blockers.push({
      code: "model-routing-invalid",
      message:
        "A primary or fallback route is invalid; use provider/model slugs and at most two unique fallbacks.",
    });
  }
  if (!governanceReady) {
    blockers.push({
      code: "governance-boundary-invalid",
      message:
        "AI reviews must keep tools and automatic changes disabled, and gate approval must remain human-only.",
    });
  }
  if (!authReady && authMethod === "gateway-api-key") {
    blockers.push({
      code: "gateway-api-key-invalid",
      message:
        "Remove the blank AI_GATEWAY_API_KEY or replace it with a valid server-only key; it takes precedence over OIDC.",
    });
  } else if (!authReady) {
    blockers.push({
      code: "gateway-auth-missing",
      message:
        "Configure Vercel OIDC or the server-only AI_GATEWAY_API_KEY to enable AI-assisted reviews.",
    });
  }
  if (!usageProtectionReady) {
    blockers.push({
      code: "usage-protection-missing",
      message:
        "Configure the server-only KINGXFORD_USAGE_HASH_SALT with at least 32 characters for production requests.",
    });
  }

  return aiReadinessSchema.parse({
    contractVersion: AI_READINESS_CONTRACT_VERSION,
    codeReady,
    deploymentReady,
    providerReady,
    usageProtectionReady,
    localFallbackReady,
    status: !codeReady
      ? "configuration-invalid"
      : !usageProtectionReady
        ? "deployment-blocked"
        : !providerReady
          ? "local-fallback"
          : "ready",
    blockers,
    provider: {
      authMethod,
      configurationVerified: providerReady,
      liveConnectionVerified: false,
      modelCatalogVerifiedAtRequest: false,
    },
    usageProtection: {
      source: usageProtectionSource(environment, usageProtectionReady),
      requiredInProduction: true,
      minimumSecretCharacters: 32,
    },
    routes: {
      standard: normalizedRoute(routes.standard),
      deep: normalizedRoute(routes.deep),
    },
    governance: {
      toolsEnabled,
      automaticApplyEnabled,
      gateApprovalMode,
    },
  });
}
