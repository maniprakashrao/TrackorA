# TrackorA

TrackorA is a next-generation performance ledger and personal optimization ecosystem designed for full-stack academic, productivity, and lifestyle management. Built using a high-performance, dark-mode design system, it serves as a central hub for engineering students to verify milestones, sync checklist matrices in real time, and monitor structural analytics.

---

## 🚀 Key Features

### 📊 Overview Systems
* **Interactive Dashboard:** Core performance metrics interface providing an aggregated view of active milestones, habits, and progression state.
* **Unified Calendar:** Centralized scheduling hub mapping system objectives, study segments, and critical deadlines.
* **Analytics Engine:** Visual performance tracking metrics analyzing study data and checklist history.

### ⚡ Productivity & Optimization Tools
* **Study Tracker:** Dedicated focus management interface with session logging to calculate real-time skill acquisition and experience progression.
* **Habit Matrix Grid:** Real-time completion checklist to establish, manage, and sustain long-term routine mechanics.
* **Goal Ledger:** Objective-setting interface to outline, modify, and finalize personal key results.
* **Personal Diary:** Markdown-enhanced repository for text logs, retrospectives, and engineering workspace documentation.

### 🎓 Academic & Achievement Vault
* **Exam Hub & Strategy Planner:** Deep tracking for curriculum modules, subtopics, and preparation intervals.
* **Placement & Internship Vector:** Application management grid for tracking corporate openings, active software roles, and target milestones.
* **Project Ideas Repository:** Sandbox environment for generating architecture concepts, deployment steps, and feature planning.
* **Credentials Vault & Achievements:** Gamified tier system calculating user level metrics based on dynamic XP, paired with a secure document upload layout to catalog verified certificates.

---

## 🛠️ Architecture & Tech Stack

TrackorA is architected on top of a lightning-fast frontend bundle and a decoupled backend-as-a-service layer:

* **Frontend Environment:** React 18, Vite (Hot Module Replacement optimized), Tailwind CSS
* **Routing Engine:** React Router v6 (Flat single-router context architecture)
* **Backend Database & Authentication:** Supabase (PostgreSQL with Row-Level Security enabled)
* **Design Systems & Iconography:** Lucide React

---

## 🗄️ Database Schema Blueprint

The system relies on a structural relational model inside PostgreSQL. Core public tables include:

├── user_profiles (Public identity records, synchronized via Supabase Auth)
├── user_certificates (Document metadata paths tied securely to storage buckets)
├── study_sessions (Logged duration metrics tracking aggregate focus hours)
├── user_habits & habit_logs (Matrix checkpoints tracking daily progress states)
├── user_goals (Target milestones mapped to objective tracking layers)
└── project_ideas (Product concepts and features checklist)


### Row Level Security (RLS)
Security guidelines are strictly enforced across the PostgreSQL architecture. Users are walled within their data sandbox:
```sql
ALTER TABLE public.user_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own certificates" 
ON public.user_certificates FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
🔧 Installation & Environment Configuration
Prerequisites
Node.js (v18+ recommended)

npm / pnpm / yarn

A Supabase Project Instance

1. Clone the Repository & Install Dependencies
Bash
git clone [https://github.com/maniprakashrao/Trackora.git](https://github.com/maniprakashrao/Trackora.git)
cd trackora-web
npm install
2. Configure Environment Variables
Create a .env file in the root directory of your project:

Code snippet
VITE_SUPABASE_URL=[https://your-supabase-project.supabase.co](https://your-supabase-project.supabase.co)
VITE_SUPABASE_ANON_KEY=your-actual-supabase-anon-public-key
3. Initialize Local Development Server
Bash
npm run dev
The application will spin up instantly on http://localhost:5173/.

🎨 Asset Configuration & Theme Elements
System Theme: Ambient Cyberpunk Dark Mode (#06040a deep field background, #0b0813 structural components, with vibrant neon purple and indigo text highlights).

Favicon & Brand Graphics: Custom geometric tracking-clock typography located inside /public/favicon.png and src/assets/logo.png.

🛡️ License
Distributed under the MIT License. See LICENSE for more information.