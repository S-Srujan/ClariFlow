# Clariflow

**Turn conversations into clear requirements.**

## About

A complete Chrome Manifest V3 extension for turning meeting transcripts into clarification questions, traceable functional/non-functional requirements, and a before/after review. Built against the supplied **AI-Powered Chrome Extension for Real-Time Requirement Analysis** assignment.

## Start here

1. Extract the distribution ZIP if necessary.
2. In Chrome, open `chrome://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select this **clariflow-extension** folder (the one containing `manifest.json`).
4. Pin Clariflow from Chrome's extension menu. Click the icon to open the side panel.
5. Click **Explore assignment case study**. No account or API key is needed for the offline demonstration.
6. Open **Clarifications**, enter an answer, and inspect **Requirements** and **Quality review**.
7. Use **Reports & exports** to produce PDF, genuine DOCX, TXT, or JSON.

There is no build step, package installation, database or server required to run the extension. Node 20+ is needed only to run the developer tests. Use a current Chrome release supporting the side panel API (minimum declared version 116).

## What is included

- Opt-in Zoom web caption/transcript monitoring with batching, streaming-caption settling, retry and duplicate suppression.
- Manual entry and TXT/WebVTT transcript import.
- Persistent, separate meeting sessions; switching a session pauses capture.
- OpenAI Responses API and Google Gemini structured-output integrations.
- Explicit offline rules mode; API failures never silently become offline results.
- Pending, answered and dismissed questions, editable answers, recorder identity and answer revision history.
- FRs, categorized NFRs, and separate delivery/scope constraints.
- Unclarified baseline generated without access to clarification answers.
- Refined drafts referencing both transcript IDs and answer IDs.
- Open issues preserved instead of fabricated stakeholder approvals.
- Identical, explainable text-based evaluation applied to both versions.
- PDF print report, editable Word DOCX, TXT report and JSON session archive.
- The full 23-utterance assignment conversation and separately labelled simulated example answers.
- Automated tests, an acceptance checklist, architecture explanation and presentation guide.

## Enable actual AI analysis

Open **Settings**:

1. Select **OpenAI** or **Google Gemini**.
2. Enter a model ID available in your provider account that supports structured JSON output. Model access changes; use the provider's current model catalog.
3. Enter your own API key. Do not put keys in source code, screenshots or shared reports.
4. Enable sending meeting text to the selected provider, then save.
5. Click **Analyze meeting**.

Only transcript text, explicitly answered clarifications and the relevant requirement context are sent. Keys are held in `chrome.storage.session`, which clears when Chrome exits; transcripts and settings persist in `chrome.storage.local`. These stores are restricted to trusted extension contexts. Keys are not included in reports or local session records. There is no application server collecting meeting data. Provider-side processing follows that provider's policies; OpenAI requests set `store: false`.

Missing keys, timeouts, quota failures, refusals and malformed responses appear as errors. Existing results stay visible and are marked outdated when appropriate. To use offline rules after an API error, explicitly select **Offline rules** in Settings and rerun analysis.

## Live Zoom workflow

1. Start a new named meeting session in Clariflow.
2. Join the meeting using the **Zoom web client** at a `zoom.us` host in Chrome.
3. Enable visible captions or open the transcript panel in Zoom.
4. With the Zoom tab selected, open Clariflow's side panel and click **Start Zoom capture**.
5. The Zoom page badge should show **Capturing captions**. The workbench should show a recent received-batch time and new statements.
6. Read each clarification question aloud yourself, then record the actual stakeholder response in Clariflow.
7. Pause capture when finished. Wait for the latest analysis, inspect open issues, and export.

**This extension reads text already rendered by Zoom. It does not record microphone audio, perform speech recognition, speak questions, or automatically identify an answer in later speech.** It does not work inside the native Zoom desktop client. If you installed/reloaded the extension while Zoom was already open, reload that Zoom tab before testing. Caption DOM selectors vary between Zoom versions; TXT/VTT import remains available if a particular layout is unsupported.

## A truthful demonstration

The case-study button creates a separate session with all 23 assignment utterances and initially unanswered questions. For a quick recorded example, choose **Apply simulated sample answers** in Clarifications. This action is explicit, is available only in a case-study session, and labels every affected answer and report as simulated. Those answers were authored as examples; they do not appear in the supplied assignment.

The shipped offline worked example has 12 draft requirements and seven question topics. Its rubric result is 25 before and 85 after applying the supplied simulated answers. These are computed text-rubric scores, **not an empirical claim that the system improves requirement quality by that amount**. Actual AI output and real stakeholder responses will differ.

## Evaluation

Every requirement receives up to four points:

| Check | Passing condition |
| --- | --- |
| Clarity | No detected vague terms, placeholders or recorded open issues. |
| Completeness | A statement and acceptance criteria exist, with no recorded open issues. |
| Verifiability | Acceptance criteria contain an observable action for an FR, or a number for an NFR/constraint. |
| Traceability | Source transcript references exist; answer references point to answered questions. |

Each dimension is the percentage passing. Overall is the rounded mean of per-requirement scores. Change is **percentage points**, not relative percentage improvement. Empty sessions have no score. With no answers, the refined version is an exact copy of the baseline, yielding zero change.

The English-language rubric is intentionally transparent but limited: it cannot establish truth, feasibility, fairness, completeness against undiscovered needs, or legal/standards compliance. Human review is required. Numbers, action verbs and valid reference IDs do not by themselves prove semantic quality. See [architecture and evaluation](docs/ARCHITECTURE.md).

## Validation status

- Automated checks: run `npm test` — 20 tests passed at packaging.
- Real browser preview: case-study load, question entry, evaluation update and responsive 400px layout checked using the actual application modules with a browser-API adapter.
- Caption DOM fixture: partial-caption aggregation, two distinct statements, and recovery after a simulated send failure checked in a browser.
- DOCX: ZIP checksums, XML parts and loading with a Word-document parser verified.
- Printable HTML report inspected in the browser.
- **Not verified here:** installing the unpacked extension in the user's Chrome profile, a live Zoom meeting, paid-provider authentication/model access, and platform-specific print/Word rendering. A separate isolated Chrome launch was blocked by the host environment. Follow [acceptance checks](docs/ACCEPTANCE.md) before presenting it as live-tested.

## Project map

```text
manifest.json          Chrome permissions and entry points
index.html             Workbench and side-panel UI
styles.css             Responsive local stylesheet
report.html / .css     Printable report page
src/
  core.js              Domain state, offline rules, validation, evaluation
  background.js        Serialized persistence and durable analysis jobs
  providers.js         AI prompts, JSON schema, API clients, timeouts
  capture.js           Zoom text monitoring and reliable batch transport
  app.js               Dashboard interactions and rendering
  reports.js           TXT, HTML and dependency-free DOCX export
  report-page.js       Print report snapshot rendering
  sample.js            Assignment transcript and labelled sample answers
examples/              Importable transcript and simulated worked TXT report
tests/                 Core/provider/worker regression tests
docs/                  Acceptance checklist, architecture and presentation guide
```

## Operational limits

Up to 20 local sessions, 1,500 statements or 180,000 transcript characters per session; maximum 8,000 characters per statement/answer. The AI input cap is 210,000 characters. Export and delete old sessions if Chrome storage fills. Capture uses known visible selectors, and speaker names are best-effort. Captions are typically committed after about 1.3 seconds of stability and sent on a 1.6-second sweep; AI latency is additional. Analysis is coalesced to the latest session revision; continuously changing transcripts may postpone the final requirement refresh until a pause.

Remote requests time out after 24 seconds and can be retried explicitly. A Chrome alarm checks persisted jobs every 30 seconds if a service worker is suspended. For large meetings or expensive models, disable automatic analysis and run it at discussion checkpoints.

## Documentation

- [Assignment coverage and acceptance checks](docs/ACCEPTANCE.md)
- [Architecture, data flow and evaluation](docs/ARCHITECTURE.md)
- [Demo walkthrough and viva preparation](docs/PRESENTATION.md)
- [Importable assignment transcript](examples/assignment-transcript.txt)
- [Simulated worked report](examples/simulated-worked-report.txt)

## API references

- [Chrome side panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
