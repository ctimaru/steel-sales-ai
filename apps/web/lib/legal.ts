import type { Metadata } from "next";

export const LEGAL_VERSION = "2026-10-04";

export type LegalIdentity = {
  controllerName: string | null;
  address: string | null;
  privacyEmail: string | null;
  vatId: string | null;
  registryId: string | null;
};

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function legalIdentity(): LegalIdentity {
  return {
    controllerName: envValue("NEXT_PUBLIC_LEGAL_CONTROLLER_NAME"),
    address: envValue("NEXT_PUBLIC_LEGAL_CONTROLLER_ADDRESS"),
    privacyEmail: envValue("NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL"),
    vatId: envValue("NEXT_PUBLIC_LEGAL_VAT_ID"),
    registryId: envValue("NEXT_PUBLIC_LEGAL_REGISTRY_ID"),
  };
}

export function legalIdentityConfigured(identity = legalIdentity()) {
  return Boolean(identity.controllerName && identity.address && identity.privacyEmail);
}

export function legalRobots(identity = legalIdentity()): Metadata["robots"] {
  return legalIdentityConfigured(identity)
    ? { index: true, follow: true }
    : { index: false, follow: true, nocache: true };
}

export function legalIdentityRows(identity = legalIdentity()) {
  return [
    ["Titolare / prestatore", identity.controllerName],
    ["Indirizzo", identity.address],
    ["Contatto privacy", identity.privacyEmail],
    ["Partita IVA / VAT", identity.vatId],
    ["Registro imprese / identificativo", identity.registryId],
  ] as const;
}
