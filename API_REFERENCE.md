# API Reference - PixelForge Nexus

Complete API documentation with endpoints, request/response examples, error codes, and rate limits.

## 📋 Table of Contents

1. General Information
2. Authentication Endpoints
3. User Management Endpoints
4. Project Management Endpoints
5. Document Management Endpoints
6. Error Codes & Responses
7. Rate Limiting
8. Examples & Webhooks

---

## 📌 General Information

### Base URL
```
Production: https://api.yourdomain.com
Development: http://localhost:5000
```

### Content-Type
All requests require: `Content-Type: application/json`

### Authentication
All endpoints (except `/auth/login`) require:
```
Authorization: Bearer {accessToken}
```

Access tokens expire in 15 minutes. Use `/auth/refresh-token` to obtain a new one.

### Response Format
```json
{
  "success": true,
  "data": { /* endpoint-specific */ },
  "message": "Operation successful"
}
```

### Pagination
List endpoints support:
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `sort` (default: -createdAt)

---

## 🔐 Authentication Endpoints

### 1. Login

**Endpoint:** `POST /api/auth/login`

**Rate Limit:** 5 attempts per 15 minutes per username+IP

**Request:**
```json
{
  "username": "admin@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "admin@example.com",
      "fullName": "Admin User",
      "role": "admin",
      "lastLogin": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Error (401):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Error (429) - Account Locked:**
```json
{
  "success": false,
  "message": "Account locked. Try again later."
}
```

**Security Notes:**
- Password must be 12+ characters
- Must contain uppercase, lowercase, numbers, special characters
- Failed attempts increment counter
- Account locks after 5 failed attempts for 2 hours

---

### 2. Refresh Token

**Endpoint:** `POST /api/auth/refresh-token`

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "15m"
  }
}
```

**Error (401):**
```json
{
  "success": false,
  "message": "Invalid or expired refresh token"
}
```

**Security Notes:**
- Refresh tokens expire in 7 days
- Can only be used once
- Returned tokens are automatically stored in browser localStorage
- If compromised, rotate immediately

---

### 3. Get Current User

**Endpoint:** `GET /api/auth/me`

**Authorization:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "admin@example.com",
    "fullName": "Admin User",
    "role": "admin",
    "active": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLogin": "2024-01-15T10:30:00Z"
  }
}
```

---

### 4. Change Password

**Endpoint:** `PUT /api/auth/change-password`

**Authorization:** Required (Bearer token)

**Request:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error (401):**
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

**Security Notes:**
- Old password must be verified
- New password must meet complexity requirements
- Must differ from current password
- Changes invalidate all active refresh tokens

---

### 5. Logout

**Endpoint:** `POST /api/auth/logout`

**Authorization:** Required (Bearer token)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Security Notes:**
- Server-side token revocation (optional)
- Client must delete localStorage tokens
- Logs audit entry with timestamp and IP

---

## 👥 User Management Endpoints

```
NOTE: All user management endpoints require admin role.
Admin-only operations are indicated with [ADMIN].
```

### 1. List Users [ADMIN]

**Endpoint:** `GET /api/admin/users`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `role`: Filter by role (admin, project-lead, developer)
- `active`: Filter by status (true/false)
- `sort`: Sort field (default: -createdAt)

**Example Request:**
```bash
GET /api/admin/users?page=1&limit=20&role=developer&active=true
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "developer",
      "active": true,
      "createdAt": "2024-01-10T12:00:00Z",
      "lastLogin": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

---

### 2. Create User [ADMIN]

**Endpoint:** `POST /api/admin/users`

**Request:**
```json
{
  "email": "newuser@example.com",
  "fullName": "Jane Smith",
  "role": "project-lead",
  "tempPassword": "TempPass123!"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "email": "newuser@example.com",
    "fullName": "Jane Smith",
    "role": "project-lead",
    "active": true,
    "createdAt": "2024-01-15T11:00:00Z"
  },
  "message": "User created. Temporary password sent to email."
}
```

**Validation Rules:**
- Email: Valid email format, unique
- Full Name: 2-100 characters
- Role: One of [admin, project-lead, developer]
- Temporary password must be 12+ characters with complexity

---

### 3. Get User [ADMIN]

**Endpoint:** `GET /api/admin/users/:userId`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "developer",
    "active": true,
    "createdAt": "2024-01-10T12:00:00Z",
    "lastLogin": "2024-01-15T10:30:00Z",
    "loginAttempts": 0,
    "accountLocked": false
  }
}
```

---

### 4. Update User [ADMIN]

**Endpoint:** `PUT /api/admin/users/:userId`

**Request:**
```json
{
  "fullName": "Jane Smith Updated",
  "role": "admin"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "email": "newuser@example.com",
    "fullName": "Jane Smith Updated",
    "role": "admin",
    "active": true
  }
}
```

**Rules:**
- Cannot update own role (prevent self-elevation)
- Cannot update own active status (prevent self-deactivation)

---

### 5. Delete User [ADMIN]

**Endpoint:** `DELETE /api/admin/users/:userId`

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Security:**
- Logs deletion with admin email and timestamp
- Archive user data before deletion (GDPR)
- Transfer owned resources to admin user

---

### 6. Reset User Password [ADMIN]

**Endpoint:** `POST /api/admin/users/:userId/reset-password`

**Request:**
```json
{
  "newPassword": "NewTempPass456!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset. User notified via email."
}
```

---

### 7. Deactivate User [ADMIN]

**Endpoint:** `PATCH /api/admin/users/:userId/deactivate`

**Response (200):**
```json
{
  "success": true,
  "message": "User deactivated"
}
```

**Security:**
- Deactivated users cannot login
- Existing sessions remain valid until token expires
- Resources assigned to user remain visible but cannot be modified

---

## 📊 Project Management Endpoints

### 1. List Projects

**Endpoint:** `GET /api/projects`

**Authorization:** Required

**Role-Based Responses:**
- Admin: All projects
- Project Lead: Own projects + assigned projects
- Developer: Only assigned projects

**Query Parameters:**
- `page`, `limit`, `sort`: Pagination controls
- `status`: Filter (active, completed, on-hold, cancelled)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "name": "Mobile App Redesign",
      "description": "Redesign mobile app interface",
      "status": "active",
      "priority": "high",
      "deadline": "2024-06-30",
      "projectLead": {
        "_id": "507f1f77bcf86cd799439011",
        "email": "lead@example.com",
        "fullName": "Project Lead"
      },
      "assignedDevelopers": 3,
      "createdAt": "2024-01-10T12:00:00Z",
      "createdBy": {
        "email": "admin@example.com",
        "fullName": "Admin User"
      }
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

---

### 2. Create Project

**Endpoint:** `POST /api/projects`

**Authorization:** Required (Admin, Project Lead)

**Request:**
```json
{
  "name": "API Enhancement",
  "description": "Add new endpoints and improve performance",
  "projectLead": "507f1f77bcf86cd799439011",
  "assignedDevelopers": [
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ],
  "deadline": "2024-06-30",
  "priority": "medium",
  "status": "active"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439025",
    "name": "API Enhancement",
    "description": "Add new endpoints and improve performance",
    "projectLead": "507f1f77bcf86cd799439011",
    "assignedDevelopers": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
    "deadline": "2024-06-30",
    "priority": "medium",
    "status": "active",
    "createdBy": "507f1f77bcf86cd799439001",
    "createdAt": "2024-01-15T11:30:00Z"
  },
  "message": "Project created successfully"
}
```

**Validation:**
- Name: 1-200 characters, required
- Deadline: Must be future date
- Project Lead: Must be existing user with project-lead or admin role
- Developers: Must be existing users

---

### 3. Get Project Details

**Endpoint:** `GET /api/projects/:projectId`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "name": "Mobile App Redesign",
    "description": "Redesign mobile app interface",
    "status": "active",
    "priority": "high",
    "deadline": "2024-06-30",
    "projectLead": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "lead@example.com",
      "fullName": "Project Lead Name"
    },
    "assignedDevelopers": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "email": "dev1@example.com",
        "fullName": "Developer 1"
      }
    ],
    "createdBy": {
      "_id": "507f1f77bcf86cd799439001",
      "email": "admin@example.com"
    },
    "createdAt": "2024-01-10T12:00:00Z",
    "lastModified": "2024-01-15T09:00:00Z",
    "documentCount": 5
  }
}
```

**Authorization:**
- Admin: Can access any project
- Project Lead: Can access own or assigned projects
- Developer: Can only access assigned projects

---

### 4. Update Project

**Endpoint:** `PUT /api/projects/:projectId`

**Authorization:** Required (Admin, Project Owner)

**Request:**
```json
{
  "name": "Mobile App Redesign - Phase 2",
  "status": "completed",
  "priority": "low",
  "assignedDevelopers": ["507f1f77bcf86cd799439012"]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { /* updated project */ },
  "message": "Project updated successfully"
}
```

---

### 5. Delete Project

**Endpoint:** `DELETE /api/projects/:projectId`

**Authorization:** Required (Admin only)

**Response (200):**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

**Notes:**
- Only admin can delete
- Deletes all associated documents
- Logs audit entry

---

## 📄 Document Management Endpoints

### 1. Upload Document

**Endpoint:** `POST /api/documents/project/:projectId/upload`

**Authorization:** Required (Admin, Project Lead)

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: Binary file (required)
- `classification`: (public, internal, confidential, secret)
- `accessibleBy`: Array of user IDs (optional, defaults to project team)

**Example (curl):**
```bash
curl -X POST https://api.yourdomain.com/api/documents/project/507f1f77bcf86cd799439020/upload \
  -H "Authorization: Bearer {accessToken}" \
  -F "file=@document.pdf" \
  -F "classification=confidential" \
  -F "accessibleBy=507f1f77bcf86cd799439012"
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "fileName": "document.pdf",
    "originalName": "project-requirements.pdf",
    "mimeType": "application/pdf",
    "size": 2048000,
    "checksum": "sha256hash...",
    "classification": "confidential",
    "uploadedBy": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "lead@example.com"
    },
    "createdAt": "2024-01-15T12:00:00Z",
    "accessibleBy": [
      {
        "userId": "507f1f77bcf86cd799439012",
        "role": "developer"
      }
    ]
  },
  "message": "Document uploaded successfully"
}
```

**Constraints:**
- Max file size: 5MB
- Allowed types: pdf, doc, docx, txt, xlsx, xls, pptx
- Only Admin and Project Lead can upload
- Files stored outside web root with random names

---

### 2. List Project Documents

**Endpoint:** `GET /api/documents/project/:projectId`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439030",
      "fileName": "document.pdf",
      "originalName": "project-requirements.pdf",
      "size": 2048000,
      "classification": "confidential",
      "uploadedBy": {
        "email": "lead@example.com",
        "fullName": "Project Lead"
      },
      "createdAt": "2024-01-15T12:00:00Z",
      "viewCount": 5
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

---

### 3. View Document Metadata

**Endpoint:** `GET /api/documents/:documentId`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "fileName": "document.pdf",
    "originalName": "project-requirements.pdf",
    "mimeType": "application/pdf",
    "size": 2048000,
    "classification": "confidential",
    "checksum": "sha256hash...",
    "uploadedBy": {
      "email": "lead@example.com",
      "fullName": "Project Lead Name"
    },
    "createdAt": "2024-01-15T12:00:00Z",
    "accessLog": [
      {
        "userId": "507f1f77bcf86cd799439012",
        "action": "download",
        "timestamp": "2024-01-15T14:30:00Z"
      }
    ]
  }
}
```

---

### 4. Download Document

**Endpoint:** `GET /api/documents/:documentId/download`

**Authorization:** Required (with access check)

**Response:**
- Binary file stream (attachment)
- Logs access in audit trail
- Sets Content-Disposition: attachment header

**Example:**
```bash
curl -H "Authorization: Bearer {accessToken}" \
  -o document.pdf \
  https://api.yourdomain.com/api/documents/507f1f77bcf86cd799439030/download
```

---

### 5. Delete Document

**Endpoint:** `DELETE /api/documents/:documentId`

**Authorization:** Required (Admin or Uploader)

**Response (200):**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

## ⚠️ Error Codes & Responses

### HTTP Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST creating resource |
| 400 | Bad Request | Invalid input/validation error |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Unexpected server error |
| 503 | Service Unavailable | Database/service down |

### Error Response Format

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### Common Error Codes

```
INVALID_INPUT       - Missing required field
INVALID_EMAIL       - Email format invalid
PASSWORD_WEAK       - Password doesn't meet requirements
USER_EXISTS         - Email already registered
USER_NOT_FOUND      - User ID doesn't exist
INSUFFICIENT_PERMS  - User lacks required role
PROJECT_NOT_FOUND   - Project ID doesn't exist
DOCUMENT_NOT_FOUND  - Document ID doesn't exist
FILE_TOO_LARGE      - Upload exceeds 5MB
INVALID_FILE_TYPE   - File type not allowed
ACCOUNT_LOCKED      - Account locked after failed logins
TOKEN_EXPIRED       - JWT token expired
RATE_LIMIT          - Too many requests
DB_ERROR            - Database error
INTERNAL_ERROR      - Unexpected server error
```

---

## 🚦 Rate Limiting

### Global Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| All endpoints (default) | 100 requests | 15 minutes |
| /api/auth/login | 5 requests | 15 minutes |

### Rate Limit Headers

All rate-limited responses include:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705334400
```

### Example 429 Response

```json
{
  "success": false,
  "message": "Too many requests. Please try again later.",
  "retryAfter": 300
}
```

---

## 📚 Examples & Workflows

### Complete Authentication Flow

```bash
#!/bin/bash
# 1. Login
LOGIN_RESPONSE=$(curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user@example.com",
    "password": "SecurePassword123!"
  }')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.refreshToken')

# 2. Use access token
curl -X GET https://api.yourdomain.com/api/projects \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 3. Refresh token after 15 minutes
NEW_TOKEN=$(curl -X POST https://api.yourdomain.com/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" \
  | jq -r '.data.accessToken')

# 4. Use new token
curl -X GET https://api.yourdomain.com/api/projects \
  -H "Authorization: Bearer $NEW_TOKEN"

# 5. Logout
curl -X POST https://api.yourdomain.com/api/auth/logout \
  -H "Authorization: Bearer $NEW_TOKEN"
```

### Project Creation Workflow

```bash
#!/bin/bash
# 1. Get list of users to assign
USERS=$(curl -X GET https://api.yourdomain.com/api/admin/users?role=developer \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq -r '.data[] | .\_id')

# 2. Create project with developers
curl -X POST https://api.yourdomain.com/api/projects \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Project",
    "projectLead": "507f1f77bcf86cd799439011",
    "assignedDevelopers": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
    "deadline": "2024-06-30"
  }'

# 3. Upload project documentation
curl -X POST https://api.yourdomain.com/api/documents/project/PROJECT_ID/upload \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@requirements.pdf" \
  -F "classification=internal"
```

---

## 🔗 SDK & Client Libraries

### Node.js/JavaScript

```javascript
import axios from 'axios';

class PixelForgeAPI {
  constructor(baseURL = 'https://api.yourdomain.com', token = null) {
    this.client = axios.create({ baseURL });
    this.setToken(token);
  }

  setToken(token) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }

  async login(email, password) {
    const { data } = await this.client.post('/api/auth/login', { 
      username: email, 
      password 
    });
    this.setToken(data.data.accessToken);
    return data.data;
  }

  async getProjects(page = 1, limit = 20) {
    return this.client.get('/api/projects', { params: { page, limit } });
  }

  async createProject(projectData) {
    return this.client.post('/api/projects', projectData);
  }

  async uploadDocument(projectId, file, classification = 'internal') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('classification', classification);
    return this.client.post(`/api/documents/project/${projectId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
}

// Usage
const api = new PixelForgeAPI();
await api.login('user@example.com', 'password');
const projects = await api.getProjects();
```

### Python

```python
import requests

class PixelForgeAPI:
    def __init__(self, base_url="https://api.yourdomain.com", token=None):
        self.base_url = base_url
        self.session = requests.Session()
        if token:
            self.set_token(token)
    
    def set_token(self, token):
        self.session.headers['Authorization'] = f'Bearer {token}'
    
    def login(self, email, password):
        response = self.session.post(
            f'{self.base_url}/api/auth/login',
            json={'username': email, 'password': password}
        )
        data = response.json()['data']
        self.set_token(data['accessToken'])
        return data
    
    def get_projects(self, page=1, limit=20):
        return self.session.get(
            f'{self.base_url}/api/projects',
            params={'page': page, 'limit': limit}
        ).json()
    
    def upload_document(self, project_id, file_path, classification='internal'):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'classification': classification}
            return self.session.post(
                f'{self.base_url}/api/documents/project/{project_id}/upload',
                files=files,
                data=data
            ).json()

# Usage
api = PixelForgeAPI()
api.login('user@example.com', 'password')
projects = api.get_projects()
```

---

## 📞 Support & Status

- **Status Page:** https://status.yourdomain.com
- **Documentation:** https://docs.yourdomain.com
- **Support Email:** support@yourdomain.com
- **Issues:** https://github.com/your-org/pixelforge/issues

**Last Updated:** 2024-01-15
**API Version:** 1.0.0

