"use client";

import { motion, useTransform } from "motion/react";
import type { SwipeMotion } from "@/components/card-stack/card-stack";
import { CheckIcon, SkipIcon, XIcon } from "@/components/icons";

/** Green tint + YES stamp to the right, red + NO to the left, SKIP upward. */
export function SwipeFeedback({ x, y }: SwipeMotion) {
  const yesOpacity = useTransform(x, [20, 120], [0, 1]);
  const noOpacity = useTransform(x, [-120, -20], [1, 0]);
  const skipOpacity = useTransform(y, [-120, -30], [1, 0]);
  const yesTint = useTransform(x, [0, 160], [0, 0.5]);
  const noTint = useTransform(x, [-160, 0], [0.5, 0]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
      <motion.div className="absolute inset-0 bg-yes" style={{ opacity: yesTint }} />
      <motion.div className="absolute inset-0 bg-no" style={{ opacity: noTint }} />
      <motion.div
        className="absolute left-6 top-16 flex -rotate-12 items-center gap-2 rounded-2xl border-4 border-white bg-yes px-4 py-1.5 text-4xl font-black tracking-wider text-white shadow-xl"
        style={{ opacity: yesOpacity }}
      >
        <CheckIcon className="h-8 w-8" /> YES
      </motion.div>
      <motion.div
        className="absolute right-6 top-16 flex rotate-12 items-center gap-2 rounded-2xl border-4 border-white bg-no px-4 py-1.5 text-4xl font-black tracking-wider text-white shadow-xl"
        style={{ opacity: noOpacity }}
      >
        <XIcon className="h-8 w-8" /> NO
      </motion.div>
      <motion.div
        className="absolute inset-x-0 top-16 mx-auto flex w-fit items-center gap-2 rounded-2xl border-4 border-white bg-slate-600 px-4 py-1.5 text-3xl font-black tracking-wider text-white shadow-xl"
        style={{ opacity: skipOpacity }}
      >
        <SkipIcon className="h-7 w-7" /> SKIP
      </motion.div>
    </div>
  );
}
