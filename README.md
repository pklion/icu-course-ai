# ICU Course Scheduling Helper with AI Advisor 🎓✨

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
[![JavaScript](https://img.shields.io/badge/ES_Modules-Vanilla_JS-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Gemini](https://img.shields.io/badge/Google_Gemini-3.5_Flash--Lite-4285F4?logo=google)](https://ai.google.dev/)
[![Ollama](https://img.shields.io/badge/Local_LLM-Ollama_%7C_llama.cpp-black?logo=ollama)](https://ollama.ai/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An intelligent, local-first academic course planning assistant and timetable builder specifically designed for **International Christian University (ICU)** students. It combines an interactive 3-term visual timetable grid with an AI advising agent powered by Retrieval-Augmented Generation (RAG), working seamlessly across both cloud APIs and local offline LLMs.

[Releases (Windows Executable)](https://github.com/pklion/icu-course-ai/releases/latest)

---

## 📌 Why Is This Useful?

Course planning under ICU’s liberal arts curriculum is notoriously complex:
- **Information Overload**: ICU’s syllabus catalog (e-Handbook) contains thousands of pages across dozens of majors, making manual searches tedious and time-consuming.
- **Strict Registration Rules**: ICU enforces a strict term credit cap (**17.0 academic credits + 0.33 HPE credits = 17.33 total credits max per term**) across three terms (Spring, Autumn, Winter), alongside unique period slots including super periods (`*4`, `*5`, `*7`).
- **Hidden Gem Discovery**: Students often miss out on interdisciplinary or introductory courses in unfamiliar majors simply because they do not have time to browse through every department's listings.

### Core Benefits
1. **Dramatically Reduces Syllabus Reading Time**: Instead of opening dozens of syllabus links, the AI advisor analyzes course objectives, prerequisites, assessment methods, and course descriptions to provide instant, concise summaries tailored to your queries.
2. **Personalized Course Discovery**: Express your goals in plain English or Japanese (e.g., *"Introductory programming courses that don't collide with my Thursday schedule"*), and the assistant finds the most relevant courses matching your interests.
3. **Automated Conflict & Cap Checking**: The system actively tracks your registered courses, flags period collisions in real time, and ensures your total credits stay within university regulations.

---

## 🚀 Key Features

- **Collaborative AI Agent & Calendar**:
  - The AI assistant is schedule-aware: it inspects your enrolled timetable before making suggestions.
  - Recommended courses render as interactive cards with **1-click "+ Add"** directly into your calendar.
- **Working RAG System with Client-Side Vector Caching**:
  - Retrieves authentic course descriptions, goals, and grading policies from `syllabi.json`.
  - Embeddings are computed and cached locally in **IndexedDB** (`icu_semantic_embeddings_v2`), ensuring fast subsequent searches with zero server database overhead.
- **Dual Engine (Cloud API & Local Models)**:
  - **Cloud**: Google Gemini API (`gemini-3.5-flash-lite`, `gemini-3.8-flash`) via secure HTTPS.
  - **Local**: Works completely offline with **llama.cpp** (port 9931) or **Ollama** (port 11434) using models like Gemma 3 or Qwen.
  - **Deterministic Offline Advisor**: If no LLM server is connected, a built-in rule-based advisor automatically inspects conflicts and performs keyword/period searches.
- **ICU-Specific Timetable Grid**:
  - Full support for ICU's 3 terms: **Spring (春)**, **Autumn (秋)**, and **Winter (冬)**.
  - Dedicated alignment for Periods 1 through 7, lunch breaks, and super periods (`*4`, `*5`, `*7`).
- **One-Click Calendar Sync (.ics Export)**:
  - Exports your scheduled courses directly into an industry-standard `.ics` file ready to import into Apple Calendar, Google Calendar, or Microsoft Outlook.
- **Bilingual & Responsive Design**:
  - Fully bilingual interface (English / 日本語) and prompts.
  - 3-pane desktop layout with responsive mobile navigation support (Catalog, Timetable, Syllabus/AI tabs).

---

## 🛠️ Why the Chosen Technologies are Necessary

| Technology | Role | Why It Is Necessary |
| :--- | :--- | :--- |
| **Vanilla JS (ES Modules) & Modern CSS** | Frontend Application | Eliminates framework churn, build complexity, and bundle bloat (no heavy React/Vue runtime). Guarantees ultra-fast initial page loads, smooth 60fps timetable interactions, and low memory consumption. |
| **Tauri v2 (Rust)** | Desktop Distribution | Generates a native lightweight desktop app (< 15MB binary vs. Electron's 150MB+), offering minimal RAM usage, strong OS integration, and high security. |
| **IndexedDB Vector Cache** | Local RAG Storage | Stores high-dimensional vector embeddings on the student's browser/machine. Avoids costly remote vector databases and ensures that syllabus queries run near-instantaneously without re-embedding catalog texts on every reload. |
| **RAG (Retrieval-Augmented Generation)** | Grounded AI Recommendations | LLMs alone hallucinate course schedules, titles, and credit counts. RAG anchors every recommendation to verified ICU catalog data (`data.json` & `syllabi.json`), citing real course codes and syllabi details. |
| **Google Gemini API + Local LLM Support (Ollama / llama.cpp)** | Flexible AI Inference | Gives students complete choice: **Cloud API** provides instantaneous setup with state-of-the-art reasoning, while **Local LLMs** guarantee 100% data privacy and offline capability with zero subscription fees. |
| **iCalendar (.ics Exporter)** | Calendar Interoperability | Adheres to RFC 5545, allowing students to seamlessly sync timetables to their everyday mobile devices and calendar apps without requiring invasive third-party account authorizations. |

---

## 🏆 Comparison with Similar Solutions

| Feature | Standard University Portals | Generic AI Chatbots (ChatGPT, Claude) | **ICU Course Scheduling Helper** |
| :--- | :---: | :---: | :---: |
| **Schedule Conflict Detection** | Basic / Manual | ❌ Blind to your actual schedule | ✅ **Real-time timetable collision detection** |
| **Syllabus Grounding (RAG)** | ❌ Plain text / PDF search only | ❌ Hallucinates unverified courses | ✅ **Grounded on ICU 2026 syllabus dataset** |
| **Calendar-Agent Interaction** | ❌ None | ❌ Manual copy-paste required | ✅ **1-Click "+ Add to Timetable" from chat** |
| **ICU Degree Rules Awareness** | Partial (portal level) | ❌ None | ✅ **Built-in 17.33 cr cap & super period logic** |
| **Setup & Privacy** | Centralized university servers | Cloud login & privacy trade-offs | ✅ **Easy individual install, runs 100% locally** |
| **Offline Capability** | ❌ Requires internet | ❌ Requires internet | ✅ **Runs fully offline with local LLM / built-in advisor** |

### Why This Application is Superior:
1. **Effortless Individual Setup**: No institutional server deployment or administrative approval needed. An individual student can run it as a standalone desktop application or host it on a static hosting provider (e.g., Cloudflare Pages, GitHub Pages) in minutes.
2. **Deep Collaboration Between Calendar & AI**: Rather than treating the timetable and the AI assistant as separate tools, the assistant actively observes current timetable states to avoid proposing overlapping courses, while the user can modify their schedule directly through AI suggestion cards.

---

## 💻 Getting Started

### Prerequisites
- Node.js (v18+)
- For Desktop Build (optional): Rust & Cargo (`rustup`)
- For Local AI (optional): [Ollama](https://ollama.ai/) or [llama.cpp](https://github.com/ggerganov/llama.cpp)

### 1. Web Version (Quick Start)
To run the web version locally:
```bash
# Clone the repository
git clone https://github.com/your-username/icu-course-scheduler.git
cd icu-course-scheduler

# Start a local static file server (using any static server, e.g. npx serve or python)
npx serve .
# Or with Python:
python3 -m http.server 8080
```
Open your browser at `http://localhost:8080`.

### 2. Desktop Application (Tauri v2)
To run the native desktop application:
```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build standalone desktop installer / binary
npm run tauri:build
```

---

## ⚙️ Configuring the AI Advisor

Click the **Gear icon (⚙️)** in the top right corner of the AI Advisor pane to select your inference backend:

### ✦ Google Gemini API (Recommended for Cloud)
1. Select **Gemini** in the settings panel.
2. Enter your [Google AI Studio API Key](https://aistudio.google.com/).
3. Default models:
   - **Chat Model**: `gemini-3.5-flash-lite` (Fast, highly accurate, low cost)
   - **Embedding**: `gemini-embedding-001`
4. Works directly over HTTPS from static hosts like Cloudflare Pages.

### 🦙 Local llama.cpp / Ollama (Recommended for Privacy & Offline)
1. **Ollama**:
   - Start Ollama with CORS enabled if accessing via browser:
     ```bash
     OLLAMA_ORIGINS="*" ollama serve
     ```
   - Pull desired models:
     ```bash
     ollama pull qwen3.5
     ollama pull nomic-embed-text
     ```
2. **llama.cpp**:
   - Run `llama-server` on port `9931` with the `--embeddings` flag enabled.
3. Select **Ollama** or **llama.cpp** in the settings drawer and click **Save & Connect**.

---

## 📂 Project Structure

```text
├── index.html              # Main single-page application structure
├── css/                    # Modular stylesheet tokens, layout, calendar & components
├── js/
│   ├── app.js              # Application bootstrapper and coordination
│   ├── store.js            # Reactive centralized state management
│   ├── calendar.js         # Timetable grid renderer & conflict visualizer
│   ├── course-list.js      # Search, filter, and catalog drawer controller
│   ├── details.js          # Syllabus details display controller
│   ├── ai-assistant.js     # AI advisor chat UI controller
│   ├── ai-engine.js        # Multi-layer hybrid search, ranking & LLM stream client
│   ├── ai-prompts.js       # System prompt generation with strict grounding constraints
│   ├── semantic-search.js  # Vector embedding generation & IndexedDB caching
│   ├── conflict.js         # ICU period & credit limit validation logic
│   └── ics-exporter.js     # RFC 5545 iCalendar (.ics) timetable export
├── data.json               # ICU course schedule database (Japanese)
├── data_en.json            # ICU course schedule database (English)
├── syllabi.json            # Parsed syllabus details (descriptions, policies, objectives)
├── src-tauri/              # Tauri v2 native desktop configuration and Rust harness
└── scripts/
    └── build.js            # Asset bundler for distribution
```
