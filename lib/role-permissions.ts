export const STAFF_PERMISSION_KEYS = [
  "VIEW_FINANCE", "VIEW_COMMISSIONS", "VIEW_REPORTS", "VIEW_AUDIT", "MANAGE_CAMPAIGNS",
] as const;
export type StaffPermission = typeof STAFF_PERMISSION_KEYS[number];
export const STAFF_PERMISSION_LABELS: Record<StaffPermission,string> = {
  VIEW_FINANCE: "Visualizar financeiro",
  VIEW_COMMISSIONS: "Consultar comissões (profissionais: somente próprias)",
  VIEW_REPORTS: "Visualizar relatórios",
  VIEW_AUDIT: "Consultar auditoria",
  MANAGE_CAMPAIGNS: "Gerenciar campanhas e mensagens",
};
export const STAFF_PERMISSION_ROLES = ["MANAGER","RECEPTIONIST","BARBER","ACCOUNTANT"] as const;
export type StaffPermissionRole = typeof STAFF_PERMISSION_ROLES[number];
export type StaffPermissions = Partial<Record<StaffPermissionRole,StaffPermission[]>>;
export const DEFAULT_ROLE_PERMISSIONS: Record<StaffPermissionRole,StaffPermission[]> = {
  MANAGER: ["VIEW_FINANCE","VIEW_COMMISSIONS","VIEW_REPORTS","VIEW_AUDIT","MANAGE_CAMPAIGNS"],
  RECEPTIONIST: [],
  BARBER: ["VIEW_COMMISSIONS"],
  ACCOUNTANT: ["VIEW_FINANCE","VIEW_REPORTS"],
};
export function isPermissionRole(role: string): role is StaffPermissionRole {
  return (STAFF_PERMISSION_ROLES as readonly string[]).includes(role);
}
export function permissionsForRole(role: string, config: StaffPermissions): StaffPermission[] {
  if (role === "OWNER" || role === "ADMIN") return [...STAFF_PERMISSION_KEYS];
  if (!isPermissionRole(role)) return [];
  return config[role] ?? DEFAULT_ROLE_PERMISSIONS[role];
}
export function hasStaffPermission(role: string, config: StaffPermissions, permission: StaffPermission): boolean {
  return permissionsForRole(role,config).includes(permission);
}
