import { STATUS_LABELS, type LoadStatus } from "../types";

export function StatusPill({ status }: { status: LoadStatus }) {
  return <span className={"status " + status}>{STATUS_LABELS[status]}</span>;
}
