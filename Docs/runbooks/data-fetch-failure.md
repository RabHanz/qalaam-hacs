# Runbook — `make data-fetch` fails

## Symptom

`make data-fetch` exits non-zero. Backend then returns 503 with
`code: qalaam.data.not-loaded` for any verse outside Al-Fatiha (which falls
back to the bundled fixture).

## Likely cause

One of:

1. **Upstream URL changed** — QUL, quran-align, or quran-tajweed moved/renamed a release.
2. **SHA256 mismatch** — upstream re-cut a release with the same URL but new content.
3. **Git LFS quota exhausted** — common on free accounts after many CI runs.
4. **Network egress blocked** — corporate proxy or firewall.

## Diagnosis

```bash
# Confirm which step fails
bash -x scripts/data/download-qul.sh
bash -x scripts/data/download-quran-align.sh
bash -x scripts/data/download-quran-tajweed.sh

# Check expected vs actual SHA
sha256sum data/qul.sqlite

# Check Git LFS quota
git lfs env | grep -i quota
```

## Mitigation

- If SHA mismatch: download manually, verify the upstream changelog, update the pinned `*_SHA256` in the script, commit.
- If LFS quota: use `FORCE_REDOWNLOAD=1` to bypass cache; consider self-hosting the data on Cloudflare R2 (the long-term fix).
- If network blocked: proxy via `HTTPS_PROXY=http://corp.proxy:3128 make data-fetch`.

## Long-term fix

- v0.5: mirror QUL + quran-align + quran-tajweed releases to our own Cloudflare R2 bucket. Eliminates the upstream-availability dependency. (Not a license issue — both CC-BY-4.0 and MIT permit re-hosting with attribution; QUL is MIT and we credit Tarteel anyway.)
- v1.0: the `data-fetch` script falls back from upstream → R2 mirror automatically.

## Outcome impacted

- O-01 (mistake-detection latency)
- O-03 (offline Hifdh — opportunity = 16, highest)
- O-05 (mutashabihat surfacing)
