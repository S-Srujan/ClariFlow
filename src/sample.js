export const CASE_STUDY = [
  {
    "speaker": "Hiring Manager",
    "text": "We need to build an AI-based resume analyzer that can automatically shortlist candidates for our software engineering roles."
  },
  {
    "speaker": "ML Engineer",
    "text": "Okay. How should the system decide which candidates to shortlist?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "It should rank them based on relevance to the job description."
  },
  {
    "speaker": "ML Engineer",
    "text": "How are we defining relevance?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "Mainly skills and experience. And overall profile strength."
  },
  {
    "speaker": "ML Engineer",
    "text": "What does overall profile strength include?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "Things like good companies, solid projects, impactful work."
  },
  {
    "speaker": "ML Engineer",
    "text": "Should we prioritize years of experience?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "Yes, but not strictly. Sometimes a strong fresher is better than someone with 5 average years."
  },
  {
    "speaker": "ML Engineer",
    "text": "Do we have historical hiring data to train the system?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "We have past resumes and hiring decisions, but they’re not very structured."
  },
  {
    "speaker": "ML Engineer",
    "text": "How accurate should the system be?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "It should be good enough so that HR trusts it."
  },
  {
    "speaker": "ML Engineer",
    "text": "Do we need explainability? For example, why a candidate was ranked higher?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "Yes, that would be useful."
  },
  {
    "speaker": "ML Engineer",
    "text": "Are there any constraints regarding bias or fairness?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "Yes, we must avoid bias, especially related to gender or college background."
  },
  {
    "speaker": "ML Engineer",
    "text": "Should the system process resumes in real-time or batch mode?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "It shouldn’t be slow."
  },
  {
    "speaker": "ML Engineer",
    "text": "What is the expected response time per resume?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "Ideally quick."
  },
  {
    "speaker": "ML Engineer",
    "text": "What is the timeline for delivery?"
  },
  {
    "speaker": "Hiring Manager",
    "text": "We need an MVP soon."
  }
];
export const DEMO_ANSWERS = {
  "performance": "The system shall process 95% of individual PDF resumes within 2 seconds under 100 concurrent users. A 500-resume batch shall finish within 10 minutes. Verify with a repeatable load test using the agreed resume dataset.",
  "ranking": "The system shall rank candidates using 50% job-skill match, 30% verified project evidence and 20% relevant experience. Company prestige and college name shall not be ranking features. Freshers shall be assessed using the same skill and project rubric. Verify the ordering against 30 stakeholder-approved example pairs.",
  "accuracy": "Before release, the system shall achieve Precision@20 of at least 85% on 200 held-out resumes independently labelled by two hiring reviewers. The system shall display uncertain cases for human review rather than automatically rejecting them.",
  "fairness": "The system shall exclude names, gender, photographs and college names from ranking features. On the agreed test set, the absolute true-positive-rate difference between evaluated groups shall not exceed 5 percentage points. A fairness reviewer shall inspect failures before release. Verify feature exclusion and group metrics with the labelled audit dataset.",
  "data": "The system shall accept text-based PDF and DOCX resumes. The system shall reject unreadable files with an actionable error and shall store reviewer-approved labels separately from the held-out evaluation set. Historical hiring decisions shall not be treated as objective ground truth without review.",
  "explainability": "The system shall display the matched skills, missing mandatory skills and contribution of each scoring component for every ranked candidate. Reviewers shall verify these explanations against the input resume and published rubric on 30 test cases.",
  "scope": "The initial release shall be delivered within 6 weeks of stakeholder approval and shall include PDF/DOCX import, job-description entry, candidate ranking, explanations and human review. Automatic rejection and external applicant-tracking integrations are out of scope."
};
