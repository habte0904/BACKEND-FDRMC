# Dashboard Permission Flow Diagram

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│                                                                      │
│  User clicks Dashboard → GET /api/dashboard/stats                   │
│                          (with JWT token in header)                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND - Route Handler                           │
│                   (dashboardRoutes.js)                               │
│                                                                      │
│  router.get('/stats', protect, checkPermission(...), getStats)      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  MIDDLEWARE 1: protect                               │
│                  (authMiddleware.js)                                 │
│                                                                      │
│  1. Extract JWT token from Authorization header                     │
│  2. Verify token signature                                          │
│  3. Decode user ID from token                                       │
│  4. Load user from database with populated fields:                  │
│     - roles                                                          │
│     - organization                                                   │
│     - sector                                                         │
│     - department                                                     │
│  5. Attach user to req.user                                         │
│  6. Call next()                                                      │
│                                                                      │
│  ❌ If fails → 401 Unauthorized                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│           MIDDLEWARE 2: checkPermission('dashboard', 'view')         │
│                  (permissionMiddleware.js)                           │
│                                                                      │
│  1. Check if user.accessLevel === 'super_admin'                     │
│     ✅ If yes → Skip permission check, call next()                   │
│                                                                      │
│  2. Get user's role IDs from req.user.roles                         │
│                                                                      │
│  3. Find Permission where:                                          │
│     - resource = 'dashboard'                                         │
│     - action = 'view'                                                │
│                                                                      │
│  4. Check RolePermission table for:                                 │
│     - roleId IN user's role IDs                                     │
│     - permissionId = dashboard permission ID                        │
│                                                                      │
│  5. If found → Call next()                                          │
│     ❌ If not found → 403 Forbidden                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  CONTROLLER: getStats                                │
│                (dashboardController.js)                              │
│                                                                      │
│  1. Extract req.user (populated by protect middleware)              │
│  2. Call dashboardService.getDashboardStats(req.user)               │
│  3. Return JSON response with stats                                 │
│                                                                      │
│  ❌ If error → 500 Internal Server Error                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                SERVICE: getDashboardStats(user)                      │
│                 (dashboardService.js)                                │
│                                                                      │
│  1. Call buildHierarchyFilter(user)                                 │
│     ┌──────────────────────────────────────────────────────┐       │
│     │  Build filters based on user hierarchy:              │       │
│     │                                                       │       │
│     │  Super Admin:                                         │       │
│     │    → No filters (see everything)                     │       │
│     │                                                       │       │
│     │  Manager/Branch Admin:                               │       │
│     │    → Filter by organization                          │       │
│     │                                                       │       │
│     │  Sector Lead:                                         │       │
│     │    → Filter by organization + sector                 │       │
│     │                                                       │       │
│     │  Directorate:                                         │       │
│     │    → Filter by managed departments                   │       │
│     │                                                       │       │
│     │  Team Leader:                                         │       │
│     │    → Filter by managed teams                         │       │
│     │                                                       │       │
│     │  Expert:                                              │       │
│     │    → Filter by department only                       │       │
│     └──────────────────────────────────────────────────────┘       │
│                                                                      │
│  2. Query database with filters:                                    │
│     - Department.countDocuments(filter.department)                  │
│     - User.countDocuments(filter.user)                              │
│     - Role.countDocuments(filter.role)                              │
│     - Organization.countDocuments(filter.organization)              │
│     - Sector.countDocuments(filter.sector)                          │
│                                                                      │
│  3. If user is super_admin or manager:                              │
│     - Get usersByAccessLevel (aggregation)                          │
│     - Get usersByOrganization (aggregation)                         │
│                                                                      │
│  4. Return stats object with:                                       │
│     - Counts (totalDepartments, totalUsers, etc.)                   │
│     - userInfo (access level, org, sector, dept)                    │
│     - Advanced stats (if applicable)                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Response to Client                                │
│                                                                      │
│  {                                                                   │
│    "totalDepartments": 5,                                            │
│    "totalUsers": 25,                                                 │
│    "totalRoles": 4,                                                  │
│    "totalOrganizations": 1,                                          │
│    "totalSectors": 3,                                                │
│    "userInfo": {                                                     │
│      "accessLevel": "manager",                                       │
│      "organizationType": "head_office",                              │
│      "organizationName": "Main Office",                              │
│      "sectorName": "IT Sector",                                      │
│      "departmentName": "Software Development"                        │
│    },                                                                │
│    "usersByAccessLevel": [...],  // Only for admins/managers        │
│    "usersByOrganization": [...]  // Only for admins/managers        │
│  }                                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND - React Component                        │
│                   (EcommerceMetrics.tsx)                             │
│                                                                      │
│  1. useEffect calls getDashboardStats()                             │
│  2. Display loading state                                           │
│  3. Receive response and update state                               │
│  4. Render:                                                          │
│     - User Context Panel (blue background)                          │
│     - 5 Statistics Cards (color-coded)                              │
│     - Advanced Stats (conditional, admins only)                     │
│                                                                      │
│  ❌ If error → Display error message                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema Relationships

```
┌──────────────┐
│     User     │
│──────────────│
│ _id          │
│ email        │
│ accessLevel  │◄────────┐
│ roles[]      │─────┐   │
│ organization │─┐   │   │
│ sector       │ │   │   │
│ department   │ │   │   │
└──────────────┘ │   │   │
                 │   │   │
                 │   │   │
┌────────────────▼───┐   │   ┌──────────────┐
│   Organization     │   │   │     Role     │
│────────────────────│   │   │──────────────│
│ _id                │   └──►│ _id          │
│ name               │       │ name         │
│ type               │       │ type         │
└────────────────────┘       └──────┬───────┘
                                    │
                                    │
                             ┌──────▼──────────────┐
                             │  RolePermission     │
                             │─────────────────────│
                             │ roleId          ────┼──┐
                             │ permissionId    ────┼─┐│
                             └─────────────────────┘ ││
                                                     ││
                                    ┌────────────────┘│
                                    │                 │
                             ┌──────▼──────────┐     │
                             │   Permission    │◄────┘
                             │─────────────────│
                             │ _id             │
                             │ resource        │ (e.g., 'dashboard')
                             │ action          │ (e.g., 'view')
                             │ name            │ (e.g., 'View Dashboard')
                             └─────────────────┘
```

## Access Level Hierarchy

```
                    ┌──────────────────┐
                    │   Super Admin    │
                    │  (All Access)    │
                    └────────┬─────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
    ┌───────▼────────┐              ┌────────▼────────┐
    │    Manager     │              │  Branch Admin   │
    │ (Organization) │              │    (Branch)     │
    └───────┬────────┘              └─────────────────┘
            │
    ┌───────▼────────┐
    │  Sector Lead   │
    │   (Sector)     │
    └───────┬────────┘
            │
    ┌───────▼────────┐
    │  Directorate   │
    │ (Departments)  │
    └───────┬────────┘
            │
    ┌───────▼────────┐
    │  Team Leader   │
    │    (Teams)     │
    └───────┬────────┘
            │
    ┌───────▼────────┐
    │     Expert     │
    │ (Department)   │
    └────────────────┘
```

## Permission Check Logic

```
START
  │
  ▼
Is user authenticated?
  │
  ├─ NO ──► 401 Unauthorized
  │
  ▼ YES
  │
Is user super_admin?
  │
  ├─ YES ──► GRANT ACCESS (skip permission check)
  │
  ▼ NO
  │
Does user have roles?
  │
  ├─ NO ──► 403 Forbidden
  │
  ▼ YES
  │
Find Permission(resource='dashboard', action='view')
  │
  ├─ NOT FOUND ──► 403 Forbidden
  │
  ▼ FOUND
  │
Check RolePermission(roleId IN user.roles, permissionId=permission._id)
  │
  ├─ NOT FOUND ──► 403 Forbidden
  │
  ▼ FOUND
  │
GRANT ACCESS
  │
  ▼
Apply hierarchical filters based on user.accessLevel
  │
  ▼
Return filtered dashboard data
  │
  ▼
END
```
