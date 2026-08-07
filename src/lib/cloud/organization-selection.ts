import { parseOrganizationId } from "./contracts";

const ACTIVE_ORGANIZATION_KEY = "kingxford.cloud.active-organization.v1";
export const ACTIVE_ORGANIZATION_EVENT = "kingxford:cloud-organization-change";

export function getActiveCloudOrganization() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ACTIVE_ORGANIZATION_KEY);
  if (!value) return null;
  try {
    return parseOrganizationId(value);
  } catch {
    window.localStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
    return null;
  }
}

export function setActiveCloudOrganization(organizationId: string | null) {
  if (typeof window === "undefined") return;
  if (organizationId === null) {
    window.localStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
  } else {
    window.localStorage.setItem(
      ACTIVE_ORGANIZATION_KEY,
      parseOrganizationId(organizationId),
    );
  }
  window.dispatchEvent(new Event(ACTIVE_ORGANIZATION_EVENT));
}

export function withActiveCloudOrganization(headersInit?: HeadersInit) {
  const headers = new Headers(headersInit);
  const organizationId = getActiveCloudOrganization();
  if (organizationId) {
    headers.set("X-Kingxford-Organization-Id", organizationId);
  }
  return headers;
}
