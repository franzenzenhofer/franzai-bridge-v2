// Bridge Workbench - Example Request Presets
// Organized by flow type: Injector, CORS, Session

export const EXAMPLES = {
  // Injector Flow - Static API Keys
  injector: [
    {
      id: 'openai',
      name: 'OpenAI',
      keyName: 'openai',
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say hello in one sentence.' }]
      },
      injectedHeader: 'Authorization',
      injectedTemplate: 'Bearer [OPENAI_API_KEY]'
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      keyName: 'anthropic',
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: {
        model: 'claude-haiku-4-20250414',
        max_tokens: 256,
        messages: [{ role: 'user', content: 'Say hello in one sentence.' }]
      },
      injectedHeader: 'x-api-key',
      injectedTemplate: '[ANTHROPIC_API_KEY]'
    },
    {
      id: 'gemini',
      name: 'Gemini',
      keyName: 'google',
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      headers: { 'Content-Type': 'application/json' },
      body: { contents: [{ parts: [{ text: 'Say hello in one sentence.' }] }] },
      injectedHeader: 'x-goog-api-key',
      injectedTemplate: '[GOOGLE_API_KEY]'
    },
    {
      id: 'mistral',
      name: 'Mistral',
      keyName: 'mistral',
      method: 'POST',
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Content-Type': 'application/json' },
      body: {
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: 'Say hello in one sentence.' }]
      },
      injectedHeader: 'Authorization',
      injectedTemplate: 'Bearer [MISTRAL_API_KEY]'
    }
  ],

  // Tunnel Flow - CORS Bypass
  cors: [
    {
      id: 'hackernews',
      name: 'Hacker News',
      method: 'GET',
      url: 'https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty',
      description: 'Fetch top stories'
    },
    {
      id: 'github',
      name: 'GitHub API',
      method: 'GET',
      url: 'https://api.github.com/repos/anthropics/claude-code/commits?per_page=3',
      description: 'Recent commits'
    },
    {
      id: 'jsonplaceholder',
      name: 'JSONPlaceholder',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      description: 'Test REST API'
    },
    {
      id: 'httpbin',
      name: 'HTTPBin',
      method: 'POST',
      url: 'https://httpbin.org/post',
      headers: { 'Content-Type': 'application/json' },
      body: { message: 'Hello from Bridge!', timestamp: new Date().toISOString() },
      description: 'Echo request'
    }
  ],

  // Session Flow - Google OAuth
  session: [
    {
      id: 'google-sites',
      name: 'List Sites',
      method: 'GET',
      url: 'https://www.googleapis.com/webmasters/v3/sites',
      scope: 'webmasters.readonly',
      description: 'Search Console sites'
    },
    {
      id: 'google-analytics',
      name: 'Get Search Analytics',
      method: 'POST',
      url: 'https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query',
      scope: 'webmasters.readonly',
      headers: { 'Content-Type': 'application/json' },
      body: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dimensions: ['query'],
        rowLimit: 10
      },
      description: 'Top queries (7 days)'
    }
  ]
};

export function getExampleById(id) {
  for (const category of Object.values(EXAMPLES)) {
    const found = category.find(ex => ex.id === id);
    if (found) return found;
  }
  return null;
}

export function getFlowType(example) {
  if (EXAMPLES.injector.includes(example)) return 'injector';
  if (EXAMPLES.cors.includes(example)) return 'cors';
  if (EXAMPLES.session.includes(example)) return 'session';
  return 'unknown';
}

window.BridgeExamples = { EXAMPLES, getExampleById, getFlowType };
