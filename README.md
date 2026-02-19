# 📘 Student Verification Portal
### Coursera Certificate & LinkedIn Submission Validator

---

## 🎯 Overview

The **Student Verification Portal** is a full-stack web application designed to **automatically verify student guided project submissions** using:

- Coursera Completion Certificate Links
- LinkedIn Post Links

The platform validates:

✔ Student identity consistency
✔ Certificate authenticity
✔ Course/project match
✔ Submission correctness

This version is **student-facing**, includes **role-based access control**, a **dynamic leaderboard**, and a **dedicated admin panel**.

---

## 🚀 Key Features

### 👨‍🎓 Student Features
- Email-based signup & login
- Access restricted to **@thapar.edu** domain
- College entered manually
- Submit Coursera & LinkedIn links directly
- View **My Submissions** grouped by course name
- Automatic verification status:
  - ✅ Correct
  - ❌ Wrong
  - ⏳ Processing
  - ⚠ Skipped (Timeout)
  - 🚫 Failed (Error)
- Delete personal submissions
- Real-time status updates

---

### 🛡 Admin Features
- Admin / Student login selection
- Admin approval workflow
- Admin dashboard access (after approval)
- View all submissions
- Add / Remove submissions
- Export submission report (Excel)

---

## 🔐 Authentication & Access Control

### ✅ Student Login Rules
- Only emails ending with **@thapar.edu** are allowed
- Other domains are rejected

---

### ✅ Admin Login Rules
- User selects **Login as Admin**
- Admin access request submitted
- Approval required before admin privileges granted

---

## 🧠 Verification Logic

The system uses a **serverless verification engine** deployed on Supabase Edge Functions.

---

### 1️⃣ Coursera Certificate Validation

- Certificate page fetched via HTTP request (Edge Function)
- Student name extracted using multiple strategies:
  - "Completed by <Student Name>" text pattern
  - Open Graph (og:description) meta tags
  - JSON-LD structured data
  - HTML data attributes
- No fallback extraction
- Missing pattern → Verification fails

---

### 2️⃣ LinkedIn Post Validation

- LinkedIn page content is parsed from URL structure
- Username extracted from LinkedIn URL path
- Identity normalized

---

### 3️⃣ Identity Matching

Compares:
- Logged-in student name
- Coursera certificate name
- LinkedIn username

Using:
- ✔ Case-insensitive normalization
- ✔ Levenshtein distance algorithm (Custom TypeScript implementation)
- ✔ Token sort ratio for fuzzier matching

---

### 4️⃣ Course / Project Matching

Compares:
- Coursera course title
- LinkedIn caption / hashtags (if available/extractable)

---

### 5️⃣ Decision Logic

| Condition | Result |
|----------|--------|
| Student Match = Yes AND Course Match = Yes | ✅ Correct |
| Else | ❌ Wrong |

---

## ⚙️ Processing & Stability Mechanisms

Each submission:

✔ Processed asynchronously via Edge Functions
✔ Hard timeout protection
✔ Failure-safe termination

Possible terminal states:
- Correct
- Wrong
- Skipped (Timeout)
- Failed (Error)

❌ No infinite "Processing"

---

## 📊 Leaderboard System

Dynamic leaderboard filtered by college.

Ranking based on:
1. Highest Score
2. Submission activity

Scoring:
- Correct Submission → +10 points
- Wrong / Failed → 0 points

---

## 📈 Marks Calculation Logic

Marks computed as:
`Marks = floor(Number_of_Submissions / 3)`

---

## 📦 Admin Export Report

Generated Excel includes:

| Field | Description |
|------|-------------|
| Student Name | Verified student |
| Roll Number | Unique identifier |
| Number of Submissions | Count per student |
| Marks | floor(submissions / 3) |

---

## 🛠 Tech Stack

### 🌐 Frontend
- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **UI Architecture**: shadcn/ui

---

### ⚡ Backend (Serverless)
- **Runtime**: Supabase Edge Functions (Deno / TypeScript)
- **API**: RESTful endpoints

Handles:
✔ Verification logic
✔ HTML Scraping (Fetch API)
✔ Fuzzy Matching (Levenshtein)
✔ Data Aggregation

---

### 🗄 Database
- **PostgreSQL** (Managed by Supabase)

Stores:
- Users
- Roles
- Submissions
- Leaderboard Data

---

### 🔍 Matching Engine
- Custom Levenshtein Distance & Token Sort Ratio (TypeScript)

---

### 🌍 Scraping Tools
- Native Fetch API + Regex patterns

---

### 📧 Email Service
- Resend API (integrated via Supabase)

---

## 📥 Submission Flow

1. Student logs in
2. Pastes Coursera + LinkedIn links
3. Submission created via API
4. Edge Function triggers verification
5. Status updated in Realtime

---

## 🛡 Reliability Guarantees

✔ Hard timeouts (Edge Function limits)
✔ Stateless execution
✔ Atomic DB updates

---

## ⚠️ Known Limitations

- LinkedIn content visibility restrictions (relies heavily on URL structure)
- Dynamic Coursera pages may change DOM structure
- External platform rate limiting

---

## 🎯 Use Case

Designed for:
🏫 Academic Institutions
✅ Guided Project Verification
📊 Automated Submission Validation
🏆 Student Performance Tracking

---

## 👨‍💻 Project Type

Academic / Educational Automation System
