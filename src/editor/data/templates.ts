/**
 * Bridge AI IDE - Starter Templates
 */

export interface Template {
  name: string;
  description: string;
  code: string;
}

export const TEMPLATES: Template[] = [
  {
    name: "Blank",
    description: "Empty HTML document",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 20px;
    }
  </style>
</head>
<body>
  <h1>Hello World</h1>

  <script>
    console.log("Ready!");
  </script>
</body>
</html>`
  },
  {
    name: "Chat Widget",
    description: "AI chat widget using Bridge",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Chat</title>
  <style>
    body {
      font-family: -apple-system, sans-serif;
      max-width: 600px;
      margin: 40px auto;
      padding: 20px;
    }
    .chat { border: 1px solid #ddd; border-radius: 8px; padding: 16px; min-height: 300px; margin-bottom: 16px; }
    .message { margin: 8px 0; padding: 8px 12px; border-radius: 6px; }
    .user { background: #e3f2fd; margin-left: 40px; }
    .assistant { background: #f5f5f5; margin-right: 40px; }
    .input-row { display: flex; gap: 8px; }
    input { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 6px; }
    button { padding: 12px 24px; background: #1a73e8; color: white; border: none; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>AI Chat</h1>
  <div class="chat" id="chat"></div>
  <div class="input-row">
    <input type="text" id="input" placeholder="Type a message...">
    <button onclick="send()">Send</button>
  </div>

  <script>
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');

    function addMessage(role, content) {
      const div = document.createElement('div');
      div.className = 'message ' + role;
      div.textContent = content;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }

    async function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      addMessage('user', text);

      try {
        const response = await window.franzai.fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: text }]
          })
        });
        const data = await response.json();
        addMessage('assistant', data.choices[0].message.content);
      } catch (err) {
        addMessage('assistant', 'Error: ' + err.message);
      }
    }

    input.addEventListener('keypress', e => { if (e.key === 'Enter') send(); });
  </script>
</body>
</html>`
  }
];
