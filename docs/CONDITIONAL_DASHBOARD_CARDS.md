# Conditional Dashboard Cards - Permission-Based Visibility

## Overview
This enhancement implements **granular permission-based visibility** for dashboard statistics cards. Users will only see the dashboard cards they have permission to view, creating a truly personalized dashboard experience.

## How It Works

### Permission-Based Card Visibility

Each dashboard statistic card now requires a specific permission:

| Card | Required Permission | Resource | Action |
|------|-------------------|----------|--------|
| **Organizations** | View Organizations | `organization` | `view` |
| **Sectors** | View Sectors | `sector` | `view` |
| **Departments** | View Departments | `department` | `view` |
| **Users** | View Users | `user` | `view` |
| **Roles** | View Roles | `role` | `view` |

### Backend Logic

#### 1. Permission Checking (`dashboardService.js`)
```javascript
const getUserDashboardPermissions = async (user) => {
    // Super admin has all permissions
    if (user.accessLevel === 'super_admin') {
        return {
            canViewOrganizations: true,
            canViewSectors: true,
            canViewDepartments: true,
            canViewUsers: true,
            canViewRoles: true,
            canViewAdvancedStats: true
        };
    }

    // Check each permission against user's roles
    // Returns boolean flags for each card
};
```

#### 2. Conditional Data Fetching
The backend only queries and returns data for cards the user has permission to view:

```javascript
if (permissions.canViewOrganizations) {
    stats.totalOrganizations = await Organization.countDocuments(filter.organization);
}
// Data is NOT fetched if permission is false
```

### Frontend Logic

#### 1. Permission Flags in Response
```typescript
interface DashboardStats {
    permissions: {
        canViewOrganizations: boolean;
        canViewSectors: boolean;
        canViewDepartments: boolean;
        canViewUsers: boolean;
        canViewRoles: boolean;
        canViewAdvancedStats: boolean;
    };
    totalOrganizations?: number;  // Optional - only present if permitted
    totalSectors?: number;
    // ...
}
```

#### 2. Conditional Rendering
```tsx
{stats.permissions.canViewOrganizations && (
    <div className="card">
        {/* Organizations card only renders if permission is true */}
    </div>
)}
```

## User Experience

### Example Scenarios

#### Scenario 1: Super Admin
**Permissions**: All  
**Sees**: All 5 cards + Advanced Statistics
- Organizations
- Sectors
- Departments
- Users
- Roles

#### Scenario 2: Manager (with all view permissions)
**Permissions**: All view permissions  
**Sees**: All 5 cards + Advanced Statistics (if manager/above)

#### Scenario 3: Department Expert (limited permissions)
**Permissions**: View Departments, View Users  
**Sees**: Only 2 cards
- Departments
- Users

#### Scenario 4: User with No Permissions
**Permissions**: None  
**Sees**: Only the user context information panel (no statistic cards)

## Migration

### Running the Migration

```bash
cd BACKEND
node scripts/addDashboardCardPermissions.js
```

### What the Migration Does

1. **Creates Permissions**:
   - View Organizations
   - View Sectors
   - View Departments
   - View Users
   - View Roles

2. **Assigns to All Roles**: By default, all permissions are assigned to all existing roles

3. **Displays Summary**: Shows what was created and assigned

### Customizing Permissions Per Role

After running the migration, you can customize which roles have which permissions:

```javascript
// Example: Remove "View Organizations" from a specific role
const role = await Role.findOne({ name: 'Expert' });
const permission = await Permission.findOne({ 
    resource: 'organization', 
    action: 'view' 
});

await RolePermission.deleteOne({
    roleId: role._id,
    permissionId: permission._id
});
```

## API Response Examples

### Super Admin Response
```json
{
    "permissions": {
        "canViewOrganizations": true,
        "canViewSectors": true,
        "canViewDepartments": true,
        "canViewUsers": true,
        "canViewRoles": true,
        "canViewAdvancedStats": true
    },
    "totalOrganizations": 5,
    "totalSectors": 12,
    "totalDepartments": 45,
    "totalUsers": 230,
    "totalRoles": 8,
    "userInfo": { ... },
    "usersByAccessLevel": [ ... ],
    "usersByOrganization": [ ... ]
}
```

### Limited User Response
```json
{
    "permissions": {
        "canViewOrganizations": false,
        "canViewSectors": false,
        "canViewDepartments": true,
        "canViewUsers": true,
        "canViewRoles": false,
        "canViewAdvancedStats": false
    },
    "totalDepartments": 3,
    "totalUsers": 15,
    "userInfo": { ... }
    // Note: No totalOrganizations, totalSectors, totalRoles
    // Note: No advanced stats
}
```

## Benefits

### 1. **Enhanced Security**
- Users cannot see data they don't have permission to view
- No data leakage through the API
- Backend enforces permissions before querying database

### 2. **Improved Performance**
- Backend only queries data the user can see
- Reduces unnecessary database queries
- Faster response times for users with limited permissions

### 3. **Better User Experience**
- Clean, uncluttered dashboard
- Users only see relevant information
- No confusing "0" counts for data they can't access

### 4. **Flexible Permission Management**
- Granular control over each statistic card
- Easy to customize per role
- Can be adjusted without code changes

## Testing

### Test Cases

#### 1. Test Super Admin
```bash
# Should see all cards
curl -H "Authorization: Bearer <super_admin_token>" \
     http://localhost:5000/api/dashboard/stats
```

#### 2. Test User with Partial Permissions
```bash
# Should see only permitted cards
curl -H "Authorization: Bearer <user_token>" \
     http://localhost:5000/api/dashboard/stats
```

#### 3. Test User with No Permissions
```bash
# Should see no cards (only user context)
curl -H "Authorization: Bearer <no_perm_token>" \
     http://localhost:5000/api/dashboard/stats
```

### Verification Checklist

- [ ] Migration script runs successfully
- [ ] All permissions created in database
- [ ] Permissions assigned to roles
- [ ] Super admin sees all cards
- [ ] User with partial permissions sees only permitted cards
- [ ] User with no permissions sees no cards
- [ ] Advanced stats only show for authorized users
- [ ] Frontend conditionally renders cards
- [ ] No console errors in browser
- [ ] API returns correct permission flags

## Troubleshooting

### Issue: All Users See All Cards

**Cause**: Migration assigned all permissions to all roles  
**Solution**: Manually remove specific permissions from roles that shouldn't have them

```bash
# Use MongoDB Compass or mongo shell
db.rolepermissions.deleteMany({
    roleId: ObjectId("role_id_here"),
    permissionId: ObjectId("permission_id_here")
})
```

### Issue: User Sees No Cards

**Cause**: User's role doesn't have any view permissions  
**Solution**: Assign at least one view permission to the user's role

```bash
cd BACKEND
node scripts/checkUserPermissions.js user@example.com
```

### Issue: Cards Show "0" Instead of Hiding

**Cause**: Frontend not checking permissions properly  
**Solution**: Verify the conditional rendering logic in `EcommerceMetrics.tsx`

## Files Modified

### Backend
- ✅ `services/dashboardService.js` - Added permission checking logic
- ✅ `scripts/addDashboardCardPermissions.js` - New migration script

### Frontend
- ✅ `api/dashboardService.ts` - Updated interface with permissions
- ✅ `components/ecommerce/EcommerceMetrics.tsx` - Conditional rendering

## Future Enhancements

1. **UI Permission Manager**: Admin interface to manage permissions
2. **Role Templates**: Pre-configured permission sets for common roles
3. **Permission Inheritance**: Child roles inherit parent permissions
4. **Temporary Permissions**: Time-limited access to specific cards
5. **Permission Audit Log**: Track permission changes over time

## Summary

✅ Dashboard cards now respect role-based permissions  
✅ Users only see cards they have permission to view  
✅ Backend only fetches data for permitted cards  
✅ Improved security and performance  
✅ Flexible and granular permission control  

---

**Result**: A truly personalized dashboard that adapts to each user's permissions!
