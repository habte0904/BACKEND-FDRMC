# Table of Contents
1. [Organization API Documentation](#organization-api-documentation)
    - [1. Create Organization](#1-create-organization)
    - [2. Get All Organizations](#2-get-all-organizations)
    - [3. Get Organization by ID](#3-get-organization-by-id)
    - [4. Update Organization](#4-update-organization)
    - [5. Delete Organization](#5-delete-organization)
2. [Department API Documentation](#department-api-documentation)
    - [1. Create Department](#1-create-department)
    - [2. Get All Departments](#2-get-all-departments)
    - [3. Get Department by ID](#3-get-department-by-id)
    - [4. Update Department](#4-update-department)
    - [5. Delete Department](#5-delete-department)
3. [Roles API Documentation](#roles-api-documentation)
    - [1. Create Role](#1-create-role)
    - [2. Get All Roles](#2-get-all-roles)
    - [3. Get Role by ID](#3-get-role-by-id)
    - [4. Get Role Permissions](#4-get-role-permissions)
    - [5. Assign Permission](#5-assign-permission)
    - [6. Remove Permission](#6-remove-permission)
4. [Permissions API Documentation](#permissions-api-documentation)
    - [1. Create Permission](#1-create-permission)
    - [2. Get All Permissions](#2-get-all-permissions)
5. [User API Documentation](#user-api-documentation)
    - [1. Create User](#1-create-user)
    - [2. Get All Users](#2-get-all-users)
    - [3. Get User by ID](#3-get-user-by-id)
    - [4. Update User](#4-update-user)
    - [5. Delete User](#5-delete-user)
6. [Authentication API Documentation](#authentication-api-documentation)
    - [1. Register User](#1-register-user)
    - [2. Login User](#2-login-user)
    - [3. Verify Account](#3-verify-account)
    - [4. Forgot Password](#4-forgot-password)
    - [5. Reset Password](#5-reset-password)

---

# Organization API Documentation
**Base URL:** `/api/organizations`

## 1. Create Organization
Creates a new organization.

- **URL:** `/`
- **Method:** `POST`
- **Content-Type:** `application/json`

**Body Parameters:**
- `name` (string, required): Name of the organization.
- `type` (string, required): Type of organization. One of: `head_office`, `branch`, `subcity`, `woreda`.
- `parentId` (ObjectId, optional): ID of the parent organization.

**Request Example:**
```json
{
  "name": "Addis Ababa Head Office",
  "type": "head_office"
}
```

**Success Response:**
- **Code:** `201 Created`
- **Content:**
```json
{
  "id": "60d5ecb54...",
  "name": "Addis Ababa Head Office",
  "type": "head_office",
  "parentId": null
}
```

**Error Response:**
- **Code:** `400 Bad Request`
- **Content:** `{ "message": "Validation Error", "errors": [...] }`

---

## 2. Get All Organizations
Retrieves a list of all organizations.

- **URL:** `/`
- **Method:** `GET`

**Success Response:**
- **Code:** `200 OK`
- **Content:**
```json
[
  {
    "id": "60d5ecb54...",
    "name": "Addis Ababa Head Office",
    "type": "head_office",
    "parentId": null
  }
]
```

---

## 3. Get Organization by ID
Retrieves details of a specific organization.

- **URL:** `/:id`
- **Method:** `GET`
- **URL Params:** `id=[string]`

**Success Response:**
- **Code:** `200 OK`
- **Content:** Organization object (with populated `parentId`).

**Error Response:**
- **Code:** `404 Not Found`
- **Content:** `{ "message": "Organization not found" }`

---

## 4. Update Organization
Updates an existing organization.

- **URL:** `/:id`
- **Method:** `PUT`
- **URL Params:** `id=[string]`
- **Body Parameters:** Any of the Organization fields (`name`, `type`, `parentId`).

**Request Example:**
```json
{
  "name": "Updated Name"
}
```

**Success Response:**
- **Code:** `200 OK`
- **Content:** Updated Organization object.

**Error Response:**
- **Code:** `404 Not Found`

---

## 5. Delete Organization
Deletes an organization.

URL: 
/:id
Method: DELETE
URL Params: id=[string]
Success Response:

Code: 200 OK
Content: { "message": "Organization deleted" }
Error Response:

Code: 404 Not Found