import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { motion } from '@/theme/tokens';

import { ToastContext } from './ToastContext';
import { ToastView } from './ToastView';
import type { ToastOptions, ToastState } from './types';

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      counter.current += 1;
      const durationMs =
        options.durationMs ?? (options.action ? motion.toastWithActionMs : motion.toastMs);
      setToast({ ...options, durationMs, id: counter.current });
      timer.current = setTimeout(hide, durationMs);
    },
    [hide],
  );

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onHide={hide} /> : null}
    </ToastContext.Provider>
  );
}
