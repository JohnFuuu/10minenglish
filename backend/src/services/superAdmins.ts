// Super admins are named in SUPER_BACKEND_ADMIN: a comma-separated list of
// Admin emails (spaces and capitals ignored). Only they may deactivate,
// reactivate, or remove other Admins, and nobody can do those things to them
// from the app — demoting one means editing the setting. Read on each call,
// so the list reflects the current environment. Unset or empty means nobody.
export function superAdminEmails(): Set<string> {
  return new Set(
    (process.env.SUPER_BACKEND_ADMIN ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuperAdmin(email: string | undefined): boolean {
  return Boolean(email) && superAdminEmails().has(email!.toLowerCase());
}
