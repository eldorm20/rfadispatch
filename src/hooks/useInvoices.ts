import { useEffect, useState } from "react";
import { store } from "../data";
import type { Invoice } from "../types";

/** Real-time list of carrier invoices, newest first. */
export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const unsub = store.subscribeInvoices((rows) => {
      if (!alive) return;
      setInvoices(rows);
      setLoading(false);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return { invoices, loading };
}

export const createInvoice = store.createInvoice.bind(store);
export const updateInvoice = store.updateInvoice.bind(store);
