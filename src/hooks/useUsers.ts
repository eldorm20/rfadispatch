import { useEffect, useState } from "react";
import { store } from "../data";
import type { AppUser } from "../types";

/** Real-time list of team members (with roles + teams). */
export function useUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  useEffect(() => store.subscribeUsers(setUsers), []);
  return users;
}

export const updateUser = store.updateUser.bind(store);
export const updateUserRole = store.updateUserRole.bind(store);
