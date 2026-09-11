# @laava/sdk

Typed HTTP client for the LaaWa v1 API.

```ts
import { LaaWaClient } from "@laava/sdk";
const client = new LaaWaClient({ baseUrl: "https://your-laawa.example.com/api/v1", apiKey: process.env.LAAWA_API_KEY! });
await client.sendMessage({ accountId, chatId, text: "Hello from LaaWa" });
```

The client uses standard `fetch`, so it works in modern Node.js, edge-compatible runtimes, browsers with appropriate API-key handling, and server applications.
