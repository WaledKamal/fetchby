# @kamavinga/fetchby

A modern, functional, and ultra-lightweight Fetch API wrapper. Built for the Edge, Browser, and Node.js.

Looking for an alternative to Axios that is smaller, faster, and perfectly typed with TypeScript? **@kamavinga/fetchby** is a zero-dependency (other than Zod optionally) HTTP client that uses modern API paradigms.

## Features ✨

* **Result Pattern**: Eliminates `try/catch` by returning `[data, error]` tuples.
* **Native Fetch & Edge Ready**: Under the hood, it's just the native `fetch` API. Works flawlessly in Next.js Edge, Cloudflare Workers, Node 18+, and browsers.
* **TypeScript & Zod Support**: Top tier type-safety. Optionally pass a Zod schema to automatically validate real-world responses and infer your types.
* **Smart Defaults**: Defaults to `application/json` automatically. It parses JSON for you.
* **Built-in Retry Logic**: Configure retries with fixed or exponential delays.
* **Timeout Support**: Easy request cancellation via AbortController timeouts.
* **Middleware System**: Mutate requests or responses globally via middlewares interceptors.
* **Tiny Bundle Size**: Way less than 3KB.

## Installation 📦

```bash
npm install @kamavinga/fetchby
```

*Optional: If you want schema-validation, make sure Zod is installed.*

```bash
npm install zod
```

## Why over Axios? 🤔

* Axios's bundle size is quite large (~11KB) and brings various dependencies.
* Axios is rooted in `XMLHttpRequest` in browsers, which limits native `fetch` features like streams and background processing.
* In Axios everywhere you handle HTTP, you wrap it in `try/catch`. `@kamavinga/fetchby` gives you straightforward linear predictable flows via `[data, error]`.
* No need to augment or wrap Axios to use `zod` schema parsers smoothly.

## Standard Usage 🚀

Instead of ugly `try/catch` blocks:

```ts
import { createClient } from '@kamavinga/fetchby';

const api = createClient({ baseUrl: 'https://api.example.com' });

async function getUser() {
  const [data, error] = await api.get('/users/1');
  
  if (error) {
    console.error("Failed to load user:", error.message);
    return;
  }
  
  console.log("User Loaded: ", data);
}
```

## Advanced Patterns 🛠️

### Zod Schema Validation

Validate the fetched data natively before letting your app consume it. If validation fails, `error` is populated and `data` is `null`.

```ts
import { z } from 'zod';
import { createClient } from '@kamavinga/fetchby';

const api = createClient({ baseUrl: 'https://api.example.com' });

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

// data is strictly inferred as the typescript representation of UserSchema
const [data, error] = await api.get('/users/1', {
  schema: UserSchema
});
```

### Auto Retries & Timers

```ts
const [data, error] = await api.request('/flaky-endpoint', {
  method: 'POST',
  json: { title: 'hello' }, // Automatically turns into JSON string + sets Content-Type header
  query: { limit: 10 }, // Automagically appends ?limit=10 to the URL 
  retries: 3,
  retryDelay: (attempt) => attempt * 1000,
  timeoutMs: 5000 // Error out after 5 seconds
});
```

### Middlewares

Intercept requests and responses to add headers, tokens, or read metrics.

```ts
const api = createClient({ baseUrl: 'https://api.mysite.com' });

api.useRequestMiddleware(async (url, config) => {
  const token = await getAuthToken();
  if (token) {
    const headers = new Headers(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

api.useResponseMiddleware((response) => {
  if (response.status === 401) {
    console.log("Unauthorized request!");
  }
  return response;
});
```
