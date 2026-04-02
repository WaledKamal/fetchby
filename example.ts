import { z } from 'zod';
import { createClient } from './src/index.js'; // Importing directly from TS to test without needing to build first

// 1. Initialize the client
const api = createClient({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  timeoutMs: 5000,
  middlewares: {
    request: [
      (url, config) => {
        console.log(`[Request Interceptor] Starting request to: ${url}`);
        return config;
      }
    ]
  }
});

// A Zod schema to validate the API response for /todos/1
const TodoSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
});

async function runTests() {
  console.log("--- 1. Basic GET Request with Schema Validation ---");
  
  // Zod schema automatically infers the data type!
  const [data, error] = await api.get('/todos/1', {
    schema: TodoSchema
  });
  
  if (error) {
    console.error("❌ Failed to fetch:", error.message);
  } else {
    // "data" strongly typed as: { userId: number, id: number, title: string, completed: boolean }
    console.log("✅ Success! Todo Title:", data.title);
    console.log("✅ Is it completed?:", data.completed);
  }

  console.log("\n--- 2. POST Request with Auto-JSON Conversion ---");
  const [createdData, createError] = await api.post('/todos', {
    json: {
      title: 'Buy groceries',
      completed: false,
      userId: 1,
    }
  });

  if (createError) {
    console.error("❌ POST Error:", createError);
  } else {
    console.log("✅ Successfully created Todo:", createdData);
  }

  console.log("\n--- 3. Testing Retry Mechanism on Bad API ---");
  const [badData, badError] = await api.get('/this-does-not-exist', {
    retries: 2,           // Retry 2 times
    retryDelay: 500,      // Wait 500ms between attempts
  });

  if (badError) {
    console.error("❌ Handled Expected Error:", badError.message);
  } else {
    console.log("Got bad data??", badData);
  }
}

runTests();
