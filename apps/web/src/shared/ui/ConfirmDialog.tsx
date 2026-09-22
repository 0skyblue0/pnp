import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { createPortal } from "react-dom";

type ConfirmTone = "default" | "danger";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: PropsWithChildren) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmContextValue>((options) => {
    return new Promise<boolean>((resolve) => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (confirmed: boolean) => {
      pending?.resolve(confirmed);
      setPending(null);
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    },
    [pending]
  );

  useEffect(() => {
    if (!pending) {
      return;
    }
    confirmButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements.at(-1);
      if (!first || !last) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending
        ? createPortal(
            <div
              className="fixed inset-0 z-[110] grid place-items-center bg-ref-cocoa/45 px-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  close(false);
                }
              }}
            >
              <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
                tabIndex={-1}
                className="w-full max-w-sm rounded-panel border border-ref-line bg-ref-card p-5 shadow-elegant"
              >
                <h2 id="confirm-dialog-title" className="text-base font-bold text-ink">
                  {pending.title ?? "확인"}
                </h2>
                <p id="confirm-dialog-message" className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">
                  {pending.message}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    className="ref-secondary-action min-h-11 text-sm"
                    onClick={() => close(false)}
                  >
                    {pending.cancelLabel ?? "취소"}
                  </button>
                  <button
                    ref={confirmButtonRef}
                    type="button"
                    className={[
                      "min-h-11 px-4 text-sm",
                      pending.tone === "danger" ? "rounded-control border border-red bg-red text-white transition hover:bg-red/90" : "ref-primary-action"
                    ].join(" ")}
                    onClick={() => close(true)}
                  >
                    {pending.confirmLabel ?? "확인"}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return useMemo(() => context, [context]);
}
