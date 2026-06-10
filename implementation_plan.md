# Automated Tests (Phase 3): TC011 - TC015 Implementation Plan

We have successfully implemented TC001 through TC010 with a 100% pass rate. Now, we will implement the final and most complex tests (TC011-TC015), which focus on AI agent logic, document generation, and fail-safes.

## User Review Required

> [!IMPORTANT]
> The final tests require mocking LangSmith tracing, PDF document parsing, and the AI agent APIs. Please review the proposed approach below. Are you okay with mocking the LangSmith API response if real API keys are not present in the `.env.local` file?

## Proposed Changes

### `prisma/schema.prisma`
We need to add models to support the AI agents and document generation.
#### [MODIFY] schema.prisma
- Add `MockDocument` model to store simulated generated PDFs (`WAYBILL`, `TRIPSHEET`, etc.).
- Add `ProvaRecommendation` model to track PROVA seasonal risk outputs.

### AI Agent Endpoints (Mocks)
We will implement the AI agent endpoints to return deterministic responses for the tests.
#### [NEW] src/app/api/agent/reza/chat/route.ts
- Mocks Reza's response in Bengali. 
- Mocks LangSmith tracing logic depending on env vars.

#### [NEW] src/app/api/agent/prova/run/route.ts
- Implements the PROVA seasonal multiplier logic.
- Creates `ProvaRecommendation` records adjusting consumption based on the "Ramadan" override.

#### [NEW] src/app/api/agent/judge/resolve/route.ts
- Implements the JUDGE dispute resolution logic.
- Returns a JSON verdict identifying responsibility and compensation amounts in English and Bengali.

### Document Generation
#### [NEW] src/app/api/uipath/generate-docs/route.ts
- Mocks the document generation by saving text "PDF" contents to the `MockDocument` table so the test script can assert their contents.

### Test Orchestrator
#### [MODIFY] scripts/automated-test-runner.ts
- Implement the `runTC011` through `runTC015` test functions.
- Update the final orchestrator to conditionally run the test suite and report summary metrics.

## Verification Plan

### Automated Tests
- Run `npm run dev` in the background.
- Execute `npx tsx scripts/automated-test-runner.ts` and ensure all 15 tests pass.
