import { CheckCircle2, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { createPortal } from "react-dom";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3500;

const toneStyles: Record<ToastTone, string> = {
  success: "border-green/30 bg-[#f6fbf7] text-ink",
  error: "border-red/40 bg-[#fff5f4] text-ink",
  info: "border-blue/30 bg-[#f4f8ff] text-ink"
};

const toneIconClass: Record<ToastTone, string> = {
  success: "text-green",
  error: "text-red",
  info: "text-cocoa"
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === "error") {
    return <XCircle className={["h-5 w-5 shrink-0", toneIconClass[tone]].join(" ")} aria-hidden="true" />;
  }
  return <CheckCircle2 className={["h-5 w-5 shrink-0", toneIconClass[tone]].join(" ")} aria-hidden="true" />;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
      info: (message: string) => push("info", message)
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className={[
                "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-control border px-4 py-3 text-sm font-semibold shadow-elegant",
                toneStyles[toast.tone]
              ].join(" ")}
            >
              <ToastIcon tone={toast.tone} />
              <span className="min-w-0 flex-1 leading-5">{toast.message}</span>
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/80 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread"
                aria-label="알림 닫기"
                onClick={() => dismiss(toast.id)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
