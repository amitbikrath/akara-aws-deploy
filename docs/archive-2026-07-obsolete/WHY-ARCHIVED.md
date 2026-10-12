# Archived 2026-07-23 — obsolete deployment-era files

These files describe the ORIGINAL 2025 CloudFormation/OIDC bootstrap and the
`deploy-all.sh` workflow. They are OUT OF DATE and dangerous to follow:

- The live stack has drifted far beyond what these docs (and `infra/terraform/main.tf`)
  describe — ~15 Lambdas, EventBridge crons, SSM params built Apr–Jul 2026.
- `deploy-all.sh` re-applies Terraform and has created duplicate admin CloudFront
  distributions in the past. Never run it.
- Correct deploy workflow lives in the repo-root `CLAUDE.md`: targeted
  `aws s3 cp` + CloudFront invalidation, terraform plan only with explicit approval.

Kept for historical reference only. `akara-aws-deploy.zip` is a stale snapshot
of the repo from the same era.
