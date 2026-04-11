# @rpgfc/infra

AWS CDK stacks for the Fargate + RDS + ALB + Cognito topology from TDD v2 §13.

**Not implemented in Story 00.** The Walking Skeleton keeps this package as a
placeholder so the workspace layout is complete and future stories can land
CDK stacks (NetworkStack, DatabaseStack, ServiceStack, PipelineStack) without
restructuring.

Story 09 (AWS deployment) adds:

- `bin/app.ts` — CDK entry point.
- `lib/network-stack.ts`, `lib/database-stack.ts`, `lib/service-stack.ts`,
  `lib/pipeline-stack.ts`.
- Environment-aware context (dev / staging / prod).
