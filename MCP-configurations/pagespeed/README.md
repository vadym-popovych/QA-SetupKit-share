# PageSpeed Insights API key

The [PageSpeed-report](../../QA-Documentation/Custom-Reports/PageSpeed-report/) collector
(`psi-run.mjs`) calls the public PageSpeed Insights API. **Anonymous calls do not work in
practice** — the shared anonymous quota is exhausted and the API answers:

```
HTTP 429  Quota exceeded for quota metric 'Queries' and limit 'Queries per day'
          of service 'pagespeedonline.googleapis.com'
```

So the collector requires a key of your own. It is free.

## Get the key (2 minutes, no billing)

1. Open <https://console.cloud.google.com/> and pick (or create) any project.
2. **APIs & Services → Library** → search *PageSpeed Insights API* → **Enable**.
3. **APIs & Services → Credentials** → **Create credentials → API key** → copy it.
4. (Recommended) **Restrict key** → *API restrictions* → allow only *PageSpeed Insights API*.

Quotas with a key: **25,000 queries/day, 240/minute** — far above what a report round needs
(pages × platforms × runs; a 60-page site at 3 runs = 360 queries).

## Where it goes

```
MCP-configurations/pagespeed/.token      ← the key, one line, no quotes. Gitignored.
```

The collector reads it in this order: `PSI_API_KEY` → the file named by `PSI_API_KEY_FILE` →
this default path. It never prints the key, and it refuses to run without one rather than
reporting zeros.

## Teammates

This file is **not** shared: `.token` is gitignored, and every teammate creates their own key
by the steps above. Nothing else in the kit needs it.
