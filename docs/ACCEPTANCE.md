# Assignment coverage and acceptance checklist

The supplied PDF defines the scope. It does not provide stakeholder clarification answers or require any fixed improvement score.

| Assignment feature | Implementation | Verification |
| --- | --- | --- |
| Chrome extension | Manifest V3; service worker; side panel/full workbench | Manifest/files validated; installation remains a user Chrome check |
| Monitor live meeting transcripts | Zoom content script, opt-in tab/session binding | Actual script tested against caption DOM fixture; live Zoom remains to verify |
| Detect ambiguity/incompleteness | Structured AI extraction; labelled offline rules | Offline case study and provider response validation tested |
| AI clarification questions | OpenAI/Gemini schema returns source-linked questions | API request/response contract mocked; real account test remains |
| Accept stakeholder responses | Named recorder, editable answers, revision history | Browser answer submission and worker tests |
| Extract FRs | Structured requirements with acceptance criteria | Core and UI checks |
| Extract and categorize NFRs | Category field; UI/report display | Case study includes Performance, Reliability, Fairness, Explainability |
| Refine after clarification | Answers trigger fresh generation; source/answer links | No-answer equality and answer-linked refinement tests |
| Compare both versions | Baseline/refined views; report paired comparison | Baseline separation and rubric tests |
| Suitable quality metrics | Four documented content/reference checks | Empty/explicit/vague-input regression tests |
| Display results | Meeting, clarification, requirement, quality and export views | Browser preview inspected, including 400px frame |
| PDF/DOCX/TXT reports | Printable HTML; genuine OOXML; text | HTML inspected; DOCX integrity/parser checked; TXT content checked |

## Automated regression suite

From this folder, with Node 20 or later:

```sh
npm test
```

No dependency installation is needed. At packaging: **20 tests passed**. Tests make no paid API calls and use no real API keys.

## First live acceptance run — not claimed as completed

1. Load the unpacked folder in Chrome. Confirm no extension errors and the toolbar icon opens the workbench side panel.
2. Open the case study. Confirm 23 statements, seven offline questions and no answered questions. Baseline/refined values should be identical.
3. Enter a precise performance response with a target and workload. Confirm it survives closing/reopening the panel and appears in the supporting-answer details.
4. Start a new meeting, join Zoom in a Chrome tab, enable captions, and start capture in ReqAI. Say two distinct statements. Confirm each appears once, in full, with a reasonable speaker label.
5. Pause capture. Speak again and confirm no new statement is added. Switch sessions and confirm old packets do not enter the new session.
6. Select an AI provider, enter a supported model ID and a real key, enable remote processing, and run a small transcript. Confirm the provider label appears and output references actual transcript IDs.
7. Test an invalid key/model. Confirm a visible error and no silent switch to offline results. Restore valid settings.
8. Submit an actual clarification. Verify baseline requirements do not contain answer-only facts; refined requirements cite the answer. Read for invented constraints and missing issues.
9. Export PDF, DOCX and TXT. Open each, compare the transcript and both requirement versions, and check long paragraphs/page breaks in the chosen viewer.
10. Close and reopen Chrome. Confirm sessions persist and API keys must be re-entered.

## Known boundaries

- Zoom DOM support is best-effort and must be checked with the meeting client's current layout. Native Zoom, microphone audio, hidden/non-rendered captions and arbitrary non-Zoom sites are outside this capture implementation.
- Offline analysis is rule-based. It does not understand arbitrary domains or all contextual/implicit requirements.
- Formal semantic evaluation, blinded human grading and empirical comparison are not replaced by the built-in text rubric.
- Real API model availability, account quota, provider latency and safety refusals are environment-dependent.
- A paused/reloaded/closed Zoom page can lose partial text not yet acknowledged by the worker.
- JSON files are archival exports; transcript import accepts TXT/VTT only.
- There is no automatic question-speaking or automatic answer attribution. The analyst records stakeholder responses explicitly.
