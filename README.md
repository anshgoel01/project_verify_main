# 📘 Student Verification Portal
### Coursera Certificate & LinkedIn Submission Validator

---

## 🎯 Overview

The **Student Verification Portal** is a full-stack web application that **automatically verifies guided project submissions** using:

- Coursera Completion Certificate Links
- LinkedIn Post Links

The system validates:

✔ Student identity consistency
✔ Certificate authenticity
✔ Course/project match
✔ Submission correctness

This version is **student-facing**, with **role-based access**, a **dynamic leaderboard**, and an **admin panel**.

---

## 🚀 Features


### 👨‍🎓 Student
- Signup/Login (restricted to **@thapar.edu**)  
- Manual college entry  
- Submit Coursera & LinkedIn links  
- View submissions grouped by course  
- Verification statuses:
  - ✅ Correct
  - ❌ Wrong
  - ⏳ Processing
  - ⚠ Skipped (Timeout)
  - 🚫 Failed (Error)
- Delete own submissions  
- Real-time updates  

---

### 🛡 Admin
- Admin/Student login selection  
- Approval-based admin access  
- View/manage submissions  
- Export reports (Excel)  

---

## 🔐 Access Control

- Only **@thapar.edu** emails allowed  
- Admin role requires approval  

---

## 🧠 Verification Logic

Rule-based intelligent engine (no ML training):

**Coursera Validation**  
- Fetch certificate page  
- Extract student name from:  
  `Completed by <Student Name>`

**LinkedIn Validation**  
- Extract username from URL  
- Normalize identity  

**Matching Engine**  
- Case-insensitive normalization  
- Fuzzy matching via **rapidfuzz**

**Decision Rule**

| Condition | Result |
|----------|--------|
| Student Match AND Course Match | ✅ Correct |
| Else | ❌ Wrong |

---

## ⚙️ Stability Mechanisms

✔ Hard timeout (12s per submission)  
✔ Promise isolation  
✔ No infinite processing states  
✔ Guaranteed terminal outcomes  

---

## 📊 Leaderboard & Marks

**Scoring**
- Correct → +10 points  
- Wrong/Failed → 0  

**Marks Formula**
Marks = floor(Number_of_Submissions / 3)

---

## 📦 Admin Export

Excel Report Includes:

- Student Name  
- Roll Number  
- Number of Submissions  
- Marks  

---

## 🛠 Tech Stack

**Frontend**
- React + TypeScript  
- Vite  
- TailwindCSS  
- shadcn/ui  

**Backend**
- FastAPI (Python)

**Database**
- PostgreSQL (Supabase)

**Matching**
- rapidfuzz  

**Scraping**
- HTTP Requests / Playwright fallback   

---

## 🛡 Reliability Guarantees

✔ Hard timeouts  
✔ Failure isolation  
✔ Atomic DB updates  
✔ Guaranteed completion  


---

## License  
This project is licensed under the MIT License.
