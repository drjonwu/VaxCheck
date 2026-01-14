# VaxCheck: Neuro-Symbolic Immunization Engine

**Live Prototype:** https://vaxcheck-jonwu.vercel.app/

### Physician-Builder Context
Built by **Dr. Jonathan Wu** to solve the "LLM Math Problem" in healthcare. Large Language Models struggle with date arithmetic and rigid interval logic. VaxCheck demonstrates a **Neuro-Symbolic Architecture**: it delegates "reasoning" to the LLM and "calculation" to a deterministic TypeScript engine.

### VaxCheck Purpose and Use Case
VaxCheck is a Clinical Decision Support (CDS) application designed for healthcare providers, nurses, and public health officials to automate the complex evaluation of patient immunization records against CDC/ACIP guidelines. Its primary use case is to instantly determine a patient's vaccination status (e.g., Up-to-Date, Overdue, Due Now) for various vaccine series (like MMR, HepB, DTaP) without requiring manual calculation of intervals and ages. By handling the rigid, arithmetic-heavy logic of vaccination scheduling, it aims to reduce clinical errors, optimize catch-up schedules for patients who have fallen behind, and provide population-level insights for clinic administrators.

### Current Functionality
The application features a comprehensive patient dashboard that visualizes vaccination history and future forecasts on an interactive timeline. 
Users can view a detailed "flowsheet" that breaks down the status of every vaccine series, complete with specific reasons for that status (e.g., "Minimum interval not met"). 
Key features include a "Smart Scan" tool that uses AI to parse images of physical vaccine cards, a printable catch-up calendar for patients, and a "Population Health Dashboard" that aggregates data to show compliance trends across the patient base. 
It also includes a "System Settings" area where the underlying logic rules (JSON format) can be viewed, edited, or synced from a remote server, and a built-in "Unit Test" suite to verify the clinical logic engine against edge cases.

### Architecture
* **Frontend:** React, TypeScript, Tailwind CSS.
* **Logic Core:** Custom **Web Worker** architecture (`logic.worker.ts`) to process complex rule sets off the main thread.
* **Interoperability:** Built-in **FHIR R4 Adapter** (`fhirAdapter.ts`) to demonstrate enterprise-grade data standardization.
* **AI Layer:** Google Gemini (via `geminiService.ts`) handles the "Last Mile" explanation to the patient, translating raw logic outputs into empathetic, human-readable text.

### Safety & Compliance
* **No Hallucinations:** Vaccine due dates are calculated by **hard-coded logic**, not probabilistic token prediction.
* **Privacy-First:** Logic processing happens client-side via Web Workers; no PHI is required to leave the browser for the rules engine to function.
* **Standardized:** Adheres to CDC/ACIP-style interval logic (Minimum ages, catch-up schedules).

### Quick Start
1. Clone repo
2. `npm install`
3. Create `.env` with `GEMINI_API_KEY`
4. `npm run dev`
