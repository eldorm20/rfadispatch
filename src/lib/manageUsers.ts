import { auth } from "../firebase";
import type { Role } from "../types";

const ENDPOINT = "/.netlify/functions/manage-users";

interface Result {
  ok: boolean;
  error?: string;
  uid?: string;
  link?: string;
}

async function call(body: Record<string, unknown>): Promise<Result> {
  const user = auth?.currentUser;
  if (!user) return { ok: false, error: "Not signed in" };
  try {
    const token = await user.getIdToken();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
    // The function only exists on the deployed Netlify site, not local dev.
    if (res.status === 404) return { ok: false, error: "User management runs on the deployed site only." };
    return (await res.json()) as Result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "request failed" };
  }
}

export const createUserAccount = (p: { email: string; password: string; name: string; role: Role; team: string }) =>
  call({ action: "create", ...p });
export const deleteUserAccount = (uid: string) => call({ action: "delete", uid });
export const resetUserPassword = (uid: string, newPassword: string) => call({ action: "reset", uid, newPassword });
