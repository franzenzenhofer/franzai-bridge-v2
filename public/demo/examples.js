// FranzAI Bridge Demo - Example Configurations
// Each example demonstrates a specific extension capability

const DemoExamples = {
  // AI Provider Examples
  aiProviders: [
    {
      id: 'openai',
      name: 'OpenAI GPT-5.1',
      description: 'Chat completion with automatic API key injection',
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Content-Type': 'application/json' },
      body: { model: 'gpt-5.1-codex-mini', messages: [{ role: 'user', content: 'Hello! Tell me a fun fact about AI.' }] },
      requiresKey: 'openai'
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Messages API with anthropic-version header',
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: { model: 'claude-haiku-4.5-20251015', max_tokens: 1024, messages: [{ role: 'user', content: 'What is the capital of France?' }] },
      requiresKey: 'anthropic'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'GenerateContent API with query param injection',
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
      headers: { 'Content-Type': 'application/json' },
      body: { contents: [{ parts: [{ text: 'Explain quantum computing in simple terms.' }] }] },
      requiresKey: 'gemini'
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      description: 'Chat completion compatible endpoint',
      method: 'POST',
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Content-Type': 'application/json' },
      body: { model: 'mistral-small-3.1-24b-instruct', messages: [{ role: 'user', content: 'Write a haiku about coding.' }] },
      requiresKey: 'mistral'
    }
  ],

  // CORS Bypass Examples (no API key needed)
  corsExamples: [
    {
      id: 'hackernews',
      name: 'Hacker News API',
      description: 'Fetch top stories (normally blocked by CORS)',
      method: 'GET',
      url: 'https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty',
      noBody: true
    },
    {
      id: 'github',
      name: 'GitHub API',
      description: 'Get recent commits from a public repo',
      method: 'GET',
      url: 'https://api.github.com/repos/anthropics/claude-code/commits?per_page=5',
      noBody: true
    },
    {
      id: 'jsonplaceholder',
      name: 'JSONPlaceholder',
      description: 'Test REST API responses',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      noBody: true
    },
    {
      id: 'httpbin-post',
      name: 'HTTPBin Echo',
      description: 'Echo POST data back (test body handling)',
      method: 'POST',
      url: 'https://httpbin.org/post',
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Hello from FranzAI Bridge!', timestamp: new Date().toISOString() }
    },
    {
      id: 'httpbin-headers',
      name: 'HTTPBin Headers',
      description: 'Inspect request headers',
      method: 'GET',
      url: 'https://httpbin.org/headers',
      noBody: true
    }
  ],

  // Advanced Feature Examples
  advancedExamples: [
    {
      id: 'custom-headers',
      name: 'Custom Headers',
      description: 'Send custom headers with request',
      method: 'POST',
      url: 'https://httpbin.org/post',
      headers: { 'Content-Type': 'application/json', 'X-Custom-Header': 'FranzAI-Test', 'X-Request-ID': 'demo-123' },
      body: { test: 'custom headers' }
    },
    {
      id: 'different-methods',
      name: 'PUT Request',
      description: 'Test different HTTP methods',
      method: 'PUT',
      url: 'https://httpbin.org/put',
      headers: { 'Content-Type': 'application/json' },
      body: { updated: true, data: 'PUT request test' }
    },
    {
      id: 'delete-method',
      name: 'DELETE Request',
      description: 'Test DELETE method',
      method: 'DELETE',
      url: 'https://httpbin.org/delete',
      noBody: true
    }
  ],

  // Generate code snippet for an example
  generateCode: function(example) {
    const lines = ['// ' + example.name];
    lines.push('const response = await fetch("' + example.url + '", {');
    lines.push('  method: "' + example.method + '",');
    if (example.headers && Object.keys(example.headers).length > 0) {
      lines.push('  headers: ' + JSON.stringify(example.headers, null, 4).replace(/\n/g, '\n  ') + ',');
    }
    if (!example.noBody && example.body) {
      lines.push('  body: JSON.stringify(' + JSON.stringify(example.body, null, 4).replace(/\n/g, '\n  ') + ')');
    }
    lines.push('});');
    lines.push('const data = await response.json();');
    return lines.join('\n');
  }
};

window.DemoExamples = DemoExamples;
