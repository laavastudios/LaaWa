# LaaWa API Examples

## Health

```bash
curl "https://YOUR-LAAWA-HOST/api/v1/health"
```

## Conversations

```bash
curl "https://YOUR-LAAWA-HOST/api/v1/conversations?limit=50" -H "Authorization: Bearer $LAAWA_API_KEY"
```

## Contacts

```bash
curl "https://YOUR-LAAWA-HOST/api/v1/contacts?q=Acme&limit=25" -H "Authorization: Bearer $LAAWA_API_KEY"
```

## Send a message

```bash
curl -X POST "https://YOUR-LAAWA-HOST/api/v1/messages" \
  -H "Authorization: Bearer $LAAWA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"ACCOUNT_ID","to":"919876543210","type":"text","body":"Hello from LaaWa"}'
```

## Realtime

```text
GET /api/v1/events?accountId=ACCOUNT_ID
Authorization: Bearer LAAWA_API_KEY
Accept: text/event-stream
```
