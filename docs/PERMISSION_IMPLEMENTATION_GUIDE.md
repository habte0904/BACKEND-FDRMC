# Permission-Based Access Control Implementation Guide

## Overview
This document provides a guide for implementing permission-based UI controls across all admin pages in the PDRM system.

## What Was Implemented

### 1. Permission Hook (`usePermissions.ts`)
Created a custom hook that checks if the current user has specific permissions:

```typescript
usePermission(resource: string, action: PermissionAction): boolean
```

**Actions**: `'create' | 'view' | 'update' | 'delete'`

### 2. Permission Guard Component (`PermissionGuard.tsx`)
Created a `<Can>` component that conditionally renders children based on permissions:

```tsx
<Can resource="User" action="create">
    <Button>Add User</Button>
</Can>
```

### 3. Updated Pages
- ✅ **Users.tsx** - Fully implemented with permission guards
- ✅ **Teams.tsx** - Fully implemented with permission guards

## How to Apply to Other Pages

For each admin page (Roles, Organizations, Departments, Sectors, Permissions, etc.), follow these steps:

### Step 1: Import the Can Component

Add this import at the top of the file:

```tsx
import { Can } from '../../components/auth/PermissionGuard';
```

### Step 2: Wrap the "Add" Button

Replace:
```tsx
<Button onClick={() => handleOpenModal()}>
    + Add [Resource]
</Button>
```

With:
```tsx
<Can resource="[Resource]" action="create">
    <Button onClick={() => handleOpenModal()}>
        + Add [Resource]
    </Button>
</Can>
```

**Resource Names** (must match backend permissions):
- `User`
- `Role`
- `Organization`
- `Department`
- `Sector`
- `Team`
- `Permission`

### Step 3: Wrap Action Buttons in Table

Replace the action buttons section:

```tsx
<div className="flex items-center space-x-3.5">
    <button onClick={() => handleView(item)}>View</button>
    <button onClick={() => handleEdit(item)}>Edit</button>
    <button onClick={() => handleDelete(item)}>Delete</button>
</div>
```

With:
```tsx
<div className="flex items-center space-x-3.5">
    <Can resource="[Resource]" action="view">
        <button onClick={() => handleView(item)}>View</button>
    </Can>
    <Can resource="[Resource]" action="update">
        <button onClick={() => handleEdit(item)}>Edit</button>
    </Can>
    <Can resource="[Resource]" action="delete">
        <button onClick={() => handleDelete(item)}>Delete</button>
    </Can>
</div>
```

## Permission Naming Convention

Backend permissions follow this pattern:
```
[resource]_[action]
```

Examples:
- `user_create`
- `user_view`
- `user_update`
- `user_delete`
- `role_create`
- `organization_update`
- etc.

## Super Admin Behavior

Super Admins automatically have ALL permissions, regardless of what's assigned to their role. This is handled in the `usePermission` hook.

## Pages to Update

Apply the permission guards to these remaining pages:

1. **Roles.tsx** - Resource: `"Role"`
2. **OrganizationList.tsx** - Resource: `"Organization"`
3. **DepartmentList.tsx** - Resource: `"Department"`
4. **SectorList.tsx** - Resource: `"Sector"`
5. **PermissionList.tsx** - Resource: `"Permission"`
6. **HierarchyManagement.tsx** - May need custom logic
7. **AuditLogs.tsx** - Resource: `"AuditLog"` (view only, no create/update/delete)
8. **EmailLogs.tsx** - Resource: `"EmailLog"` (view only)

## Example: Complete Implementation for Roles.tsx

```tsx
import { Can } from '../../components/auth/PermissionGuard';

// In the header section:
<Can resource="Role" action="create">
    <Button onClick={() => handleOpenModal()}>
        + Add Role
    </Button>
</Can>

// In the table actions:
<div className="flex items-center space-x-3.5">
    <Can resource="Role" action="view">
        <button onClick={() => handleView(role)}>...</button>
    </Can>
    <Can resource="Role" action="update">
        <button onClick={() => handleEdit(role)}>...</button>
    </Can>
    <Can resource="Role" action="delete">
        <button onClick={() => handleDelete(role)}>...</button>
    </Can>
</div>
```

## Testing

To test permissions:

1. Create a test role with limited permissions (e.g., only `user_view`)
2. Assign that role to a test user
3. Login as that user
4. Verify that:
   - Add buttons are hidden for resources without `create` permission
   - Edit buttons are hidden without `update` permission
   - Delete buttons are hidden without `delete` permission
   - View buttons are hidden without `view` permission

## Backend Requirements

Ensure the backend:

1. Returns user permissions in the login/auth response
2. Permissions are stored in `user.permissions` array as strings
3. Permission names follow the `[resource]_[action]` pattern
4. Super admins are identified by `accessLevel === 'super_admin'` or role name

## Notes

- The `Can` component returns `null` (nothing) if permission is denied
- No error messages are shown - buttons simply don't appear
- This is UI-level security only - backend must also enforce permissions
- Always validate permissions on the backend for actual security
