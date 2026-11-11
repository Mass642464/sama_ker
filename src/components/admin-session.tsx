"use client";

import { createContext, useContext } from "react";
import type { AdminPermission, AdminSession } from "@/lib/admin-api";

const SessionContext = createContext<AdminSession | null>(null);

export const AdminSessionProvider = SessionContext.Provider;

export function useAdminSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useAdminSession doit être utilisé dans l’administration.");
  return {
    session,
    // Confort d'interface uniquement : le serveur reste l'autorité pour chaque action.
    can: (permission: AdminPermission) => session.permissions.includes(permission),
  };
}
