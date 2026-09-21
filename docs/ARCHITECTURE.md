# Architecture and design rationale

## 1. Runtime boundaries

Clariflow is a local Chrome extension. The Zoom content script, background service worker, dashboard, and report page have distinct responsibilities. The content script can submit caption batches and query capture state, but cannot read the extension's stored transcripts or API keys. The service worker restricts storage to trusted extension contexts and checks incoming message origins and active capture tab/session IDs.

No remote scripts, CDN styles, dynamic code execution or runtime npm packages are used. Untrusted transcript and provider strings are escaped before HTML rendering. DOCX XML is separately escaped. JSON-schema validation rejects unknown source IDs, duplicate requirement IDs and invalid types.

## 2. Data flow

```mermaid
sequenceDiagram
    participant Zoom as Zoom page
    participant Capture as Capture script
    participant Worker as Background worker
    participant Store as Chrome local storage
    participant AI as AI provider / local rules
    participant UI as Workbench
    Zoom->>Capture: Caption DOM mutation
    Capture->>Capture: Settle incremental text; assign event ID
    Capture->>Worker: CAPTURE_BATCH(sessionId, items)
    Worker->>Store: Append in serialized transaction
    Worker-->>Capture: Acknowledge durable append
    Worker->>Store: Persist pending analysis job
    Worker->>AI: Snapshot transcript for baseline + questions
    AI-->>Worker: Structured analysis
    Worker->>Worker: Validate references and current revision
    Worker->>Store: Commit only if revision is current
    Store-->>UI: State-change event
    UI->>Worker: ANSWER(questionId, response, recorder)
    Worker->>Store: Save answer and revision history
    Worker->>AI: Baseline from transcript only
    Worker->>AI: Refine using explicit answers
    Worker->>Store: Save source-linked versions
    Store-->>UI: Render requirements and evaluation
```

## 3. Durable work without lost updates

All local read/modify/write transactions share a short promise-chain lock. Network calls happen outside that lock, allowing transcript append and answers to save immediately while analysis runs.

Each material input change increments a session revision. A job operates on a snapshot of that revision. Before committing the result, the worker reads the latest session; if the revision changed, it discards the stale result and queues the newest state. A job cannot resurrect a deleted session. Old Zoom packets are rejected after session switching.

Pending/working job state is persisted. On service-worker restart, an alarm or message can resume it. At most one pump runs in a worker, with a bounded loop and a 30-second recovery alarm. No correctness depends on a long-lived JavaScript global surviving worker suspension. Caption packets retain event IDs across transport retry, and append logic is idempotent.

This is an at-least-once transport with duplicate suppression, not an exactly-once distributed system. Unsent page memory can be lost if the Zoom page closes abruptly. Pausing capture explicitly discards uncommitted partial captions; export only after the most recent desired statement is visible in the workbench.

## 4. Sessions and records

A session includes:

- Identity, title, creation/update timestamps and demo flag.
- Transcript entries: stable T IDs, packet/event IDs, speaker, text, source and timestamps.
- Questions: ID, stable topic, category, source IDs, rationale, status, answer, recorder and origin.
- Baseline and refined requirements: IDs, FR/NFR/Constraint type, category, title, statement, acceptance criteria, source IDs, answer IDs and unresolved issues.
- Revision and analysis revision, provider name, analysis time, job status and visible error.
- Capture tab binding and last received-batch time.
- Answer revision history.

Changing sessions pauses capture. The initial case study is an independent session, not a destructive replacement of the current meeting. JSON export is an archive format; this version imports transcript text/VTT, not arbitrary JSON session archives.

## 5. AI processing

The baseline request receives only source transcript entries and no clarification answers. It extracts requirements and questions in one structured response. If there are no answered questions, the refined requirements are cloned from the baseline, preventing invented improvement. If explicit answers exist, a second request receives the transcript, baseline and those answers.

The system prompt directs the model to distinguish assertions from questions, treat meeting content as data, avoid invented thresholds, preserve unknowns, and cite source and answer IDs. OpenAI uses the Responses API with a strict JSON schema and `store: false`. Gemini uses `generateContent` with JSON schema output. Model IDs are user-configurable.

Runtime validation complements the provider's schema. It does not prove that the model semantically interpreted the source correctly. The user must review the actual wording and evidence. Unsupported schema/model combinations fail visibly. No API failure silently invokes offline generation.

## 6. Offline mode

Offline mode is an English keyword/rule engine. It covers performance, ranking criteria, accuracy, fairness, data preparation, explainability, scope, security, usability and scale. It is useful for transparent demonstrations and deterministic tests; it is not a substitute for general AI analysis.

The baseline preserves stakeholder assertions as draft requirement statements. Concrete numerical or observable assertions can supply acceptance criteria. Incomplete statements retain open issues. Questions ending with a question mark are not independently turned into requirements. Affirmative replies can cite their preceding question for context. Refinement inserts recorded responses into matching source-linked drafts. Short acknowledgements retain an unresolved-detail warning.

Limitations include compound requirements, contextual interpretation, conflicting answers, synonyms, language coverage and the sufficiency of a response. AI mode handles richer extraction, but still requires human review.

## 7. Evaluation design

The rubric scores the actual requirement text and references, not transcript length or number of answered questions. The same four binary checks apply to both variants. Per-dimension percentages and aggregate scores are recomputed at display/export time.

Examples:

- Empty session: no score, not an invented success percentage.
- Unanswered questions: baseline equals refined, so delta is zero.
- “Yes”: an answer is recorded, but completeness remains unresolved.
- “The system shall respond with p95 latency under 2 seconds for 100 concurrent users”: can meet this text rubric in the baseline without a clarification.
- “It should be fast and good enough”: fails clarity and numeric verifiability.

A score of 100 means the four syntactic checks passed. It does not certify correctness, source fidelity, appropriateness, feasibility, legal compliance or actual system performance. Negative changes are allowed. Changes are reported in percentage points. Model-generated scores are not accepted.

For a defensible empirical study, use blinded human reviewers, a written rubric, identical source conversations, recorded actual clarifications and inter-rater agreement. This extension supplies the paired artifacts and traceability; the included simulated example is not such a study.

## 8. Exports

TXT and Word exports are created directly from a shared report model so their content matches. DOCX is a genuine ZIP-based OOXML package with document relationships and paragraph styles, not HTML renamed to .docx. The printable page uses a frozen session snapshot and print CSS; Chrome supplies PDF generation. JSON export omits provider keys/settings and preserves the session record.

The report includes metadata, demo provenance, answer log, both requirement versions, paired comparison, rubric, full transcript and answer revision history. Unspecified criteria and stale analysis are visible rather than replaced with example values.

## 9. Testing strategy

Unit and worker integration tests cover real failure modes: stale writes under concurrent input, duplicate capture retry, wrong-tab/origin messages, session isolation, recovery of persisted jobs, fabricated source rejection, no-key/API errors, no-answer equality, explicit baseline criteria, vague answers, simulated provenance and export escaping.

Browser checks use the actual modules behind a local testing adapter, because an isolated Chrome extension launch was unavailable on this host. The adapter is not packaged in the extension. A representative caption fixture tests the actual capture script. The final live acceptance checklist is required to validate Zoom-specific DOM and account-dependent provider access.
