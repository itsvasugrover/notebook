---
title: 'Fighting Physics & The ''Split Brain'''
createTime: 2025/12/20 22:21:19
permalink: /daily-logs/day-2-artifactory/
---

# Day 2: Fighting Physics & The "Split Brain"

- **Date:** 2025-12-20
- **Status:** Pivoted

## Context

I need a Binary Repository (Artifactory) to store Yocto SSTATE cache and huge `.wic` system images (4GB+). My initial plan was to host this on the Cloud VPS behind Cloudflare, just like Jenkins.

## The Problem

1. **The Bandwidth Wall:** Cloudflare Free Tier enforces a strict **100MB upload limit** per request.
2. **The Physics:** Uploading a 4GB image from my residential connection (30Mbps upstream) would take ~20 minutes per build. This destroys the feedback loop.
3. **The "Split Brain" Network:** I tried hosting Artifactory locally but accessing it via a public URL (`artifactory.notcoderguy.com`). This caused a routing loop where the Docker container couldn't talk to itself correctly via the external proxy, leading to "Endless Loading" screens and CORS errors.

## The Pivot (ADR 002)

I realized "Cloud First" is wrong for heavy artifacts. I moved the Storage Layer to the **Local Agent**.

- **Action:** Deployed **JFrog Artifactory CE (C++ Edition)** locally on port 8082.
- **Networking Fix:** Used `host-gateway` in Docker to allow the Jenkins Agent container to talk to the Artifactory container on the host via `https://artifactory.arpa:8082`.
- **Version Pin:** Downgraded Artifactory to `7.77.5` to fix a specific UI bug in the latest tag.

## Outcome

- Artifactory is running locally.
- Uploads happen over the Docker Bridge (Loopback) at NVMe speeds (0 latency).
- Zero cost for storage.
- Bypassed Cloudflare limits entirely.

## Next Steps

- Governance: Setup Repo rules.
- Build: Create the first `conanfile.py` and run a test build.
