# Role-Based Dashboard Permissions Implementation

## Overview
This implementation adds role-based permission checks to the dashboard, ensuring users only see data they have permission to access based on their role and organizational hierarchy.

## Features Implemented

### 1. Permission Middleware (`permissionMiddleware.js`)
- **`checkPermission(resource, action)`**: Middleware to verify if a user has a specific permission
- **`checkAnyPermission(permissions)`**: Middleware to check if user has any of the specified permissions
- **`getUserPermissions(user)`**: Helper function to get all permissions for a user

### 2. Enhanced Dashboard Service (`dashboardService.js`)
The dashboard service now filters data based on user hierarchy:

#### Access Level Filtering
- **Super Admin**: Sees all data across the entire system
- **Manager**: Sees data within their organization
- **Branch Admin**: Sees data within their branch
- **Sector Lead**: Sees data within their sector (head office only)
- **Directorate**: Sees data for their managed departments
- **Team Leader**: Sees data for their managed teams
- **Expert**: Sees data only for their department

#### Statistics Returned
- Total Organizations (filtered by access)
- Total Sectors (filtered by access)
- Total Departments (filtered by access)
- Total Users (filtered by access)
- Total Roles (filtered by organization type)
- User Context Information (access level, organization, sector, department)
- Advanced Statistics (for admins/managers):
  - Users by Access Level
  - Users by Organization

### 3. Updated Dashboard Controller (`dashboardController.js`)
- Passes authenticated user to the service
- Includes proper error handling and logging

### 4. Protected Dashboard Routes (`dashboardRoutes.js`)
- Uses `protect` middleware for authentication
- Uses `checkPermission('dashboard', 'view')` to verify dashboard access

### 5. Enhanced Frontend Components

#### Updated TypeScript Interface (`dashboardService.ts`)
```typescript
export interface DashboardStats {
    totalDepartments: number;
    totalUsers: number;
    totalRoles: number;
    totalOrganizations: number;
    totalSectors: number;
    userInfo: {
        accessLevel: string;
        organizationType: string;
        organizationName: string;
        sectorName: string;
        departmentName: string;
    };
    usersByAccessLevel?: Array<{
        accessLevel: string;
        count: number;
    }>;
    usersByOrganization?: Array<{
        organizationId: string;
        organizationName: string;
        count: number;
    }>;
}
```

#### Enhanced Dashboard Component (`EcommerceMetrics.tsx`)
- Displays user context information (access level, organization, sector, department)
- Shows 5 main statistics cards with color-coded icons
- Conditionally displays advanced statistics for admins/managers
- Includes loading and error states
- Responsive grid layout

## Setup Instructions

### 1. Run the Migration Script
Execute the migration script to add dashboard permissions to the database:

```bash
cd BACKEND
node scripts/addDashboardPermissions.js
```

This script will:
- Create the "View Dashboard" permission
- Assign it to all existing roles
- Display a summary of changes

### 2. Verify Database Changes
Check that the following were created:
- Permission: `{ resource: 'dashboard', action: 'view', name: 'View Dashboard' }`
- RolePermission entries linking all roles to the dashboard permission

### 3. Test the Implementation
1. Log in as different users with different roles
2. Navigate to the dashboard
3. Verify that:
   - Users can only see data within their scope
   - Super admins see all data
   - Department-level users only see their department's data
   - Error messages appear if permissions are missing

## Hierarchical Data Filtering

### Organization Level
```javascript
if (user.organization) {
    filters.user.organization = user.organization._id;
    filters.department.organization = user.organization._id;
}
```

### Sector Level (Head Office)
```javascript
if (user.sector && user.organizationType === 'head_office') {
    filters.department.sector = user.sector._id;
    filters.user.sector = user.sector._id;
}
```

### Department Level
```javascript
if (['expert', 'team_leader'].includes(user.accessLevel)) {
    filters.department._id = user.department._id;
    filters.user.department = user.department._id;
}
```

### Managed Entities
```javascript
// Directorate sees managed departments
if (user.accessLevel === 'directorate' && user.managedDepartments?.length > 0) {
    filters.department._id = { $in: user.managedDepartments.map(d => d._id) };
}

// Team leader sees managed teams
if (user.accessLevel === 'team_leader' && user.managedTeams?.length > 0) {
    filters.user.team = { $in: user.managedTeams.map(t => t._id) };
}
```

## Permission Check Flow

1. **User Authentication** (`protect` middleware)
   - Verifies JWT token
   - Loads user with populated roles, organization, sector, department

2. **Permission Verification** (`checkPermission` middleware)
   - Super admins bypass permission checks
   - Looks up the required permission in the database
   - Checks if any of the user's roles have that permission
   - Returns 403 if permission is denied

3. **Data Filtering** (Dashboard Service)
   - Builds hierarchical filters based on user's position
   - Queries database with appropriate filters
   - Returns scoped statistics

4. **Frontend Display** (React Component)
   - Displays user context information
   - Shows filtered statistics
   - Conditionally renders advanced stats for privileged users

## Error Handling

### Backend Errors
- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: User lacks required permission
- **500 Internal Server Error**: Database or server error

### Frontend Errors
- Loading state while fetching data
- Error display with user-friendly messages
- Graceful degradation if optional data is missing

## Security Considerations

1. **Server-Side Filtering**: All data filtering happens on the backend
2. **Permission Verification**: Every request checks permissions
3. **No Data Leakage**: Users never receive data outside their scope
4. **Populated User Data**: User object includes all necessary hierarchy information
5. **Super Admin Override**: Super admins have unrestricted access

## Future Enhancements

1. **Caching**: Implement Redis caching for permission lookups
2. **Audit Logging**: Log all dashboard access attempts
3. **Custom Dashboards**: Allow users to customize their dashboard view
4. **Real-time Updates**: WebSocket integration for live statistics
5. **Export Functionality**: Allow users to export their dashboard data
6. **Date Range Filters**: Add time-based filtering for statistics
7. **Visualization**: Add charts and graphs for better data representation

## Troubleshooting

### Users Can't Access Dashboard
1. Verify user has a role assigned
2. Check that the role has the "View Dashboard" permission
3. Run the migration script if permissions are missing
4. Check backend logs for specific error messages

### Users See Wrong Data
1. Verify user's organization, sector, and department assignments
2. Check user's accessLevel field
3. Review the hierarchical filtering logic
4. Test with a super_admin account to see all data

### Frontend Shows Error
1. Check browser console for detailed error messages
2. Verify API endpoint is accessible
3. Check that JWT token is valid and not expired
4. Ensure CORS is properly configured

## Files Modified/Created

### Backend
- ✅ `middleware/permissionMiddleware.js` (NEW)
- ✅ `services/dashboardService.js` (MODIFIED)
- ✅ `controllers/dashboardController.js` (MODIFIED)
- ✅ `routes/dashboardRoutes.js` (MODIFIED)
- ✅ `scripts/addDashboardPermissions.js` (NEW)

### Frontend
- ✅ `api/dashboardService.ts` (MODIFIED)
- ✅ `components/ecommerce/EcommerceMetrics.tsx` (MODIFIED)

## Testing Checklist

- [ ] Run migration script successfully
- [ ] Super admin can see all data
- [ ] Manager sees organization-scoped data
- [ ] Branch admin sees branch-scoped data
- [ ] Sector lead sees sector-scoped data
- [ ] Directorate sees managed departments' data
- [ ] Team leader sees team-scoped data
- [ ] Expert sees department-scoped data
- [ ] User without permission gets 403 error
- [ ] Frontend displays user context correctly
- [ ] Advanced stats show only for admins/managers
- [ ] Loading and error states work properly
