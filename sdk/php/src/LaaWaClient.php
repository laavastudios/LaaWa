<?php

declare(strict_types=1);

namespace LaaWa;

final class LaaWaApiException extends \RuntimeException
{
    public function __construct(public readonly int $status, string $message, public readonly ?string $code = null, public readonly mixed $details = null)
    { parent::__construct($message); }
}

final class LaaWaClient
{
    public function __construct(private readonly string $baseUrl, private readonly string $apiKey, private readonly int $timeout = 30) {}

    private function request(string $path, string $method = 'GET', ?array $payload = null): mixed
    {
        $ch = curl_init(rtrim($this->baseUrl, '/') . $path);
        $headers = ['Authorization: Bearer ' . $this->apiKey, 'Accept: application/json'];
        $options = [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => $this->timeout];
        if ($payload !== null) { $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_THROW_ON_ERROR); $headers[] = 'Content-Type: application/json'; $options[CURLOPT_HTTPHEADER] = $headers; }
        curl_setopt_array($ch, $options);
        $raw = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $error = curl_error($ch); curl_close($ch);
        if ($raw === false) throw new LaaWaApiException($status ?: 503, $error ?: 'Request failed');
        $body = json_decode($raw, true) ?: [];
        if ($status >= 400 || !($body['ok'] ?? false)) { $e = $body['error'] ?? []; throw new LaaWaApiException($status, $e['message'] ?? 'Request failed', $e['code'] ?? null, $e['details'] ?? null); }
        return $body['data'] ?? null;
    }

    public function health(): mixed { return $this->request('/health'); }
    public function engines(): mixed { return $this->request('/engines'); }
    public function messages(string $accountId, string $chatId): mixed { return $this->request('/messages?' . http_build_query(['accountId' => $accountId, 'chatId' => $chatId])); }
    public function sendMessage(array $message): mixed { $message['action'] ??= 'send'; return $this->request('/messages', 'POST', $message); }
}
