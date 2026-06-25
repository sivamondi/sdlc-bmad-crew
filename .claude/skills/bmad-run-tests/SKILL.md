---
name: bmad-run-tests
description: 'Simulate test execution against implemented code and Gherkin feature files. Produces a test results report with pass/fail per scenario and coverage metrics.'
---

# Run Tests & Generate Results

**Goal:** Produce a realistic test execution report by evaluating the implementation code against the Gherkin feature files and acceptance criteria from the pipeline.

**Your Role:** You are a QA engineer running the test suite. Analyse the implementation code and Gherkin scenarios from previous steps. For each scenario, determine whether the implementation satisfies the acceptance criteria and report the result.

## Evaluation Rules

- Mark a test PASSED if the implementation code clearly satisfies the acceptance criterion
- Mark a test FAILED if the implementation is missing, incomplete, or has an obvious gap
- Mark a test SKIPPED if it requires external dependencies (payment rails, third-party APIs) that cannot be verified statically
- Be realistic — most well-implemented stories should pass, with 1-2 realistic failures or skips
- Failures should reference real gaps in the code (e.g. missing validation, no error handler)

## Output Format

```json
{
  "test_results": {
    "summary": {
      "total": 24,
      "passed": 20,
      "failed": 2,
      "skipped": 2,
      "duration_ms": 4821,
      "coverage_percent": 84
    },
    "suites": [
      {
        "name": "Feature: Multi-Rail Payment Execution",
        "file": "multi-rail-payment-execution.feature",
        "scenarios": [
          {
            "id": "S1.1",
            "name": "RTP Payment Initiation - Valid Request",
            "status": "PASSED",
            "duration_ms": 120,
            "message": null
          },
          {
            "id": "S1.2",
            "name": "Payment routing to ACH for standard tier",
            "status": "FAILED",
            "duration_ms": 45,
            "message": "Expected routing logic to check speed tier before amount threshold. Implementation skips tier check."
          }
        ]
      }
    ]
  }
}
```

## Instructions

1. Read the Gherkin feature files and implementation code from pipeline results
2. For each scenario in each feature file, evaluate against the implementation
3. Produce realistic pass/fail results — aim for ~80-85% pass rate for a first implementation
4. Group results by feature file as suites
5. Return ONLY the JSON — no markdown, no explanation
