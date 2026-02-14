📘 Student Verification Portal

Coursera Certificate & LinkedIn Submission Validator

🎯 Overview

The Student Verification Portal is a full-stack web application designed to automatically verify guided project submissions using:

Coursera Completion Certificate Links

LinkedIn Post Links

The platform validates:

✔ Student identity consistency
✔ Certificate authenticity
✔ Course/project match
✔ Submission correctness

This version is student-facing, includes role-based access, and supports a dynamic leaderboard & admin controls.

🚀 Key Features
👨‍🎓 Student Features

Email-based signup & login

Restricted to @thapar.edu domain

College field entered manually

Submit Coursera & LinkedIn links

View My Submissions with course name headings

Automatic verification status:

Correct

Wrong

Skipped (Timeout)

Failed

Delete personal submissions

Real-time progress updates

🛡 Admin Features

Admin / Student login selection

Admin approval workflow

Admin dashboard

Add / Remove submissions

Export submission report (Excel)

Exported Excel includes:

Field	Description
Student Name	Verified student
Roll Number	Unique identifier
Number of Submissions	Count per student
Marks	floor(submissions / 3)
🔐 Authentication & Access Control
✅ Student Login Rules

Only @thapar.edu emails allowed

Other domains rejected

✅ Admin Login Rules

User selects Admin Login

Admin request sent for approval

Access granted only after approval

🧠 Verification Logic

The system uses a rule-based intelligent verification engine.

No ML training model is used.

1️⃣ Coursera Certificate Validation

Fetch certificate page

Extract student name ONLY from:

Completed by <Student Name>


No fallback extraction

Missing pattern → Fail

2️⃣ LinkedIn Post Validation

No deep LinkedIn scraping

Extract username from URL

Normalize identity

3️⃣ Identity Matching

Compare:

Logged-in student name

Coursera certificate name

LinkedIn username

Using:

✔ Case-insensitive normalization
✔ Fuzzy string matching

4️⃣ Course / Project Matching

Compare:

Coursera course title

LinkedIn caption / hashtags

5️⃣ Decision Logic
Condition	Result
Student Match = Yes AND Course Match = Yes	✅ Correct
Else	❌ Wrong
⚙️ Processing & Stability Mechanisms

Each submission:

✔ Processed independently
✔ Hard timeout (12s)
✔ Failure-safe termination

Possible terminal states:

Correct

Wrong

Skipped (Timeout)

Failed (Error)

❌ No infinite "Processing"

📊 Leaderboard System

Dynamic leaderboard filtered by college.

Ranking based on:

Highest Score

Submission activity

Scoring:

Correct Submission → +10 points

Wrong / Failed → 0 points

🛠 Tech Stack
🌐 Frontend

React + TypeScript

Vite

TailwindCSS

shadcn/ui

⚡ Backend

FastAPI (Python)

Handles:

✔ Verification
✔ Scraping
✔ Matching
✔ Aggregation

🗄 Database

PostgreSQL (Supabase)

Stores:

Users

Roles

Submissions

Leaderboard

🔍 Matching Engine

rapidfuzz (fuzzy matching)

🌍 Scraping Tools

HTTP Requests + Parsing

Playwright (Coursera fallback)

📧 Email Service

Resend API

📥 Submission Flow

Student logs in

Pastes Coursera + LinkedIn links

Submission created

Verification triggered

Status updated

📈 Marks Calculation Logic

Marks are computed as:

Marks = floor(Number_of_Submissions / 3)

📦 Admin Export Report

Generated Excel contains:

✔ Student Name
✔ Roll Number
✔ Submission Count
✔ Marks

🛡 Reliability Guarantees

✔ Hard timeouts
✔ No stuck jobs
✔ Failure isolation
✔ Idempotent updates

⚠️ Known Limitations

LinkedIn content visibility restrictions

Dynamic Coursera pages may require browser fallback

External rate limiting

🎯 Use Case

Designed for:

🏫 Academic institutions
📊 Guided project validation
✅ Submission authenticity checks
🏆 Performance tracking

👨‍💻 Project Type

Academic / Educational Automation System
