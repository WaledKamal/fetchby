import { ClientConfig, RequestConfig, Result, FetchError } from './types.js';

// Re-export types for consumers
export * from './types.js';

// Utility delay function for retries
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A lightweight HTTP Client that wraps the native Fetch API.
 * Provides retries, Zod validation, Result pattern, middlewares, and more.
 */
export class LightClient {
  private config: ClientConfig;

  constructor(config: ClientConfig = {}) {
    this.config = {
      retries: 0,
      retryDelay: 1000,
      ...config,
      middlewares: {
        request: config.middlewares?.request || [],
        response: config.middlewares?.response || [],
      },
    };
  }

  /**
   * Add a request middleware.
   * Runs before the fetch request is made. Use this to modify headers, auth tokens, etc.
   */
  public useRequestMiddleware(mw: NonNullable<NonNullable<ClientConfig['middlewares']>['request']>[number]) {
    this.config.middlewares!.request!.push(mw);
    return this; // Builder pattern
  }

  /**
   * Add a response middleware.
   * Runs before the response is evaluated and parsed. Use this for global error tracking, etc.
   */
  public useResponseMiddleware(mw: NonNullable<NonNullable<ClientConfig['middlewares']>['response']>[number]) {
    this.config.middlewares!.response!.push(mw);
    return this;
  }

  // Convenience methods matching Axios's API
  public get<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>) {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  public post<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>) {
    return this.request<T>(url, { ...config, method: 'POST' });
  }

  public put<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>) {
    return this.request<T>(url, { ...config, method: 'PUT' });
  }

  public patch<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>) {
    return this.request<T>(url, { ...config, method: 'PATCH' });
  }

  public delete<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>) {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  /**
   * Core request method. Follows the [data, error] result pattern.
   * Never throws HTTP-related or validation exceptions.
   */
  public async request<T = unknown>(endpoint: string, inlineConfig: RequestConfig<T> = {}): Promise<Result<T, Error>> {
    // Merge client-level configurations with request-level configurations
    const rawHeaders = { ...this.config.headers, ...inlineConfig.headers };
    
    const mergedConfig: RequestConfig<T> = { 
      ...this.config, 
      ...inlineConfig,
      headers: rawHeaders
    };
    
    const { 
      baseUrl, 
      retries = 0, 
      retryDelay = 1000, 
      timeoutMs, 
      schema, 
      json, 
      query, 
      ...init 
    } = mergedConfig;

    // 1. Build the full URL
    let fullUrl = baseUrl && !endpoint.startsWith('http') 
        ? `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}` 
        : endpoint;
    
    // Append query strings if they exist
    if (query) {
      // Use a dummy base 'http://localhost' if we only have a relative path so URL can parse it
      const hasHttp = fullUrl.startsWith('http');
      const urlObj = new URL(fullUrl, hasHttp ? undefined : 'http://localhost');
      
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          urlObj.searchParams.append(key, String(value));
        }
      }
      
      fullUrl = hasHttp ? urlObj.toString() : urlObj.toString().replace('http://localhost', '');
    }

    // 2. Prepare headers (Automatic JSON support)
    const headers = new Headers(init.headers as HeadersInit);
    
    if (json) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      init.body = JSON.stringify(json);
    }
    
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    
    init.headers = headers;

    let attempt = 0;
    const maxAttempts = retries + 1;

    // Execution loop for requests with retries
    while (attempt < maxAttempts) {
      // Configure AbortController per request attempt
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const abortController = new AbortController();
      
      const onParentAbort = () => abortController.abort();
      if (init.signal) {
        if (init.signal.aborted) {
          return [null, new Error('Request was aborted')];
        }
        init.signal.addEventListener('abort', onParentAbort);
      }

      try {
        let finalInit: RequestInit = { ...init, signal: abortController.signal } as RequestInit;

        // Execute request middlewares
        const requestMws = this.config.middlewares?.request || [];
        for (const mw of requestMws) {
          finalInit = await mw(fullUrl, finalInit);
        }

        // The actual fetch call
        const fetchPromise = fetch(fullUrl, finalInit);
        let response: Response;

        if (timeoutMs) {
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              abortController.abort();
              reject(new Error('TimeoutError'));
            }, timeoutMs);
          });
          // React Native fallback for timeouts: Promise.race guarantees rejection
          // even if the internal fetch doesn't support generic AbortController timeouts
          response = await Promise.race([fetchPromise, timeoutPromise]);
        } else {
          response = await fetchPromise;
        }

        // Execute response middlewares
        const responseMws = this.config.middlewares?.response || [];
        for (const mw of responseMws) {
          response = await mw(response);
        }

        // Verify if HTTP status is OK
        if (!response.ok) {
          let errorData;
          try {
            // Attempt to parse JSON error message if the API provides it
            errorData = await response.json();
          } catch {
            // Fallback to text if it isn't JSON
            errorData = await response.text();
          }
          throw new FetchError(`HTTP Error: ${response.status} ${response.statusText}`, response.status, response, errorData);
        }

        // Handle empty 204 No Content responses successfully
        if (response.status === 204) {
          return [undefined as unknown as T, null];
        }

        let data: any;
        const contentType = response.headers.get('content-type');
        
        // Auto parse JSON if content type hints at it
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        // Perform schema validation using Zod
        if (schema) {
          const parsed = schema.safeParse(data);
          if (!parsed.success) {
            return [null, new FetchError('Schema validation failed', response.status, response, parsed.error)];
          }
          data = parsed.data;
        }

        return [data as T, null];

      } catch (error) {
        attempt++;
        
        // Avoid retrying if the request was aborted manually or via timeout
        if (error instanceof Error && (error.name === 'AbortError' || error.message === 'TimeoutError')) {
           return [null, new Error(`Request timed out after ${timeoutMs}ms or was aborted`)];
        }
        
        // Return error immediately if we exhausted max retries
        if (attempt >= maxAttempts) {
          const err = error instanceof Error ? error : new Error(String(error));
          return [null, err];
        }

        // Wait before sending the next attempt
        const delay = typeof retryDelay === 'function' ? retryDelay(attempt) : retryDelay;
        await sleep(delay);
      } finally {
        // Cleanup timeout and event listeners on every attempt to avoid memory leaks
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // Safely remove the abort listener if signal was provided
        if (init.signal && typeof init.signal.removeEventListener === 'function') {
          init.signal.removeEventListener('abort', onParentAbort);
        }
      }
    }
    
    return [null, new Error('Unknown HTTP Error')];
  }
}

/**
 * Functional factory to create a new client instance easily.
 */
export const createClient = (config?: ClientConfig) => new LightClient(config);

/**
 * Expose a default instance for quick/global usage natively.
 */
export const fetcher = createClient();
