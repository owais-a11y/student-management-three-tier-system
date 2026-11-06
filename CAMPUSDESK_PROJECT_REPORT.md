# Problem 1: CampusDesk – 3-Tier Student Information System
## Academic Mini Project Report & Deployment Manual

---

## 1. Project Overview

**CampusDesk** is a cloud-native, three-tier Student Information System engineered to deliver secure, scalable, and modular academic record management. The application strictly follows the three-tier architectural paradigm, completely isolating user presentation, business logic, and persistent storage.

```
+-----------------------------------------------------------------------+
|                         PRESENTATION TIER                             |
|                  React 18 + Vite SPA (Hosted on Netlify)              |
|        - Modern responsive dashboard with live search & filters        |
|        - Department & student management forms                        |
+-----------------------------------------------------------------------+
                                   │
                                   │ HTTPS / REST (JSON)
                                   ▼
+-----------------------------------------------------------------------+
|                         APPLICATION TIER                              |
|               Express.js REST API (Deployed on Render)                |
|        - Input validation & relational constraint verification        |
|        - Helmet security headers, CORS allowlist, Rate-limiting       |
+-----------------------------------------------------------------------+
                                   │
                                   │ TLS / Mongoose ODM (mongodb+srv)
                                   ▼
+-----------------------------------------------------------------------+
|                            DATA TIER                                  |
|                 Managed MongoDB Atlas NoSQL Cluster                   |
|        - Collections: `students`, `departments`                       |
|        - Compound text indexing & integrity safeguards                |
+-----------------------------------------------------------------------+
```

---

## 2. Three-Tier Architectural Analysis

### 2.1 Why Three-Tier Architecture?
Traditional monolithic or two-tier client-server architectures suffer from security risks (client holding database credentials), lack of horizontal scalability, and high coupling. The three-tier model solves these challenges:

1. **Presentation Tier (Frontend - Netlify)**:
   * Responsible solely for user interaction and UI rendering.
   * Has **zero direct access** to database credentials or connection strings.
   * Communicates asynchronously with the application tier via standard HTTPS JSON endpoints.

2. **Application / Logic Tier (Backend API - Render)**:
   * Encapsulates all business rules, data validation, and authorization logic.
   * Prevents database corruption by validating that students cannot be assigned to non-existent departments or invalid sections.
   * Protects backend resources using middleware (Helmet, express-rate-limit, CORS).

3. **Data Tier (Database - MongoDB Atlas)**:
   * Highly available, distributed cloud database cluster with automated backups and encryption at rest.
   * Only accepts authenticated TLS connections from trusted hosts (API tier).

---

## 3. Technology Stack Specification

| Tier / Component | Technology | Role & Justification |
| :--- | :--- | :--- |
| **Presentation** | React 18 & Vite | Fast virtual DOM rendering, reactive state management, high-performance static asset generation. |
| **Hosting (Frontend)** | Netlify | Global CDN edge caching, automatic continuous deployment from Git, instant cache invalidation. |
| **Application** | Node.js & Express.js | Non-blocking event-driven I/O ideal for RESTful JSON microservices. |
| **Hosting (Backend)** | Render Web Service | Managed container execution, native health check monitoring (`/health`), zero-downtime rollouts. |
| **Data Layer** | MongoDB Atlas | Scalable document-based database well-suited for hierarchical academic records (departments with nested section arrays). |
| **Data Modeling** | Mongoose ODM 8 | Schema enforcement, pre-validation hooks, typed models, relational population. |
| **Security Layer** | Helmet & Rate-Limit | HTTP security headers (CSP, HSTS, X-Content-Type) and DDoS / brute-force throttling. |

---

## 4. Database Schema Design

### 4.1 Department Schema (`models/Department.js`)
Stores academic departments along with valid sections.
```javascript
{
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 80
  },
  sections: {
    type: [String],
    default: []
  },
  timestamps: true
}
```

### 4.2 Student Schema (`models/Student.js`)
Maintains enrolled student data with relational reference to `Department`.
```javascript
{
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 30
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  section: {
    type: String,
    trim: true,
    default: ''
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  contact: {
    type: String,
    trim: true,
    maxlength: 20,
    default: ''
  },
  timestamps: true
}
```

### 4.3 Database Integrity Safeguards
* **Compound Search Index**: `studentSchema.index({ name: 'text', studentId: 'text', email: 'text' })` enables sub-millisecond full-text queries.
* **Cascade Delete Protection**:
  * A department **cannot be deleted** if any enrolled student references its `_id` (`Student.exists({ department: id })`).
  * A section **cannot be removed** from a department if active students are assigned to that section.

---

## 5. REST API Specifications

All endpoints return standardized JSON payloads:
* Success response: `{ "success": true, "message": "...", "data": ... }`
* Error response: `{ "success": false, "message": "Error description" }`

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health check | 200 |
| `GET` | `/api/students` | List students with optional query filters (`?q=`, `?department=`, `?section=`) | 200 |
| `GET` | `/api/students/:id` | Fetch single student by Student ID (e.g. `CS101`) or MongoDB ObjectId | 200 / 404 |
| `POST` | `/api/students` | Register new student record | 201 / 400 / 409 |
| `PUT` | `/api/students/:id` | Update existing student profile | 200 / 400 / 404 |
| `DELETE`| `/api/students/:id` | Delete student record | 200 / 404 |
| `GET` | `/api/departments` | List all departments with computed enrollment counts | 200 |
| `POST` | `/api/departments` | Create new department | 201 / 400 / 409 |
| `PUT` | `/api/departments/:id`| Update department name or allowed sections | 200 / 400 / 409 |
| `DELETE`| `/api/departments/:id`| Delete department (only permitted if 0 students enrolled) | 200 / 409 |

---

## 6. Step-by-Step Cloud Deployment Guide

### Step 1: MongoDB Atlas Configuration
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Under **Database Access**, verify your database user has read/write privileges on the `studentDB` database.
3. Under **Network Access**, ensure IP access is open (`0.0.0.0/0`) or whitelisted for Render's outgoing IPs.
4. Copy your SRV connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.0enfp44.mongodb.net/studentDB?retryWrites=true&w=majority&appName=Cluster0
   ```

### Step 2: Deploy Backend REST API on Render
1. Push your repository to GitHub.
2. Log in to [Render](https://dashboard.render.com/) and click **New +** → **Blueprint** (or **Web Service**).
   * **Root Directory**: `backend` (or use root `render.yaml`)
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm start`
   * **Health Check Path**: `/health`
3. Configure Environment Variables in Render:
   * `NODE_ENV`: `production`
   * `MONGODB_URI`: `<Your MongoDB Atlas Connection String with /studentDB>`
   * `FRONTEND_URL`: `https://your-app.netlify.app` *(update after Netlify creation)*
4. Once deployed, test your API health check:
   `https://campus-desk-api.onrender.com/health` (should return `{"success":true,"status":"ok"}`).

### Step 3: Deploy Frontend on Netlify
1. Log in to [Netlify](https://app.netlify.app/) and choose **Add new site** → **Import an existing project**.
2. Select your GitHub repository:
   * **Base directory**: `P1` (or leave empty if repository root)
   * **Build command**: `npm run build`
   * **Publish directory**: `frontend/dist`
3. Add Environment Variable:
   * `VITE_API_URL`: `https://campus-desk-api.onrender.com` *(Render API base URL without trailing slash)*
4. Deploy site and copy the public Netlify URL (e.g. `https://campusdesk-app.netlify.app`).
5. **Final Step**: Paste your Netlify URL back into Render's `FRONTEND_URL` environment variable so CORS allows requests.

---

## 7. Testing & Verification Scenarios

| Test Case | Operation | Input / Action | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Health Check | `GET /health` | Returns `{ success: true, status: "ok" }` | **PASS** |
| **TC-02** | Initial Seed | Start server on fresh DB | Auto-creates "Computer Science and Engineering" with sections A, B | **PASS** |
| **TC-03** | Add Student | `POST /api/students` with ID `CS201`, Semester `4`, Dept `CSE`, Section `A` | 201 Created; student appears in table | **PASS** |
| **TC-04** | Duplicate Check | Add student with same email or ID | 409 Conflict with descriptive error message | **PASS** |
| **TC-05** | Invalid Section | Add student with Section `Z` in CSE | 400 Bad Request ("Choose a section that belongs to the selected department") | **PASS** |
| **TC-06** | Search & Filter | Enter student ID or name in search box | Instant table update matching criteria | **PASS** |
| **TC-07** | Integrity Protection | Delete CSE department with enrolled students | 409 Conflict ("Move or remove this department's students before deleting") | **PASS** |
| **TC-08** | Delete Student | Delete `CS201` | Record removed; overview counter decrements by 1 | **PASS** |

---

## 8. Viva Voce Preparation Guide (Questions & Answers)

**Q1: What are the primary advantages of a 3-tier architecture over a 2-tier architecture?**
> *Answer:* In a 2-tier architecture, the client communicates directly with the database, exposing database credentials, business logic, and security vulnerabilities to the client device. A 3-tier architecture introduces an intermediate application logic tier, which isolates credentials, enforces business rules, handles rate limiting, and allows independent scaling and maintenance of each tier.

**Q2: How does the application prevent CORS (Cross-Origin Resource Sharing) vulnerabilities?**
> *Answer:* The Express API uses the `cors` middleware with an explicit allowlist parsed from `process.env.FRONTEND_URL`. Only HTTP requests originating from the trusted Netlify frontend domain are accepted; all other cross-origin browser requests are rejected with a 403 Forbidden status.

**Q3: Why was MongoDB Atlas chosen for this project instead of a relational database like MySQL?**
> *Answer:* Academic departments frequently require flexible metadata (such as dynamic lists of sections). MongoDB's document model natively supports embedded arrays (`sections: ['A', 'B']`) and schema indexing while providing cloud-managed horizontal scalability, automated failover, and zero-maintenance operations via Atlas.

**Q4: How is data consistency enforced between students and departments?**
> *Answer:* Even though MongoDB is NoSQL, consistency is enforced at the Application Tier via Mongoose schema validators and custom controller logic. Before a student is created or updated, the controller verifies that the referenced department exists and that the selected section is currently an active member of that department's section array. Furthermore, cascade checks prevent deleting departments or sections while students are enrolled.
