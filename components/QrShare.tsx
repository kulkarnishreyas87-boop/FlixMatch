"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrShare({ code }: { code: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const url = `${base}/join/${code}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads window.location, unavailable during server render
    setJoinUrl(url);
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#1a0f1f", light: "#ffffff" } }).then(
      setQrDataUrl
    );
  }, [code]);

  async function handleShare() {
    if (!qrDataUrl) return;
    try {
      const blob = await (await fetch(qrDataUrl)).blob();
      const file = new File([blob], `match-night-${code}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Match Night",
          text: `Join my Match Night session: ${joinUrl}`,
        });
        return;
      }
    } catch {
      // fall through to link copy
    }
    await handleCopy();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-3xl bg-white p-4 shadow-xl shadow-black/30">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="Scan to join" width={220} height={220} />
        ) : (
          <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-neutral-200" />
        )}
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-3xl font-bold tracking-[0.3em] text-white">{code}</span>
        <span className="text-xs text-white/50">Partner scans the code, or use the link below</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleShare}
          className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-400"
        >
          Share QR
        </button>
        <button
          onClick={handleCopy}
          className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
