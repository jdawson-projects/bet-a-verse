"use client";

// A swipeable card stack. Pure gesture physics: it knows nothing about markets
// or bets. Items go in, swipes come out through onSwipe. A committed card is
// handed to a separate "flying" layer so the next card is interactive at once.

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";

export type SwipeDirection = "left" | "right" | "up";

export interface CardStackHandle {
  /** Commit the top card as if it had been swiped (buttons, keyboard). */
  swipe: (dir: SwipeDirection) => void;
}

/** Live drag offsets of the top (or flying) card, for tint and stamp overlays. */
export interface SwipeMotion {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

export interface CardStackProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  renderCard: (item: T, info: { isTop: boolean }) => ReactNode;
  /** Overlay drawn above the top card while dragging and on flying cards. */
  renderFeedback?: (motion: SwipeMotion) => ReactNode;
  onSwipe: (item: T, dir: SwipeDirection) => void;
  ref?: Ref<CardStackHandle>;
  /** Cards rendered (top + peeking). Default 3. */
  visible?: number;
  /** Drag distance in px that commits a swipe. Default 110. */
  threshold?: number;
  /** Fling speed in px/s that commits a shorter swipe (at least 60 px). Default 800. */
  velocity?: number;
  /** Must establish a positioned box with a size (default "relative h-full"). */
  className?: string;
}

const FLY_SECONDS = 0.26;
const SPRING = { type: "spring", stiffness: 520, damping: 34 } as const;
const ROTATION = [-15, 0, 15];

/** A fling must still travel this far, so a quick twitch never places a bet. */
const MIN_FLING_PX = 60;

export function decideSwipe(
  offset: { x: number; y: number },
  speed: { x: number; y: number },
  threshold: number,
  velocity: number,
): SwipeDirection | null {
  const horizontal = Math.abs(offset.x) >= Math.abs(offset.y);
  if (horizontal) {
    if (offset.x > threshold || (speed.x > velocity && offset.x > MIN_FLING_PX)) return "right";
    if (offset.x < -threshold || (speed.x < -velocity && offset.x < -MIN_FLING_PX)) return "left";
  } else if (offset.y < -threshold || (speed.y < -velocity && offset.y < -MIN_FLING_PX)) {
    return "up";
  }
  return null;
}

interface Flying<T> {
  id: number;
  item: T;
  dir: SwipeDirection;
  fromX: number;
  fromY: number;
}

export function CardStack<T>({
  items,
  getKey,
  renderCard,
  renderFeedback,
  onSwipe,
  ref,
  visible = 3,
  threshold = 110,
  velocity = 800,
  className = "relative h-full",
}: CardStackProps<T>) {
  const reduce = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], reduce ? [0, 0, 0] : ROTATION);
  const [flying, setFlying] = useState<Flying<T>[]>([]);
  const flyId = useRef(0);
  const top = items[0];

  // Guards against committing the same card twice (e.g. two key presses before a re-render).
  const committedKey = useRef<string | null>(null);

  const commit = useCallback(
    (dir: SwipeDirection) => {
      if (top === undefined) return;
      const key = getKey(top);
      if (committedKey.current === key) return;
      committedKey.current = key;
      const fromX = x.get();
      const fromY = y.get();
      x.stop();
      y.stop();
      if (!reduce) setFlying((f) => [...f, { id: ++flyId.current, item: top, dir, fromX, fromY }]);
      onSwipe(top, dir);
    },
    [top, getKey, x, y, reduce, onSwipe],
  );

  useImperativeHandle(ref, () => ({ swipe: commit }), [commit]);

  // The drag offset belongs to whichever card is on top; recenter when that changes,
  // before paint, so the departing card never flashes back to the middle.
  const topKey = top === undefined ? null : getKey(top);
  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
    committedKey.current = null;
  }, [topKey, x, y]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dir = decideSwipe(info.offset, info.velocity, threshold, velocity);
    if (dir) {
      commit(dir);
    } else {
      animate(x, 0, SPRING);
      animate(y, 0, SPRING);
    }
  };

  const shown = items.slice(0, visible);

  return (
    <div className={className}>
      {shown.map((item, i) => {
        const isTop = i === 0;
        return (
          <motion.div
            key={getKey(item)}
            className="absolute inset-0"
            style={{ zIndex: visible - i }}
            initial={false}
            animate={{ scale: 1 - i * 0.045, y: i * 24 }}
            transition={reduce ? { duration: 0 } : SPRING}
            aria-hidden={!isTop}
            inert={!isTop}
          >
            {isTop ? (
              <motion.div
                className="h-full w-full touch-none select-none"
                style={{ x, y, rotate }}
                drag
                dragMomentum={false}
                dragElastic={1}
                onDragEnd={onDragEnd}
              >
                {renderCard(item, { isTop: true })}
                {renderFeedback?.({ x, y })}
              </motion.div>
            ) : (
              renderCard(item, { isTop: false })
            )}
          </motion.div>
        );
      })}
      {flying.map((f) => (
        <FlyingCard
          key={f.id}
          flying={f}
          onDone={() => setFlying((fs) => fs.filter((g) => g.id !== f.id))}
          renderFeedback={renderFeedback}
        >
          {renderCard(f.item, { isTop: false })}
        </FlyingCard>
      ))}
    </div>
  );
}

function FlyingCard<T>({
  flying,
  onDone,
  renderFeedback,
  children,
}: {
  flying: Flying<T>;
  onDone: () => void;
  renderFeedback?: (motion: SwipeMotion) => ReactNode;
  children: ReactNode;
}) {
  const x = useMotionValue(flying.fromX);
  const y = useMotionValue(flying.fromY);
  const rotate = useTransform(x, [-320, 0, 320], ROTATION);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const tx = flying.dir === "right" ? w * 1.1 : flying.dir === "left" ? -w * 1.1 : flying.fromX;
    const ty = flying.dir === "up" ? -h : flying.fromY + 60;
    const ease = [0.45, 0, 0.9, 0.6] as const;
    const ax = animate(x, tx, { duration: FLY_SECONDS, ease });
    const ay = animate(y, ty, { duration: FLY_SECONDS, ease, onComplete: () => done.current() });
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [flying, x, y]);

  return (
    <motion.div className="pointer-events-none absolute inset-0" style={{ x, y, rotate, zIndex: 100 }} aria-hidden>
      {children}
      {renderFeedback?.({ x, y })}
    </motion.div>
  );
}
