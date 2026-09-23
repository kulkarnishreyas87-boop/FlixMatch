"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDeviceId } from "@/lib/device";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { api } from "@/lib/api-client";
import { PreferenceForm, type PreferenceFormValues } from "@/components/PreferenceForm";
import { WaitingScreen } from "@/components/WaitingScreen";
import { SwipeDeck } from "@/components/SwipeDeck";
import { MatchReveal } from "@/components/MatchReveal";
import { FinalCallDecision } from "@/components/FinalCallDecision";
import type { TitleCardData } from "@/lib/supabase/types";

function Spinner() {
  return <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-rose-400" />;
}

export default function SessionPage() {
  const { code } = useParams<{ code: string }>();
  const [deviceId, setDeviceId] = useState("");
  const [submittingPrefs, setSubmittingPrefs] = useState(false);

  // deviceId lives in localStorage, unavailable during the server render, so
  // it's read after mount and the UI shows a spinner until then — this keeps
  // the client's first render matching the server-rendered markup.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeviceId(getDeviceId());
  }, []);

  const { data, error, refetch } = useSessionState(code, deviceId);

  async function handleSubmitPrefs(values: PreferenceFormValues) {
    setSubmittingPrefs(true);
    try {
      await api.submitPreferences(code, { deviceId, ...values });
      await refetch();
    } finally {
      setSubmittingPrefs(false);
    }
  }

  async function handleSwipe(title: TitleCardData, direction: "like" | "pass") {
    const res = await api.swipe(code, {
      deviceId,
      tmdbId: title.tmdb_id,
      mediaType: title.media_type,
      direction,
    });
    if (res.matched) refetch();
  }

  async function handleDeckComplete() {
    await api.completeRound(code, deviceId);
    refetch();
  }

  async function handleFinalChoice(title: TitleCardData) {
    await api.finalChoice(code, { deviceId, tmdbId: title.tmdb_id, mediaType: title.media_type });
    refetch();
  }

  let content: React.ReactNode;

  if (error) {
    content = <p className="text-rose-400">{error}</p>;
  } else if (!deviceId || !data) {
    content = <Spinner />;
  } else {
    const { session, myRole, preferencesSubmitted, pool, participants, bothFinishedRound } = data;
    const iSubmitted = myRole ? preferencesSubmitted[myRole] : false;
    const partnerRole = myRole === "A" ? "B" : "A";
    const partnerJoined = participants.some((p) => p.role === partnerRole);

    if (session.status === "matched") {
      content = <MatchReveal code={code} onRated={refetch} />;
    } else if (session.status === "completed") {
      content = (
        <p className="max-w-sm text-center text-white/70">
          All wrapped up for tonight. Come back anytime — Match Night remembers what you both enjoyed.
        </p>
      );
    } else if (!iSubmitted) {
      content = <PreferenceForm onSubmit={handleSubmitPrefs} submitting={submittingPrefs} />;
    } else if (session.status === "waiting_for_partner") {
      content = (
        <WaitingScreen
          code={code}
          stage={partnerJoined ? "waiting_for_partner_prefs" : "waiting_for_partner_to_join"}
        />
      );
    } else if ((session.status === "round_1" || session.status === "round_2") && pool) {
      content = (
        <SwipeDeck
          key={`${session.status}-${pool.round}`}
          titles={pool.titles}
          seed={deviceId}
          onSwipe={handleSwipe}
          onComplete={handleDeckComplete}
        />
      );
    } else if (session.status === "final_call" && pool) {
      content = bothFinishedRound ? (
        <FinalCallDecision titles={pool.titles} onChoose={handleFinalChoice} />
      ) : (
        <SwipeDeck
          key={`final-${pool.round}`}
          titles={pool.titles}
          seed={deviceId}
          onSwipe={handleSwipe}
          onComplete={handleDeckComplete}
        />
      );
    } else {
      content = <WaitingScreen code={code} stage="brewing" />;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-[radial-gradient(circle_at_top,_#2a1730,_#0d0710)] px-6 py-12">
      <header className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
        Match Night <span className="text-white/20">·</span> {code}
      </header>
      <div className="flex w-full flex-1 items-center justify-center">{content}</div>
    </main>
  );
}
