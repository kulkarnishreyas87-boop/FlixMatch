"use client";

import { QrShare } from "./QrShare";

export function WaitingScreen({
  code,
  stage,
}: {
  code: string;
  stage: "waiting_for_partner_to_join" | "waiting_for_partner_prefs" | "brewing";
}) {
  if (stage === "waiting_for_partner_to_join") {
    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-center text-white/70">
          Share this with your partner so they land in the same session.
        </p>
        <QrShare code={code} />
      </div>
    );
  }

  const copy =
    stage === "brewing"
      ? "Brewing tonight's picks together…"
      : "Waiting for your partner to finish their preferences…";

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-rose-400" />
      <p className="text-white/70">{copy}</p>
    </div>
  );
}
