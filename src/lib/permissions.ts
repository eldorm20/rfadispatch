import type { Role } from "../types";

/** Every navigable view in the app. */
export type ViewKey =
  | "dashboard"
  | "gross"
  | "updates"
  | "reports"
  | "accounting"
  | "trash"
  | "admin"
  | "settings";

export interface NavItem {
  key: ViewKey;
  path: string;
  label: string;
  icon: string;
}

export const NAV: NavItem[] = [
  { key: "dashboard", path: "/", label: "Dashboard", icon: "📊" },
  { key: "gross", path: "/gross", label: "Gross Board", icon: "💵" },
  { key: "updates", path: "/updates", label: "Update Board", icon: "📍" },
  { key: "reports", path: "/reports", label: "Reports", icon: "📅" },
  { key: "accounting", path: "/accounting", label: "Accounting", icon: "🧾" },
  { key: "trash", path: "/trash", label: "Trash", icon: "🗑" },
  { key: "admin", path: "/admin", label: "Team", icon: "👥" },
  { key: "settings", path: "/settings", label: "Settings", icon: "⚙" },
];

/** Which views each role can open. Managers/admins see everything. */
const ACCESS: Record<Role, ViewKey[]> = {
  dispatcher: ["dashboard", "gross", "updates", "reports"],
  update_specialist: ["dashboard", "updates", "gross", "reports"],
  manager: ["dashboard", "gross", "updates", "reports", "accounting", "trash", "admin", "settings"],
  accounting: ["dashboard", "accounting", "gross", "reports"],
  admin: ["dashboard", "gross", "updates", "reports", "accounting", "trash", "admin", "settings"],
};

export function canAccess(role: Role, view: ViewKey): boolean {
  return ACCESS[role]?.includes(view) ?? false;
}

export function navForRole(role: Role): NavItem[] {
  return NAV.filter((item) => canAccess(role, item.key));
}

/** Capability flags for fine-grained UI gating. */
export function can(role: Role) {
  const isManager = role === "manager" || role === "admin";
  return {
    bookLoads: role === "dispatcher" || isManager,
    editAnyLoad: isManager,
    addCheckCalls: role === "update_specialist" || role === "dispatcher" || isManager,
    markInvoiced: role === "accounting" || isManager,
    manageTeam: isManager,
    editSettings: isManager,
  };
}
