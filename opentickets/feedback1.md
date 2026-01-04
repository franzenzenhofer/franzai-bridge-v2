Here is a transcript of a high-bandwidth design review between **DevRel (The Advocate)** and **10x (The Lead Engineer)**.

***

**DevRel:** Alright, I’ve been playing with the `public/editor/` build. It’s cool—being able to build apps directly in the browser using the extension’s keys is magic. But... it feels *heavy*. When I ask for a complex app, I stare at a "Generating..." spinner for 20 seconds, and then BAM, a wall of code hits me. It doesn't feel like *AI*. It feels like a slow HTTP request.

**10x:** That’s because it *is* a slow HTTP request. Look at `src/editor/services/ai-client.ts`. We’re lying to the user.

```typescript
// src/editor/services/ai-client.ts
export async function streamChat(...) {
  try {
    const result = await chat(model, messages, systemPrompt); // &lt;-- BLOCKS until 100% done
    onChunk(JSON.stringify(result)); // &lt;-- Fakes a single "chunk"
    onDone();
  } ...
}
```

**DevRel:** Exactly! We need that dopamine hit. I want to see the `<!DOCTYPE html>` appearing before the AI has even thought about the closing `</html>`.

**10x:** The bottleneck isn't the editor; it's the Bridge itself. I was looking at `streaming-support.md`. The extension background worker buffers everything because `chrome.runtime.sendMessage` is atomic.

**DevRel:** So we're stuck?

**10x:** No. We implement the "Phase 2" architecture from that doc. We open a long-lived Port (`chrome.runtime.connect`). Then we pipe the `ReadableStream` from the fetch API directly into port messages.
1.  **Background:** Reads 64KB chunks.
2.  **Port:** Sends `{ type: 'STREAM_CHUNK', bytes: [...] }`.
3.  **Editor:** `ai-client.ts` stops waiting for `await response.json()` and starts listening to the stream.

**DevRel:** If we do that, we can parse the JSON *incrementally*. There are libraries that can parse partial JSON. So as the `code` property fills up in the JSON response, we pump that directly into CodeMirror.

**10x:** Keep it simpler. We tell the AI to *not* use JSON for the code block. We tell it: "Stream your explanation, then print a delimiter `---CODE-START---`, then raw HTML, then `---CODE-END---`".
Parsing partial JSON is a nightmare. Parsing a raw stream of characters into the editor? That’s O(1) complexity.

**DevRel:** I love it. Okay, next pain point: **Persistence**. I refreshed my tab by accident and lost my "Flappy Bird clone" that took 10 prompts to perfect. I almost threw my laptop.

**10x:** Unacceptable. We have `src/editor/state/store.ts`. It’s just sitting there in memory.

**DevRel:** Can we just dump `EditorState` to `localStorage`?

**10x:** Not the whole thing. We don't want to serialize `lastRequest` or `lastResponse`—that’s massive telemetry data. We definitely don't want `isStreaming`.
We need a `saveProject()` middleware in `store.ts`.

```typescript
// src/editor/state/store.ts
function saveToLocal() {
  const { code, history, messages, projectName } = state;
  localStorage.setItem('bridge_current_project', JSON.stringify({
    code, history, messages, projectName, timestamp: Date.now()
  }));
}
```

**DevRel:** And we should autosave on every "Assistant" message received.

**10x:** No, autosave on *every state change* debounced by 1000ms. If you type one character in the editor, I want that saved. If the browser crashes, you lose nothing.

**DevRel:** Nice. Now, let’s talk about the **Prompt Engineering**. `src/editor/services/ai-context.ts` is... polite.

**10x:** It's weak.
```typescript
// Current
return `You are an AI coding assistant... Return the COMPLETE HTML file...`
```

**DevRel:** It’s too generic. The apps look like 1995 web pages. Times New Roman everywhere.

**10x:** We need to bake in a "Design System" into the system prompt.
"Unless specified otherwise, use this CSS for a modern look: `body { font-family: system-ui; }`, use a CSS reset, use Flexbox for layout."
Actually, better idea: We inject a hidden `<style>` block with a lightweight CSS framework (like a minified `pico.css` or our own variables from `variables.css`) into the preview iframe *before* the user's code runs.

**DevRel:** Wait, if we inject CSS, the AI might fight it.

**10x:** Not if we tell the AI "A default stylesheet is pre-loaded. Use semantic HTML (`<main>`, `<article>`, `<header>`) and it will automatically look good."
This makes the *building experience* faster because the AI writes less CSS boilerplate.

**DevRel:** Okay, what about **Safety**? Right now, if the AI writes `while(true) {}`, the preview iframe freezes the whole editor because they share the main thread (even though it's an iframe, it's same-origin in some contexts or just heavy).

**10x:** `src/editor/components/editor-pane.ts` uses `previewFrame.srcdoc = code`. That's synchronous.
We should move the preview to a Blob URL or a separate `preview.html` file that communicates via `postMessage`.
AND, we inject a "Loop Protector" script. A Babel transform that adds a counter to every `while` and `for` loop. If it hits 10,000 iterations in 16ms, it throws an error.

**DevRel:** That sounds like over-engineering for a v1.

**10x:** Fine. V1 solution: A "Kill Preview" button that forces the iframe to reload `about:blank`. Right now, if the preview hangs, you have to refresh the whole IDE.

**DevRel:** Deal. One last thing. **The "Blank Page" Syndrome**.
Users open the editor and see... nothing. `src/editor/data/templates.ts` has "Blank" and "Chat Widget".

**10x:** Boring. We should prompt the user immediately: "What do you want to build?"
But better yet—let's add a **"Fork this"** feature.
Since the `EditorState` is simple JSON, we can allow importing via URL parameters.
`bridge.franzai.com/editor?prompt=Space+Invaders+Game`.
The editor boots up, sees the param, and *immediately* fires the prompt to the AI. You send a link to a friend, they click it, and watch the app build itself.

**DevRel:** That is viral gold. I can share "Build links" on Twitter.

**10x:** Let's execute. Here is the prioritized refactor plan:

1.  **Persistence (P0):** Modify `src/editor/state/store.ts` to hydrate from `localStorage` on boot and debounce save on change.
2.  **Streaming (P1):** This is the heavy lift.
    *   Update `src/shared/messages.ts` with `STREAM_CHUNK`.
    *   Update `src/background/fetch/handler.ts` to push to a Port instead of returning a Promise.
    *   Rewrite `src/editor/services/ai-client.ts` to consume the stream.
3.  **UI Polish (P2):**
    *   Update `src/editor/services/ai-context.ts` with "System Prompt V2" (Modern CSS defaults).
    *   Add "Kill Preview" button to `src/editor/components/editor-pane.ts`.

**DevRel:** Let's go make this the best AI prototyping tool on the web.

**10x:** Agreed. I'll handle the Bridge streaming plumbing; you fix the prompts and the UI state management. Break.