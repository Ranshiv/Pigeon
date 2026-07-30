# Free production integrations

This project already has Sentry error monitoring and a Prometheus-compatible
`/metrics` endpoint. The remaining integrations are intentionally optional and
are enabled through the hosting provider or GitHub, not committed secrets.

## Frontend environment variables

Configure these in the frontend hosting provider:

```text
REACT_APP_SITE_URL=https://your-deployed-domain.example
REACT_APP_POSTHOG_KEY=your-public-posthog-project-key
REACT_APP_POSTHOG_HOST=https://eu.i.posthog.com
REACT_APP_POSTHOG_ENABLED=true
```

PostHog is loaded only after the visitor grants consent. The implementation
disables autocapture and session replay by default. Do not put private API keys
in `REACT_APP_*` variables; browser values are visible to users.

## Cloudflare Turnstile

Turnstile protects the public API demo at `/api/public-demo/request` from
automated abuse.

Frontend local/host variable:

```text
REACT_APP_TURNSTILE_SITE_KEY=your-site-key
```

Backend-only local/host variable:

```text
TURNSTILE_SECRET_KEY=your-secret-key
```

Add the deployed frontend hostname to the Turnstile widget's allowed
hostnames in Cloudflare. The backend verifies each token with Cloudflare before
it makes the restricted outbound demo request. Never put the secret key in the
frontend environment or source code.

## API environment variables

The existing Sentry API variables remain server-side:

```text
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=...
```

Keep `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` only in GitHub
Actions secrets for source-map upload. Never put the auth token in `.env` used
by a deployed browser build.

## Accounts and external setup

1. Cloudflare Free: move the production DNS zone to Cloudflare, enable HTTPS,
   and proxy the public frontend/API origins where appropriate.
2. Google Search Console: verify the domain and submit `/sitemap.xml`.
3. Bing Webmaster Tools: verify the domain and submit the same sitemap.
4. Grafana Cloud Free: configure a Prometheus scrape or Grafana Alloy agent
   for the API's authenticated `/metrics` endpoint. Do not expose metrics
   publicly without an access-control decision.
5. PostHog: create an EU project, copy its project key, and configure the
   frontend values above.

## GitHub security

Enable Dependabot alerts and version updates, secret scanning where available,
repository rulesets, and CodeQL alerts. The repository now includes CodeQL,
dependency-review, and manually triggered OWASP ZAP baseline workflows.

The ZAP workflow requires a deployed URL because scanning localhost from GitHub
Actions would test the runner instead of the application.

## SEO scope

The client build generates `sitemap.xml` and `robots.txt` from
`REACT_APP_SITE_URL`. Public routes are included; authenticated workspace
routes are marked `noindex`. Search ranking still depends on content quality,
performance, search intent, and authoritative links; no integration guarantees
a first-page or top result.
