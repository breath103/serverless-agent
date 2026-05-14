import { AnimatePresence, motion } from "framer-motion";
import { type ComponentType, createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

// ---------------------------------------------------------------------------
// Escape‑key stack — topmost modal wins
// ---------------------------------------------------------------------------
const escapeStack: Array<() => void> = [];

function registerEscape(handler: () => void) {
  escapeStack.push(handler);
  return () => {
    const idx = escapeStack.indexOf(handler);
    if (idx !== -1) escapeStack.splice(idx, 1);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && escapeStack.length > 0) {
      e.preventDefault();
      escapeStack[escapeStack.length - 1]();
    }
  });
}

// ---------------------------------------------------------------------------
// ModalShell — backdrop + sized container
// ---------------------------------------------------------------------------
const presentations = {
  medium: "max-w-4xl",
  large: "max-w-6xl",
  small: "max-w-sm",
} as const;

export function ModalShell({
  className,
  onClose,
  presentation = "medium",
  children,
}: {
  className?: string;
  onClose: () => void;
  presentation?: keyof typeof presentations;
  children: ReactNode;
}) {
  useEffect(() => registerEscape(onClose), [onClose]);

  return (
    <>
      {/* Backdrop — solid black at moderate opacity, no blur. The terminal
          aesthetic doesn't use frosted glass; the screen darkens behind the
          modal but stays sharp. */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/88"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        onClick={onClose}
      />
      {/* Content — amber hairline border + phosphor edge halo. No shadow. */}
      <motion.div
        className={cn(
          "fixed top-[50%] left-1/2 z-50 w-full -translate-1/2 bg-background hud-panel outline-none",
          presentations[presentation],
          className,
        )}
        style={{ padding: 0 }}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.1 }}
      >
        {children}
      </motion.div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ModalHeader / ModalBody
// ---------------------------------------------------------------------------
export function ModalHeader({ className, title, onClose }: { className?: string; title: string; onClose: () => void }) {
  return (
    <div className={cn("flex items-center justify-between border-b border-amber px-5 py-3", className)}>
      <h2 className="hud-title" style={{ fontSize: "0.875rem" }}>{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="icon-ghost-button size-8"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}

export function ModalBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// ConfirmDialog (internal)
// ---------------------------------------------------------------------------
type ConfirmOptions = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

function ConfirmDialog({
  onClose,
  options,
  onResult,
}: {
  onClose: () => void;
  options: ConfirmOptions;
  onResult: (confirmed: boolean) => void;
}) {
  return (
    <ModalShell
      onClose={() => {
        onResult(false);
        onClose();
      }}
      presentation="small"
    >
      <div className="p-6">
        <h2 className="hud-title" style={{ fontSize: "0.875rem" }}>{options.title}</h2>
        <p className="mt-2 text-xs text-text-2" style={{ letterSpacing: "0.02em" }}>
          {options.description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="default"
            onClick={() => {
              onResult(false);
              onClose();
            }}
          >
            {(options.cancelText ?? "Cancel").toUpperCase()}
          </Button>
          <Button
            variant={options.variant === "destructive" ? "destructive" : "primary"}
            onClick={() => {
              onResult(true);
              onClose();
            }}
          >
            {(options.confirmText ?? "Confirm").toUpperCase()}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// useModal — standalone hook, no provider
// ---------------------------------------------------------------------------
type ModalEntry = { key: string; element: ReactNode };

function useModal() {
  const [stack, setStack] = useState<ModalEntry[]>([]);
  const idCounter = useRef(0);

  const removeByKey = useCallback((key: string) => {
    setStack((prev) => prev.filter((e) => e.key !== key));
  }, []);

  const openModal = useCallback(<T extends { onClose: () => void }>(
    Component: ComponentType<T>,
    props: Omit<T, "onClose">,
  ) => {
    const key = `modal-${++idCounter.current}`;
    const onClose = () => removeByKey(key);
    const element = <Component {...(props as T)} onClose={onClose} key={key} />;
    setStack((prev) => [...prev, { key, element }]);
  }, [removeByKey]);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const key = `confirm-${++idCounter.current}`;
      const onClose = () => removeByKey(key);
      const onResult = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const element = (
        <ConfirmDialog key={key} onClose={onClose} options={options} onResult={onResult} />
      );
      setStack((prev) => [...prev, { key, element }]);
    });
  }, [removeByKey]);

  const portalTarget = typeof document !== "undefined"
    ? (document.getElementById("modal-container") ?? document.body)
    : null;

  const outlet = portalTarget
    ? createPortal(
        <AnimatePresence>
          {stack.map((entry) => entry.element)}
        </AnimatePresence>,
        portalTarget,
      )
    : null;

  return { openModal, confirm, outlet } as const;
}

// ---------------------------------------------------------------------------
// ModalProvider — single app-wide modal stack, exposed via context. Wrap the
// app once at the root; any descendant can call useConfirm() / useOpenModal()
// without rendering its own outlet.
// ---------------------------------------------------------------------------
type ModalApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  openModal: <T extends { onClose: () => void }>(
    Component: ComponentType<T>,
    props: Omit<T, "onClose">,
  ) => void;
};

const ModalContext = createContext<ModalApi | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const { openModal, confirm, outlet } = useModal();
  return (
    <ModalContext.Provider value={{ openModal, confirm }}>
      {children}
      {outlet}
    </ModalContext.Provider>
  );
}

function useModalApi() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useConfirm / useOpenModal must be used inside <ModalProvider>");
  return ctx;
}

/** Returns a `confirm(opts) => Promise<boolean>` backed by a custom modal. */
export function useConfirm() {
  return useModalApi().confirm;
}
