# Incident and Monitoring Copilot

The operations Copilot is available at `/workspace/monitoring/copilot` and from the Copilot buttons on incident and monitor views. It uses the current workspace's incident records, alerts, monitor checks, analytics, and retained OpenTelemetry traces.

## Investigation behavior

- Incident investigations start 30 minutes before the first incident signal and end at resolution or the current time.
- Monitor investigations support one hour, 24 hour, seven day, and 30 day windows.
- Trace evidence is capped at the current 30-day trace retention window and the UI discloses when older evidence is unavailable.
- Stored incident-alert links are confirmed evidence. Service, route, host, deployment, component, and time-window matches are labeled inferred.
- High-confidence root-cause hypotheses require corroboration across at least two evidence families.
- NVIDIA NIM can refine the narrative, but deterministic correlation, impact facts, investigation steps, and drafts remain available when it is unavailable.

The trace correlation understands the current OpenTelemetry semantic fields normalized by Pigeon, including `http.request.method`, `http.response.status_code`, `url.full`, `server.address`, `deployment.environment.name`, and `service.version`, with the existing legacy fallbacks retained.

## Status drafts

Each briefing creates an internal responder draft and a customer-facing draft. Copying a draft only writes to the clipboard. Inserting a draft opens the incident update form with editable text; it does not save the update, notify subscribers, or publish to a status page.

## Configuration

The feature uses the existing `PIGEON_NIM_*` profiles. `PIGEON_NIM_OPERATIONS_MAX_TOKENS` optionally controls the response budget for model-enriched investigations and defaults to `2200`. All evidence is redacted before provider calls or conversation persistence.
