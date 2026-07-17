"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export const BOSS_ANSWER_EVENT = "mission:answer-tap";

type Props = {
  currentHealthPercent: number;
  nextHealthPercent: number;
};

export function BossHealthBar({
  currentHealthPercent,
  nextHealthPercent,
}: Props) {
  const [health, setHealth] = useState(currentHealthPercent);
  const [hit, setHit] = useState<"normal" | "big" | null>(null);

  useEffect(() => {
    function handleAnswerTap(event: Event) {
      const big = event instanceof CustomEvent && event.detail?.big === true;
      setHit(big ? "big" : "normal");
      setHealth(nextHealthPercent);
      window.setTimeout(() => setHit(null), big ? 550 : 380);
    }

    window.addEventListener(BOSS_ANSWER_EVENT, handleAnswerTap);
    return () =>
      window.removeEventListener(BOSS_ANSWER_EVENT, handleAnswerTap);
  }, [nextHealthPercent]);

  return (
    <div className="mt-4 flex items-center gap-3">
      <div
        className={`h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[#f05252]/60 bg-[#150f28] ${
          hit ? (hit === "big" ? "boss-shake-big" : "boss-shake") : ""
        }`}
      >
        <Image
          src="/boss-goblin-face.png"
          alt=""
          width={96}
          height={96}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="relative flex-1">
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/30">
          <div
            className="boss-health-fill h-full rounded-full"
            style={{ width: `${health}%` }}
          />
        </div>
        {hit === "big" ? <span className="boss-impact-ring" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}
