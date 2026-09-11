# LaaWa SDKs

The repository ships lightweight SDK foundations for TypeScript, Python, and PHP. All three target the same `/api/v1` HTTP contract and use bearer API keys.

## TypeScript

```ts
import { LaaWaClient } from "@laava/sdk";
const client = new LaaWaClient({ baseUrl: "https://your-laawa.example.com/api/v1", apiKey: process.env.LAAWA_API_KEY! });
await client.sendMessage({ accountId, chatId, text: "Hello from LaaWa" });
```

## Python

```py
from laawa import LaaWaClient
client = LaaWaClient("https://your-laawa.example.com/api/v1", api_key)
client.send_message(account_id=account_id, chat_id=chat_id, text="Hello from LaaWa")
```

## PHP

```php
$client = new \LaaWa\LaaWaClient('https://your-laawa.example.com/api/v1', getenv('LAAWA_API_KEY'));
$client->sendMessage(['accountId' => $accountId, 'chatId' => $chatId, 'text' => 'Hello from LaaWa']);
```

The SDKs contain no server-side runtime dependency on WhatsApp engines, so adding them does not change Next.js/Vercel/Netlify deployment behavior.
