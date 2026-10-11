"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Tone = "default" | "success" | "error";

export interface ToastOptions {
  message: string;
  tone?: Tone;
  /** ms; defaults to 3000 */
  duration?: number;
  action?: { label: string; onClick: () => void };
  /** Toasts with the same id replace each other (e.g. one Undo toast at a time). */
  id?: string;
}

interface ToastItem extends Required<Omit<ToastOptions, "action">> {
  key: number;
  action?: ToastOptions["action"];
}

interface ToastApi {
  show: (opts: ToastOptions) => () => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextKey = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((key: number) => {
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    setItems((xs) => xs.filter((t) => t.key !== key));
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((xs) => {
      for (const t of xs) if (t.id === id) clearTimeout(timers.current.get(t.key));
      return xs.filter((t) => t.id !== id);
    });
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const key = nextKey.current++;
      const item: ToastItem = {
        key,
        id: opts.id ?? `t${key}`,
        message: opts.message,
        tone: opts.tone ?? "default",
        duration: opts.duration ?? 3000,
        action: opts.action,
      };
      setItems((xs) => [...xs.filter((t) => t.id !== item.id), item].slice(-3));
      timers.current.set(
        key,
        setTimeout(() => remove(key), item.duration),
      );
      return () => remove(key);
    },
    [remove],
  );

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
        // Pages can move toasts: --toast-top (e.g. the feed keeps its controls clear) or --toast-offset.
        style={{
          top: "var(--toast-top, auto)",
          bottom: "var(--toast-bottom, calc(env(safe-area-inset-bottom) + var(--toast-offset, 24px)))",
        }}
      >
        {items.map((t) => (
          <div
            key={t.key}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ${
              t.tone === "error"
                ? "bg-no-soft text-no-strong ring-no/30"
                : t.tone === "success"
                  ? "bg-yes-soft text-yes-strong ring-yes/30"
                  : "bg-fg text-bg ring-black/10"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  remove(t.key);
                }}
                className="rounded-full bg-bg/15 px-3 py-1 text-sm font-bold underline-offset-2 hover:underline"
              >
                {t.action.label}
              </button>
            )}
            {t.action && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-current opacity-40"
                style={{ animation: `shrink ${t.duration}ms linear forwards` }}
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
