# laavastudios/laawa-sdk

```php
$client = new \LaaWa\LaaWaClient('https://your-laawa.example.com/api/v1', getenv('LAAWA_API_KEY'));
$client->sendMessage(['accountId' => $accountId, 'chatId' => $chatId, 'text' => 'Hello from LaaWa']);
```

Install with Composer after publishing the package metadata. The client requires PHP 8.1+ and cURL.
