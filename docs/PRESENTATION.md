# Demo walkthrough and viva preparation

## A concise project introduction

“ReqAI is a Chrome extension that assists requirements gathering during a Zoom web meeting. It reads visible transcript text, identifies ambiguity, asks the analyst useful clarification questions, and uses recorded stakeholder answers to draft functional and non-functional requirements. Every requirement retains its evidence, and the system compares the original and refined versions using the same transparent rubric.”

## An 8–10 minute demonstration

1. **Problem and architecture (1 minute).** Explain how statements such as “quick,” “good enough” and “soon” leave implementation and acceptance unclear. Show the five workbench sections.
2. **Original dialogue (1 minute).** Load the assignment case study. Explain that the 23 statements come from the assignment; the system has not received any answers yet.
3. **Ambiguity and evidence (2 minutes).** Open Clarifications. Show the performance and ranking questions, expand their source statements, and explain the missing details.
4. **Baseline (1 minute).** Open Requirements → Without clarification. Show unspecified acceptance criteria and open issues. Open Quality review and explain why both scores are initially equal.
5. **A stakeholder response (2 minutes).** Enter an explicitly simulated demonstration response, making its status clear verbally, or use the labelled sample-answer action. Explain who would normally provide this answer. Show a refined requirement and its supporting answer.
6. **Comparison and limits (1 minute).** Explain the actual text checks and percentage-point delta. State that the score is not an empirical effectiveness claim or proof of correctness.
7. **Reporting (1 minute).** Open the report, show both versions, answer provenance, evaluation method and source transcript. Demonstrate DOCX/TXT exports as needed.
8. **Live/AI option (1 minute).** Only if previously tested: demonstrate real Zoom capture or a provider request. Otherwise accurately identify offline mode and explain the completed integration plus remaining environment-specific check.

Do not say the offline rules are a trained model, the simulated answers are from the assignment, or the application has been live-tested when it has not.

## Questions you should be ready to answer

**What is an FR?**
An observable capability of the system: for example, ranking candidates against a job description or exporting a report.

**What is an NFR?**
A constraint or quality attribute of that capability: performance, reliability, security, usability or fairness. A project delivery deadline is kept as a scope/delivery constraint rather than a product NFR.

**Does the extension listen to microphone audio?**
No. Zoom performs speech recognition; the extension reads visible caption/transcript text. Manual and TXT/VTT input provide additional routes.

**Where does AI run?**
OpenAI or Google Gemini receives the selected transcript context via REST when the user configures a key and enables remote analysis. Offline mode runs local handwritten rules, clearly labelled.

**What makes the clarification useful?**
It targets a missing decision or measurable bound, links to the stakeholder's source statement, and becomes explicit input to refinement only after an answer is recorded.

**How do you avoid invented stakeholder answers?**
Questions remain pending, unknowns stay open, and only explicitly recorded answers enter the refined AI request. Simulated answers are separate and marked throughout the output.

**How is the baseline fair?**
Its AI request sees only the original transcript. With no answers, the refined variant is a clone of the baseline. Both are scored using identical checks. Model stochasticity and differing extraction granularity remain limitations in any real empirical comparison.

**How is the score calculated?**
Each requirement gets one point each for clarity, completeness, verifiability and traceability according to the documented rule checks. Per-dimension scores are percentages passing. Overall averages the checks; delta is percentage points.

**What does a score of 100 mean?**
Only that all four implemented text/reference checks passed. It does not establish feasibility, fairness, correctness or legal compliance.

**How do you prevent lost transcript lines during a slow API request?**
Incoming data is immediately saved in serialized transactions. Analysis operates on a snapshot and commits only if that session's revision is still current. Stale results are discarded and the latest revision is queued.

**What if the service worker stops?**
Session and job state are persisted. A scheduled Chrome alarm or a new message can resume a pending job. No durable data relies solely on worker globals.

**What happens when an API call fails?**
The user sees the error. The transcript remains stored. There is no silent substitution with offline output; the user can retry or explicitly select offline mode.

**How are API keys protected?**
They are held in session storage restricted to trusted extension contexts, clear on browser exit, and are excluded from saved meeting records and exports. They are still credentials inside a local browser application, not a hardware-backed vault.

**Why keep source and answer IDs?**
They let a reviewer trace each draft back to its evidence, identify unsupported changes, and distinguish stakeholder decisions from open questions.

**What would you improve next?**
Validate against multiple current Zoom layouts, evaluate with blinded human reviewers, improve semantic contradiction detection and answer sufficiency, support additional meeting platforms, and add controlled collaboration if needed. Those are future improvements, not claims about this release.
