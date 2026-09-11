# laawa-sdk

```py
from laawa import LaaWaClient
client = LaaWaClient("https://your-laawa.example.com/api/v1", api_key)
client.send_message(account_id, chat_id, "Hello from LaaWa")
```

The client uses Python's standard HTTP library and has no dependency on the LaaWa server runtime.
