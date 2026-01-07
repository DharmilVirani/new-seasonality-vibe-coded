# 🔐 Authentication & User Management Guide

Complete guide for the Seasonality SaaS authentication system including JWT authentication, role-based access control (RBAC), API key management, and user administration.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Subscription Tiers](#subscription-tiers)
5. [API Endpoints](#api-endpoints)
6. [API Key Management](#api-key-management)
7. [Security Features](#security-features)
8. [Integration Examples](#integration-examples)
9. [Error Handling](#error-handling)

## Overview

The authentication system provides:
- JWT-based authentication with refresh tokens
- API key authentication for programmatic access
- Role-based access control (RBAC)
- Subscription tier-based feature access
- Comprehensive audit logging

## Authentication Methods

### 1. JWT Authentication (Web/Mobile Apps)

```javascript
// Login to get tokens
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});

const { accessToken, refreshToken, user } = await response.json();

// Use access token for API calls
const data = await fetch('/api/analysis/daily', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

### 2. API Key Authentication (Programmatic Access)

```javascript
// Use API key in header
const response = await fetch('/api/analysis/daily', {
  headers: { 'X-API-Key': 'sk_your_api_key_here' }
});
```

## User Roles & Permissions

### Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| `admin` | 4 | Full system access, user management |
| `research` | 3 | CSV upload, data management |
| `user` | 2 | Regular user with subscription features |
| `trial` | 1 | Limited trial access |

### Permission Matrix

| Permission | Admin | Research | User | Trial |
|------------|-------|----------|------|-------|
| `analysis:daily` | ✅ | ✅ | ✅ | ✅ |
| `analysis:weekly` | ✅ | ✅ | ✅ | ✅ |
| `analysis:monthly` | ✅ | ✅ | ✅ | ✅ |
| `analysis:yearly` | ✅ | ✅ | ✅ | ✅ |
| `analysis:scenario` | ✅ | ✅ | ✅ | ✅ |
| `analysis:election` | ✅ | ✅ | ✅ | ✅ |
| `analysis:scanner` | ✅ | ✅ | ✅* | ❌ |
| `analysis:backtester` | ✅ | ✅ | ✅** | ❌ |
| `analysis:phenomena` | ✅ | ✅ | ✅* | ❌ |
| `analysis:basket` | ✅ | ✅ | ✅*** | ❌ |
| `data:upload` | ✅ | ✅ | ❌ | ❌ |
| `data:manage` | ✅ | ✅ | ❌ | ❌ |
| `users:read` | ✅ | ❌ | ❌ | ❌ |
| `users:create` | ✅ | ❌ | ❌ | ❌ |
| `users:update` | ✅ | ❌ | ❌ | ❌ |
| `users:delete` | ✅ | ❌ | ❌ | ❌ |

*Basic+ subscription, **Premium+ subscription, ***Enterprise only

## Subscription Tiers

### Tier Limits

| Feature | Trial | Basic | Premium | Enterprise |
|---------|-------|-------|---------|------------|
| API Calls/Hour | 100 | 500 | 2,000 | 10,000 |
| API Calls/Month | 1,000 | 10,000 | 50,000 | 500,000 |
| Max Symbols | 5 | 50 | 200 | Unlimited |
| Data Retention | 30 days | 90 days | 365 days | Unlimited |
| Duration | 7 days | 30 days | 30 days | 365 days |

### Feature Access by Tier

```javascript
const TIER_FEATURES = {
  trial: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election'],
  basic: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election', 'scanner', 'phenomena'],
  premium: ['daily', 'weekly', 'monthly', 'yearly', 'scenario', 'election', 'scanner', 'phenomena', 'backtester'],
  enterprise: ['*'] // All features
};
```

## API Endpoints

### Authentication Routes (`/api/auth`)

#### Register New User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

Response:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "subscriptionTier": "trial",
    "subscriptionExpiry": "2026-01-13T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "message": "Registration successful. Please verify your email."
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Get Current User Profile
```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "John Updated"
}
```

#### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}
```

#### Get User Permissions
```http
GET /api/auth/permissions
Authorization: Bearer <access_token>
```

Response:
```json
{
  "success": true,
  "role": "user",
  "subscriptionTier": "premium",
  "permissions": ["analysis:daily", "analysis:weekly", ...],
  "features": ["daily", "weekly", "monthly", "yearly", "scanner", "backtester"],
  "limits": {
    "maxSymbols": 200,
    "maxApiCalls": 2000,
    "dataRetention": 365
  }
}
```

#### Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Reset Password
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_here",
  "newPassword": "NewSecurePass123!"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### User Management Routes (`/api/users`) - Admin Only

#### List All Users
```http
GET /api/users?page=1&limit=20&role=user&subscriptionTier=premium&isActive=true&search=john
Authorization: Bearer <admin_token>
```

#### Get User Statistics
```http
GET /api/users/statistics
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "success": true,
  "statistics": {
    "totalUsers": 150,
    "activeUsers": 142,
    "inactiveUsers": 8,
    "byTier": {
      "trial": 45,
      "basic": 60,
      "premium": 35,
      "enterprise": 10
    },
    "newUsers": {
      "today": 3,
      "thisMonth": 28
    }
  }
}
```

#### Get User by ID
```http
GET /api/users/:id
Authorization: Bearer <admin_token>
```

#### Create User (Admin)
```http
POST /api/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "New User",
  "password": "SecurePass123!",
  "role": "user",
  "subscriptionTier": "basic",
  "subscriptionExpiry": "2026-02-06T00:00:00.000Z"
}
```

#### Update User
```http
PUT /api/users/:id
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "role": "research",
  "subscriptionTier": "premium",
  "isActive": true
}
```

#### Update User Role
```http
PUT /api/users/:id/role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "research"
}
```

#### Manage Subscription
```http
PUT /api/users/:id/subscription
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "tier": "premium",
  "expiryDate": "2026-06-06T00:00:00.000Z",
  "extend": false
}
```

#### Deactivate User
```http
POST /api/users/:id/deactivate
Authorization: Bearer <admin_token>
```

#### Reactivate User
```http
POST /api/users/:id/reactivate
Authorization: Bearer <admin_token>
```

#### Delete User
```http
DELETE /api/users/:id
Authorization: Bearer <admin_token>
```

## API Key Management

### User API Key Routes (`/api/users/me/api-keys`)

#### List My API Keys
```http
GET /api/users/me/api-keys
Authorization: Bearer <access_token>
```

Response:
```json
{
  "success": true,
  "apiKeys": [
    {
      "id": 1,
      "name": "Production API Key",
      "permissions": ["read:analysis", "read:scanner"],
      "rateLimit": 500,
      "usageToday": 45,
      "totalUsage": 1250,
      "lastUsed": "2026-01-06T10:30:00.000Z",
      "isActive": true,
      "expiresAt": null,
      "createdAt": "2025-12-01T00:00:00.000Z",
      "keyPreview": "sk_...a1b2"
    }
  ]
}
```

#### Generate New API Key
```http
POST /api/users/me/api-keys
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "My New API Key",
  "permissions": ["read:analysis"],
  "rateLimit": 500,
  "expiresAt": "2027-01-06T00:00:00.000Z"
}
```

Response:
```json
{
  "success": true,
  "apiKey": {
    "id": 2,
    "name": "My New API Key",
    "permissions": ["read:analysis"],
    "rateLimit": 500,
    "expiresAt": "2027-01-06T00:00:00.000Z",
    "createdAt": "2026-01-06T12:00:00.000Z",
    "key": "sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
    "message": "Store this key securely. It will not be shown again."
  }
}
```

#### Get API Key Details
```http
GET /api/users/me/api-keys/:keyId
Authorization: Bearer <access_token>
```

#### Get API Key Usage Statistics
```http
GET /api/users/me/api-keys/:keyId/usage
Authorization: Bearer <access_token>
```

Response:
```json
{
  "success": true,
  "usage": {
    "id": 1,
    "name": "Production API Key",
    "usageToday": 45,
    "totalUsage": 1250,
    "rateLimit": 500,
    "lastUsed": "2026-01-06T10:30:00.000Z",
    "createdAt": "2025-12-01T00:00:00.000Z",
    "averageUsagePerDay": 35,
    "usagePercentageToday": 9,
    "daysActive": 36
  }
}
```

#### Update API Key
```http
PUT /api/users/me/api-keys/:keyId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated Key Name",
  "permissions": ["read:analysis", "read:scanner"],
  "rateLimit": 1000
}
```

#### Regenerate API Key
```http
POST /api/users/me/api-keys/:keyId/regenerate
Authorization: Bearer <access_token>
```

#### Revoke API Key
```http
POST /api/users/me/api-keys/:keyId/revoke
Authorization: Bearer <access_token>
```

#### Delete API Key
```http
DELETE /api/users/me/api-keys/:keyId
Authorization: Bearer <access_token>
```

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

### Token Expiry
- Access Token: 15 minutes
- Refresh Token: 7 days
- Email Verification: 24 hours
- Password Reset: 1 hour

### Rate Limiting
Rate limits are enforced per user/API key based on subscription tier:
- Trial: 100 requests/hour
- Basic: 500 requests/hour
- Premium: 2,000 requests/hour
- Enterprise: 10,000 requests/hour

### Audit Logging
All security events are logged:
- User registration
- Login attempts (success/failure)
- Password changes
- Role changes
- Subscription changes
- API key operations
- User deactivation/reactivation

## Integration Examples

### React/Next.js Integration

```typescript
// lib/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      
      login: async (email, password) => {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (data.success) {
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        }
      },
      
      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null });
      },
      
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await res.json();
        if (data.success) {
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        }
      },
    }),
    { name: 'auth-storage' }
  )
);
```

### API Client with Auto-Refresh

```typescript
// lib/api.ts
class APIClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async request(endpoint: string, options: RequestInit = {}) {
    const { accessToken, refreshAccessToken } = useAuthStore.getState();
    
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    };
    
    let response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
    
    // Auto-refresh on 401
    if (response.status === 401) {
      await refreshAccessToken();
      const newToken = useAuthStore.getState().accessToken;
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
      });
    }
    
    return response.json();
  }
}

export const api = new APIClient(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
```

### Python Integration

```python
import requests

class SeasonalityAPI:
    def __init__(self, base_url, api_key=None):
        self.base_url = base_url
        self.api_key = api_key
        self.access_token = None
    
    def login(self, email, password):
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        data = response.json()
        if data.get("success"):
            self.access_token = data["accessToken"]
        return data
    
    def _get_headers(self):
        if self.api_key:
            return {"X-API-Key": self.api_key}
        elif self.access_token:
            return {"Authorization": f"Bearer {self.access_token}"}
        return {}
    
    def get_daily_analysis(self, symbol, filters=None):
        response = requests.post(
            f"{self.base_url}/api/analysis/daily",
            headers=self._get_headers(),
            json={"symbol": symbol, "filters": filters or {}}
        )
        return response.json()

# Usage with API key
api = SeasonalityAPI("http://localhost:3001", api_key="sk_your_key_here")
data = api.get_daily_analysis("NIFTY")

# Usage with JWT
api = SeasonalityAPI("http://localhost:3001")
api.login("user@example.com", "password")
data = api.get_daily_analysis("NIFTY")
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid credentials",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_ERROR` | 401 | Invalid credentials or token |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `NOT_FOUND_ERROR` | 404 | Resource not found |
| `RATE_LIMIT_ERROR` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Server error |

### Handling Errors in Frontend

```typescript
try {
  const response = await api.request('/api/analysis/daily', {
    method: 'POST',
    body: JSON.stringify({ symbol: 'NIFTY' }),
  });
  
  if (!response.success) {
    switch (response.error.code) {
      case 'AUTHENTICATION_ERROR':
        // Redirect to login
        break;
      case 'AUTHORIZATION_ERROR':
        // Show upgrade prompt
        break;
      case 'RATE_LIMIT_ERROR':
        // Show rate limit message
        break;
      default:
        // Show generic error
    }
  }
} catch (error) {
  console.error('Network error:', error);
}
```

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Password Hashing
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=100
```

## Database Schema

The auth system uses these Prisma models:

```prisma
model User {
  id                  Int       @id @default(autoincrement())
  email               String    @unique
  password            String
  name                String?
  role                String    @default("user")
  subscriptionTier    String    @default("trial")
  subscriptionExpiry  DateTime?
  isActive            Boolean   @default(true)
  apiCallsToday       Int       @default(0)
  apiCallsThisMonth   Int       @default(0)
  lastApiCall         DateTime?
  lastLogin           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  apiKeys             ApiKey[]
  userPreferences     UserPreferences?
}

model ApiKey {
  id          Int       @id @default(autoincrement())
  keyHash     String
  name        String
  userId      Int
  permissions String[]
  rateLimit   Int       @default(100)
  usageToday  Int       @default(0)
  totalUsage  Int       @default(0)
  lastUsed    DateTime?
  isActive    Boolean   @default(true)
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
  
  user        User      @relation(fields: [userId], references: [id])
}
```

---

**🔐 The authentication system is production-ready with comprehensive security features!**
