import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export interface ToastAction {
  label: string;
  fn: () => void;
}
type ToastFn = (message: string, action?: ToastAction) => void;

const ToastCtx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [action, setAction] = useState<ToastAction | null>(null);
  const [show, setShow] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback<ToastFn>((message, act) => {
    setMsg(message);
    setAction(act ?? null);
    setShow(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), act ? 6000 : 2600);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={"toast" + (show ? " show" : "")}>
        <span>{msg}</span>
        {action && (
          <button
            className="btn sm"
            style={{ marginLeft: 12 }}
            onClick={() => {
              action.fn();
              setShow(false);
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastFn {
  return useContext(ToastCtx);
}
