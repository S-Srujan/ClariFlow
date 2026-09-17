# AI-Powered Real-Time Requirement Analysis Chrome Extension (Manifest V3)

An intelligent Chrome Extension built for Requirements Engineering (RE) in live software meetings (specifically Zoom Web Client). It listens to live meeting transcripts, automatically detects vague, incomplete, or ambiguous stakeholder statements, generates targeted real-time clarification questions, synthesizes refined Functional Requirements (FR) and Categorized Non-Functional Requirements (NFR), and evaluates requirement quality before and after clarification.

Developed for **IT314 - Take Home Assignment 2**.

---

## 🌟 Key Features

1. **Manifest V3 Architecture**:
   - Pure Vanilla JavaScript & Tailwind CSS (via CDN).
   - Event-driven background service worker with reliable state persistence in `chrome.storage.local`.
   - Content script utilizing `MutationObserver` to monitor Zoom Web Client closed captions (`.cc-container`, `.closed-caption-window`, `.transcription-list-item`) and in-meeting chat.
   - Text batching and deduplication to avoid redundant LLM invocations.

2. **Three-Step LLM Prompt Chain**:
   - **Step 1: Ambiguity Detection & Clarification Question Generation**: Evaluates transcript chunks for non-quantified terms, vague bounds, and subjective criteria (e.g., *"not slow"*, *"ideally quick"*, *"solid projects"*, *"good enough so that HR trusts it"*, *"avoid bias"*). Formulates 1–2 sharp clarification questions with recommended answers.
   - **Step 2: Requirement Synthesis**: Incorporates stakeholder clarification responses to produce refined, production-grade **Functional Requirements (FR)** with acceptance criteria, and **Non-Functional Requirements (NFR)** categorized into:
     - ⚡ *Performance & Scalability*
     - ⚖️ *Fairness, Ethics & Bias Mitigation*
     - 🔍 *Explainability & Auditability*
     - 🔒 *Security & Privacy*
     - 📊 *Reliability & Accuracy*
   - **Step 3: Quality Evaluation & Before-vs-After Comparison**: Quantifies quality across IEEE 830 attributes (Clarity, Completeness, Measurability, Specificity) and builds a side-by-side comparison matrix between the unclarified baseline and clarified requirements.

3. **Multi-Provider LLM Integration + Smart RE Fallback**:
   - Direct REST API integration with **Google Gemini** (`gemini-1.5-flash` / `gemini-2.0-flash`) and **OpenAI** (`gpt-4o-mini` / `gpt-4o`).
   - Includes a deterministic **Smart Requirements Engineering heuristic engine** pre-trained on the assignment's Resume Analyzer dialogue so the extension can be evaluated immediately without an API key.

4. **Multi-Format Reporting**:
   - **Export to TXT**: Complete plain-text audit trail report with transcript, clarification Q&A log, FRs, categorized NFRs, and comparison table.
   - **Export to PDF**: Standalone printable report window with custom print styles and automatic print-to-PDF trigger.

5. **Assignment 2 Built-in Case Study**:
   - Features a one-click **"⚡ Case Study Demo"** button to load the full 22-line dialogue from `Take_Home_Assignment_2.pdf` (Hiring Manager vs. ML Engineer) and execute the full pipeline.

---

## 📁 Project Structure

```
IT314_Lab05/
├── manifest.json         # Manifest V3 configuration, permissions, and service worker declaration
├── content.js            # MutationObserver scraper for Zoom CC & floating in-page HUD
├── background.js         # Service worker, LLM prompt chains (Steps 1, 2, 3), and API connectors
├── popup.html            # Tailwind CSS dashboard with tabs, modals, tables, and metric cards
├── popup.js              # UI controller, state sync, clarification Q&A handler, and export logic
├── icons/
│   ├── icon-16.png       # 16x16 extension icon
│   ├── icon-48.png       # 48x48 extension icon
│   └── icon-128.png      # 128x128 extension icon
└── README.md             # Documentation and usage guide
```

---

## 🚀 Installation Instructions (Chrome)

1. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the project directory:
   ```
   /Users/ssrujan/Desktop/VS CODE/Coding/IT314_Labs/IT314_Lab05
   ```
5. The extension **"AI Requirement Analyzer for Zoom"** will appear in your extension list.
6. Click the extension puzzle icon in Chrome's toolbar and pin **ReqAI Analyzer** for easy access.

---

## 🧪 How to Test and Run the Demo

### Option A: One-Click Assignment Case Study Demo (Recommended)
1. Click the **ReqAI Analyzer** extension icon in Chrome to open the popup.
2. Click the **"⚡ Case Study Demo"** button in the top header.
3. The extension instantly loads the exact dialogue from `Take_Home_Assignment_2.pdf`:
   - View the dialogue in the **Live Analysis** tab with highlighted vague phrases.
   - Observe the detected ambiguities and clarification questions.
   - Click the **Requirements (FR & NFR)** tab to view both the unclarified baseline and the refined requirements.
   - Click the **Quality Evaluation** tab to view the metrics benchmark (+184% quality improvement) and side-by-side comparison table.
   - Click **"📄 Export TXT"** or **"📑 Export PDF Report"** to download the analysis report.

### Option B: Live Zoom Meeting Integration
1. Join a Zoom meeting in Google Chrome via the Zoom Web Client (`https://app.zoom.us/wc/...` or `https://zoom.us/wc/...`).
2. Turn on **Closed Captions** or **Live Transcript** in Zoom.
3. Notice the subtle floating HUD badge at the bottom-right of the Zoom page:
   `[🎯 ReqAI Active | Lines: N]`.
4. As meeting participants speak, captions are batched and dispatched to the extension.
5. Open the popup to see questions generated in real time and submit clarification answers.

### Option C: Configuring Custom LLM API Keys
1. In the popup header, click the **⚙️ (Settings)** icon.
2. Choose your provider:
   - **Google Gemini**: Paste your API key from Google AI Studio.
   - **OpenAI**: Paste your OpenAI secret key.
   - **Built-in Smart RE Engine**: Works offline without requiring an API key.
3. Click **Save Settings**.
