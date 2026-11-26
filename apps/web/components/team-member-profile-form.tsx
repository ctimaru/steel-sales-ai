"use client";

import { useState } from "react";

import { changeMemberProfile } from "@/app/onboarding/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";

// TEAM-PROFILES2 — un solo «Profilo» per persona. «Salva» compare solo quando
// la scelta cambia; il server ricontrolla tutto (Direzione, ultimo admin, sé stessi).

export type TeamProfileOption = { value: string; label: string };

export function TeamMemberProfileForm({ userId, email, current, currentLabel, readOnly, options }: {
  userId: string;
  email: string;
  /** Profilo attuale tra le scelte, o "" se da assegnare / vecchio profilo. */
  current: string;
  /** Etichetta della scelta vuota: «Scegli un ufficio…» o «Vecchio profilo: …». */
  currentLabel: string;
  readOnly: boolean;
  options: readonly TeamProfileOption[];
}) {
  const [value, setValue] = useState(current);
  const changed = value !== current && value !== "";
  return (
    <form action={changeMemberProfile} className="flex min-w-0 items-center gap-2" data-testid="team-member-profile">
      <input type="hidden" name="return_to" value="/company/team" />
      <input type="hidden" name="user_id" value={userId} />
      {readOnly ? <input type="hidden" name="read_only" value="on" /> : null}
      <label className="min-w-0 flex-1">
        <span className="sr-only">Profilo di {email}</span>
        <select name="profile" value={value} onChange={(event) => setValue(event.target.value)}
          className="h-10 w-full rounded-lg border border-[#bfd0c5] bg-white px-2 text-sm font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
          {current === "" ? <option value="" disabled>{currentLabel}</option> : null}
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {changed ? (
        <PendingSubmitButton pendingLabel="…"
          className="inline-flex h-10 shrink-0 items-center rounded-lg bg-[#175640] px-4 text-xs font-bold text-white hover:bg-[#104632]">
          Salva
        </PendingSubmitButton>
      ) : null}
    </form>
  );
}
