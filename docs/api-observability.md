# API Observability

Every versioned API response includes a request identifier. Preserve that identifier in integration logs when diagnosing failures.

Use the HTTP status and machine-readable `error.code` together for retry and error handling. Do not log bearer API keys, worker secrets, database credentials, or message content unless your deployment's data-handling policy explicitly permits it.