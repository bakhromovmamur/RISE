-- Schema lookup is needed by readiness and integration hooks, not table access.
grant usage on schema rise to rise_lifecycle;
