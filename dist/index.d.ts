import { z } from 'zod';

/**
 * Standard HTTP methods supported by the fetch API.
 */
type FetchMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
/**
 * Middleware for processing requests before they are sent.
 */
interface RequestMiddleware {
    (url: string, config: RequestInit): Promise<RequestInit> | RequestInit;
}
/**
 * Middleware for processing responses after they are received.
 */
interface ResponseMiddleware {
    (response: Response): Promise<Response> | Response;
}
/**
 * Configuration options for the Client instance.
 */
interface ClientConfig extends Omit<RequestInit, 'method'> {
    /** Base URL prepended to all endpoints */
    baseUrl?: string;
    /** Number of times to retry a failed request */
    retries?: number;
    /** Delay in milliseconds between retries, or a function that receives the attempt number and returns the delay */
    retryDelay?: number | ((attempt: number) => number);
    /** Timeout in milliseconds for the request */
    timeoutMs?: number;
    middlewares?: {
        request?: RequestMiddleware[];
        response?: ResponseMiddleware[];
    };
}
/**
 * Configuration options for a single request.
 */
interface RequestConfig<T = unknown> extends ClientConfig {
    /** The HTTP method */
    method?: FetchMethod;
    /** Zod schema for response validation and automatic type inference */
    schema?: z.ZodSchema<T>;
    /** Automatically serialized to JSON and attached to the body */
    json?: unknown;
    /** Object representing URL query parameters */
    query?: Record<string, string | number | boolean | undefined | null>;
}
/**
 * A Result pattern tuple. Returns either [Data, null] or [null, Error].
 * Avoids the need for try/catch blocks.
 */
type Result<T, E = Error> = [data: T, error: null] | [data: null, error: E];
/**
 * Custom error class to carry additional context for failed HTTP requests.
 */
declare class FetchError extends Error {
    readonly message: string;
    readonly status?: number | undefined;
    readonly response?: Response | undefined;
    readonly data?: any | undefined;
    constructor(message: string, status?: number | undefined, response?: Response | undefined, data?: any | undefined);
}

/**
 * A lightweight HTTP Client that wraps the native Fetch API.
 * Provides retries, Zod validation, Result pattern, middlewares, and more.
 */
declare class LightClient {
    private config;
    constructor(config?: ClientConfig);
    /**
     * Add a request middleware.
     * Runs before the fetch request is made. Use this to modify headers, auth tokens, etc.
     */
    useRequestMiddleware(mw: NonNullable<NonNullable<ClientConfig['middlewares']>['request']>[number]): this;
    /**
     * Add a response middleware.
     * Runs before the response is evaluated and parsed. Use this for global error tracking, etc.
     */
    useResponseMiddleware(mw: NonNullable<NonNullable<ClientConfig['middlewares']>['response']>[number]): this;
    get<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>): Promise<Result<T, Error>>;
    post<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>): Promise<Result<T, Error>>;
    put<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>): Promise<Result<T, Error>>;
    patch<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>): Promise<Result<T, Error>>;
    delete<T = unknown>(url: string, config?: Omit<RequestConfig<T>, 'method'>): Promise<Result<T, Error>>;
    /**
     * Core request method. Follows the [data, error] result pattern.
     * Never throws HTTP-related or validation exceptions.
     */
    request<T = unknown>(endpoint: string, inlineConfig?: RequestConfig<T>): Promise<Result<T, Error>>;
}
/**
 * Functional factory to create a new client instance easily.
 */
declare const createClient: (config?: ClientConfig) => LightClient;
/**
 * Expose a default instance for quick/global usage natively.
 */
declare const fetcher: LightClient;

export { type ClientConfig, FetchError, type FetchMethod, LightClient, type RequestConfig, type RequestMiddleware, type ResponseMiddleware, type Result, createClient, fetcher };
