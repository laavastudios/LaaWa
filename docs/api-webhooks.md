# Webhook Integration Note

When consuming webhook deliveries from a LaaWa integration, validate the configured webhook secret before processing an event and treat delivery identifiers as idempotency keys where the receiving system supports them.

This document complements the v1 API reference; webhook delivery configuration remains part of the existing LaaWa webhook system.