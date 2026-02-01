import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Permission levels
export const PERMISSIONS = {
  // Who can edit MSL, journals, roll calls
  ADMIN_EDIT: ['clerk', 'senate_leader', 'house_leader'],
  // Who can submit bills/resolutions
  SUBMIT_LEGISLATION: ['senator', 'representative', 'clerk', 'senate_leader', 'house_leader'],
  // Who can manage user roles
  MANAGE_ROLES: ['clerk', 'senate_leader', 'house_leader'],
  // Legislators (for voting)
  LEGISLATOR: ['senator', 'representative', 'senate_leader', 'house_leader'],
};

export function hasPermission(user, permissionType) {
  if (!user?.legislature_role) return false;
  return PERMISSIONS[permissionType]?.includes(user.legislature_role) || false;
}

export function canEditBill(user, bill) {
  if (!user?.legislature_role) return false;
  
  // Clerk and leaders can always edit
  if (PERMISSIONS.ADMIN_EDIT.includes(user.legislature_role)) return true;
  
  // Sponsors can edit their own bills
  const userDisplayName = user.display_name || user.full_name;
  if (bill.sponsors?.some(s => s.toLowerCase().includes(userDisplayName?.toLowerCase()))) {
    return true;
  }
  
  // Check by email in sponsor_emails if available
  if (bill.sponsor_emails?.includes(user.email)) return true;
  
  return false;
}

export function getRoleDisplay(role) {
  const roleNames = {
    citizen: 'Citizen',
    senator: 'Senator',
    representative: 'Representative',
    clerk: 'Clerk',
    senate_leader: 'Senate Leader',
    house_leader: 'House Leader',
  };
  return roleNames[role] || 'Unknown';
}

export default function PermissionGuard({ user, permission, children, fallback }) {
  if (!hasPermission(user, permission)) {
    return fallback || (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-medium text-slate-900 mb-1">Access Restricted</h3>
          <p className="text-sm text-slate-500">You don't have permission to access this feature.</p>
        </CardContent>
      </Card>
    );
  }
  
  return children;
}