# IDRMIS Backend API Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [User Management](#user-management)
4. [Organization Management](#organization-management)
5. [Department Management](#department-management)
6. [Role Management](#role-management)
7. [Permission Management](#permission-management)
8. [Hierarchy Management](#hierarchy-management)
9. [Team Management](#team-management)

---

## Introduction

Welcome to the **IDRMIS (Integrated Disaster Risk Management Information System)** Backend API documentation. This document is designed to guide developers and testers in interacting with the system's backend services.

### About the REST API
This API follows **REST (Representational State Transfer)** architectural principles. It provides a standardized way for the frontend and external clients to communicate with the server.

*   **Resources**: entities such as Users, Organizations, and Teams are exposed as resources, identified by unique URIs (e.g., `/api/users/123`).
*   **HTTP Methods**: Standard HTTP verbs are used to define the action performed on a resource:
    *   `GET`: Retrieve information (safe and idempotent).
    *   `POST`: Create a new resource.
    *   `PUT`: Update an existing resource.
    *   `DELETE`: Remove a resource.
*   **Statelessness**: Each request from the client to the server must contain all the information needed to understand and process the request. The server does not store the session state of the client on the server side (JWT tokens are used for authentication).
*   **Response Format**: All API responses are returned in **JSON** (JavaScript Object Notation) format, making it lightweight and easy to parse.

**Base URL**: `http://localhost:5000/api`

---

## Authentication

### Register User
*   **URL:** `/auth/register`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "fullname": "John Doe",
        "email": "john@example.com",
        "password": "password123",
        "phone": "+1234567890" // Optional
    }
    ```
*   **Success Response:** `201 Created`
    ```json
    {
        "message": "User registered. Verification email sent."
    }
    ```

### Login User
*   **URL:** `/auth/login`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "email": "john@example.com",
        "password": "password123"
    }
    ```
*   **Success Response:** `200 OK`
    ```json
    {
        "token": "jwt_token_here",
        "user": { ...user_details }
    }
    ```

### Verify Account
*   **URL:** `/auth/verify`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "email": "john@example.com",
        "code": "123456"
    }
    ```
*   **Success Response:** `200 OK`

### Resend Verification Code
*   **URL:** `/auth/resend`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "email": "john@example.com"
    }
    ```
*   **Success Response:** `200 OK`

### Forgot Password
*   **URL:** `/auth/forgot`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "email": "john@example.com"
    }
    ```
*   **Success Response:** `200 OK`

### Reset Password
*   **URL:** `/auth/reset`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "token": "reset_token_from_email",
        "newPassword": "newpassword123"
    }
    ```
*   **Success Response:** `200 OK`

---

## User Management
**Auth Required:** Yes

### Create User (Admin)
*   **URL:** `/users`
*   **Method:** `POST`
*   **Content-Type:** `multipart/form-data` (if uploading image) or `application/json`
*   **Body:**
    *   `fullname`: string
    *   `email`: string
    *   `password`: string
    *   `roleId`: string (Role ID)
    *   `profileImage`: file (Optional)
*   **Success Response:** `201 Created`

### Get All Users
*   **URL:** `/users`
*   **Method:** `GET`
*   **Success Response:** `200 OK` (Array of users)

### Get User By ID
*   **URL:** `/users/:id`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Update User
*   **URL:** `/users/:id`
*   **Method:** `PUT`
*   **Content-Type:** `multipart/form-data` or `application/json`
*   **Body:** (Any user fields to update)
*   **Success Response:** `200 OK`

### Delete User
*   **URL:** `/users/:id`
*   **Method:** `DELETE`
*   **Success Response:** `200 OK`

---

## Organization Management
**Auth Required:** Yes (Admin)

### Create Organization
*   **URL:** `/organizations`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "name": "Head Office",
        "type": "head_office", // or 'branch'
        "address": "City, Country",
        "contactEmail": "info@example.com",
        "contactPhone": "123456"
    }
    ```
*   **Success Response:** `201 Created`

### Get All Organizations
*   **URL:** `/organizations`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Organization By ID
*   **URL:** `/organizations/:id`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Update Organization
*   **URL:** `/organizations/:id`
*   **Method:** `PUT`
*   **Body:** (Fields to update)
*   **Success Response:** `200 OK`

### Delete Organization
*   **URL:** `/organizations/:id`
*   **Method:** `DELETE`
*   **Success Response:** `200 OK`

---

## Department Management
**Auth Required:** Yes (Admin)

### Create Department
*   **URL:** `/departments`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "name": "IT Department",
        "description": "Tech support",
        "organizationId": "org_id_here"
    }
    ```
*   **Success Response:** `201 Created`

### Get All Departments
*   **URL:** `/departments`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Department By ID
*   **URL:** `/departments/:id`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Update Department
*   **URL:** `/departments/:id`
*   **Method:** `PUT`
*   **Body:** (Fields to update)
*   **Success Response:** `200 OK`

### Delete Department
*   **URL:** `/departments/:id`
*   **Method:** `DELETE`
*   **Success Response:** `200 OK`

### Get Departments by Organization
*   **URL:** `/departments/organization/:orgId`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

---

## Role Management
**Auth Required:** Yes (Admin)

### Create Role
*   **URL:** `/roles`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "name": "Admin",
        "description": "Administrator role"
    }
    ```
*   **Success Response:** `201 Created`

### Get All Roles
*   **URL:** `/roles`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Role By ID
*   **URL:** `/roles/:id`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Update Role
*   **URL:** `/roles/:id`
*   **Method:** `PUT`
*   **Body:** (Fields to update)
*   **Success Response:** `200 OK`

### Delete Role
*   **URL:** `/roles/:id`
*   **Method:** `DELETE`
*   **Success Response:** `200 OK`

### Assign Permission to Role
*   **URL:** `/roles/:roleId/permissions`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "permissionId": "permission_id_here"
    }
    ```
*   **Success Response:** `201 Created`

### Remove Permission from Role
*   **URL:** `/roles/:roleId/permissions/:permissionId`
*   **Method:** `DELETE`
*   **Success Response:** `200 OK`

### Get Role Permissions
*   **URL:** `/roles/:roleId/permissions`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

---

## Permission Management
**Auth Required:** Yes (Admin)

### Create Permission
*   **URL:** `/permissions`
*   **Method:** `POST`
*   **Body:**
    ```json
    {
        "name": "create_user",
        "description": "Can create users",
        "module": "users"
    }
    ```
*   **Success Response:** `201 Created`

### Get All Permissions
*   **URL:** `/permissions`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Permission By ID
*   **URL:** `/permissions/:id`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Update Permission
*   **URL:** `/permissions/:id`
*   **Method:** `PUT`
*   **Body:** (Fields to update)
*   **Success Response:** `200 OK`

### Delete Permission
*   **URL:** `/permissions/:id`
*   **Method:** `DELETE`
*   **Success Response:** `200 OK`

---

## Hierarchy Management
**Auth Required:** Yes

### Delegate Authority
*   **URL:** `/hierarchy/delegate`
*   **Method:** `POST`
*   **Auth:** Directorate+
*   **Body:**
    ```json
    {
        "delegateeId": "user_id_here",
        "authority": "canApproveReports",
        "reason": "Vacation",
        "endDate": "2025-12-31"
    }
    ```
*   **Success Response:** `200 OK`

### Revoke Delegation
*   **URL:** `/hierarchy/delegate/:delegateeId`
*   **Method:** `DELETE`
*   **Auth:** Directorate+
*   **Success Response:** `200 OK`

### Get Delegation History
*   **URL:** `/hierarchy/delegation-history`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Subordinates
*   **URL:** `/hierarchy/subordinates`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get My Hierarchy
*   **URL:** `/hierarchy/my-hierarchy`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Organizational Chart
*   **URL:** `/hierarchy/organizational-chart` (or `/hierarchy/organizational-chart/:userId`)
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Assign Reporting To
*   **URL:** `/hierarchy/assign-reporting`
*   **Method:** `POST`
*   **Auth:** Manager+
*   **Body:**
    ```json
    {
        "userId": "subordinate_id",
        "managerId": "manager_id"
    }
    ```
*   **Success Response:** `200 OK`

---

## Team Management
**Auth Required:** Yes

### Create Team
*   **URL:** `/teams`
*   **Method:** `POST`
*   **Auth:** Directorate+
*   **Body:**
    ```json
    {
        "name": "Frontend Team",
        "department": "department_id",
        "description": "Frontend devs"
    }
    ```
*   **Success Response:** `201 Created`

### Get All Teams
*   **URL:** `/teams`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Team By ID
*   **URL:** `/teams/:teamId`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Update Team
*   **URL:** `/teams/:teamId`
*   **Method:** `PUT`
*   **Auth:** Directorate+
*   **Body:** (Fields to update)
*   **Success Response:** `200 OK`

### Delete Team
*   **URL:** `/teams/:teamId`
*   **Method:** `DELETE`
*   **Auth:** Directorate+
*   **Success Response:** `200 OK`

### Assign Team Leader
*   **URL:** `/teams/:teamId/leader`
*   **Method:** `PUT`
*   **Auth:** Directorate+
*   **Body:**
    ```json
    {
        "userId": "user_id_here"
    }
    ```
*   **Success Response:** `200 OK`

### Add Team Member
*   **URL:** `/teams/:teamId/members`
*   **Method:** `POST`
*   **Auth:** Team Leader+
*   **Body:**
    ```json
    {
        "userId": "user_id_here"
    }
    ```
*   **Success Response:** `200 OK`

### Remove Team Member
*   **URL:** `/teams/:teamId/members/:userId`
*   **Method:** `DELETE`
*   **Auth:** Team Leader+
*   **Success Response:** `200 OK`

### Get Teams by Department
*   **URL:** `/teams/department/:departmentId`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Teams by Organization
*   **URL:** `/teams/organization/:organizationId`
*   **Method:** `GET`
*   **Success Response:** `200 OK`

### Get Team Stats
*   **URL:** `/teams/:teamId/stats`
*   **Method:** `GET`
*   **Success Response:** `200 OK`
