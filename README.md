# VaxCheck: Neuro-Symbolic Immunization Engine

[![Live Prototype](https://img.shields.io/badge/🚀_Launch_Live_Prototype-Vercel-blue?style=for-the-badge&logo=vercel)](https://vaxcheck-jonwu.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Physician-Builder Context:** Built by **Dr. Jonathan Wu** to solve the "LLM Math Problem" in healthcare. Large Language Models struggle with date arithmetic and rigid interval logic. VaxCheck demonstrates a **Neuro-Symbolic Architecture**: it delegates "reasoning" to the LLM and "calculation" to a deterministic TypeScript engine.

---

## 1. Product Context (The "Why")
*Target Audience: Product Managers, Public Health Directors*

### 👤 User Persona
Pediatricians, Public Health Nurses, and Clinic Administrators managing catch-up schedules.

### 🔴 The Problem
**The "LLM Math" Gap:** General purpose AI models cannot reliably calculate date intervals (e.g., *"4 weeks minus 1 day"*). In vaccination, a single day's error invalidates a dose. Manual calculation against CDC/ACIP tables is slow, error-prone, and contributes to missed opportunities for vaccination (MOV).

### 🟢 The Solution
VaxCheck is a **Hybrid Intelligence Engine**. It uses **Deterministic Logic** to calculate due dates with 100% mathematical precision, while using **Generative AI** only for the "Last Mile"—translating those complex logic outputs into empathetic, patient-friendly explanations.

### ⚡ Key Metrics & Impact
* **Zero Math Errors:** Hard-coded interval logic ensures strict adherence to minimum age/interval rules.
* **Interoperability Ready:** Built-in **FHIR R4 Adapter** allows seamless data export to enterprise EHRs.
* **Edge Performance:** Complex logic runs on **Web Workers**, ensuring 60fps UI performance even when processing population-level datasets.

---

## 2. Engineering Architecture (The "How")
*Target Audience: Forward Deployed Engineers (Palantir), Solutions Architects*

### 🏗️ Tech Stack
* **Frontend:** React 19, TypeScript, Tailwind CSS
* **Logic Core:** Custom **Web Worker** architecture (`logic.worker.ts`) for off-main-thread processing.
* **AI Layer:** Google Gemini 1.5 Flash (Vision & Text)
* **Data Standard:** HL7 FHIR R4 (Fast Healthcare Interoperability Resources)

### 🔧 Key Engineering Decisions

#### A. Neuro-Symbolic Architecture
* **The Constraint:** LLMs are probabilistic token predictors, not calculators.
* **The Architecture:**
    * **The "Brain" (TypeScript):** A rigid JSON-based rules engine handles the math (e.g., `minAge: "6 months"`, `minInterval: "4 weeks"`).
    * **The "Voice" (Gemini):** The LLM receives the *result* of the calculation and generates the *explanation* for the patient (e.g., *"Your child needs the MMR vaccine because they turned 1 year old yesterday..."*).

#### B. Client-Side Performance (Web Workers)
* **Challenge:** Evaluating 50+ rules against a full patient history can block the main thread, causing UI jank.
* **Solution:** Implemented `logic.worker.ts` to offload recursive logic processing to a background thread. This architecture mimics production-grade heavy client apps (like Figma or Excel Web).

#### C. Interoperability First (FHIR Adapter)
* **Implementation:** Built a transformation layer that maps internal application state to **FHIR Immunization resources**.
* **Why:** Proves readiness for enterprise integration with Epic, Cerner, or Palantir Foundry.

---

## 3. Current Functionality
1.  **Smart Scan (Multimodal AI):** Uses Gemini Vision to parse images of physical vaccine cards into structured JSON data.
2.  **Catch-Up Logic Engine:** Automatically identifies "Overdue" vs "Due Now" based on rigid ACIP-style logic.
3.  **Population Health Dashboard:** Aggregates compliance data (e.g., "85% MMR coverage") for clinic-level insights.
4.  **Unit Test Suite:** A visual testing interface to verify the logic engine against edge cases (e.g., leap years, premature birth).

---

## 4. Safety & Compliance
* **Privacy by Design:** Logic processing happens entirely client-side. No PHI is sent to the server for the rules engine to function.
* **Explanation Consistency:** By separating logic from generation, the AI cannot "hallucinate" a due date. It can only explain the date provided by the code.

---

## 5. Quick Start
To run this project locally:

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/drjonwu/vaxcheck.git](https://github.com/drjonwu/vaxcheck.git)
    cd vaxcheck
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    VITE_GEMINI_API_KEY=your_api_key_here
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
