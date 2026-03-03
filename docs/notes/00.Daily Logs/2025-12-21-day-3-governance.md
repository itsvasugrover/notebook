---
title: 'The Governance Battle & The Signature Trap'
createTime: 2025/12/21 22:21:19
permalink: /daily-logs/day-3-governance/
---

# Day 3: The Governance Battle & The Signature Trap

- **Date:** 2025-12-21
- **Status:** Success (Governance Locked In)

## Context

Today was supposed to be about building the first Conan package. Instead, it became a deep dive into **Software Supply Chain Security**. I set out to implement Gitflow and Branch Protection across my 4 core repositories.

## The "Unverified" Crisis

I implemented strict **Branch Protection Rules** (Require Signed Commits).

- **The Failure:** I used the GitHub UI to "Rebase and Merge" a feature branch into `develop`.
- **The Result:** All commits lost their "Verified" GPG status.
- **Why:** Rebase rewrites the commit hash (new parent/timestamp). The original local signature becomes mathematically invalid. GitHub tries to re-sign it, but often fails to chain it correctly to my identity.

## The Fix (Squash Strategy)

I realized that "Rebase and Merge" via UI is dangerous for signed workflows unless I do it locally (which is tedious).

- **Decision:** Switch to **Squash and Merge** for PRs.
- **Benefit:** GitHub takes the entire feature branch, squashes it into one atom, and signs it with their trusted `web-flow` GPG key.
- **Outcome:** `main` and `develop` now have a strictly linear history, and every commit is "Verified" green.

## Accomplishments

- Implemented Gitflow (Main/Develop/Feature) across 4 repos.
- Enforced "Squash and Merge" settings to guarantee signatures.
- Created a `github-settings` repo to share rulesets centrally.
- Securely backed up private GPG keys.
- **Notebook Upgrade:** Added `llms.txt` and Local Search to `notebook.notcoderguy.com`.

## Next Steps

- I am rusty on Conan (6 months gap). Day 4 is dedicated to re-learning Conan 2.0 and building the standard environment.
