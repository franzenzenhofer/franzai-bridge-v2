Here is the final round of the design review, focusing on the **micro-interactions and polish** that separate a "hackathon project" from a tool developers actually love to use.

***

**DevRel:** Alright, we tackled the big rocks (streaming, persistence, error HUD). Now I want to talk about the pebbles in my shoe. The tiny things that drive me crazy after using the editor for an hour.

**10x:** Hit me. I’m looking at `src/editor/main.ts` right now.

**DevRel:** **Input History**.
I treat the Chat input like a terminal. If I press `Arrow Up`, I expect to see my last prompt. Right now, nothing happens. I have to re-type "Make the text larger" five times.

**10x:** Valid. We don't need a database for this.
I'll add a `promptHistory` array to the `ChatPane` local state.
On `keydown`, if `key === 'ArrowUp'` and the input is empty (or cursor at start), we traverse back.
I’ll implement this in `src/editor/components/chat-pane.ts` inside the `input.onkeydown` handler. Simple stack implementation.

**DevRel:** Next: **The "Suggestion Chips"**.
When I clear the chat or start fresh, the empty white box is intimidating. "What do I build?"
We need clickable chips above the input: "ToDo App", "Calculator", "Weather Widget".

**10x:** Easy. We can add a `renderSuggestions()` function in `chat-pane.ts`.
When `state.messages.length === 0`, we render a flex row of buttons.
Clicking one just populates the input and auto-submits.
I'll add these to `src/editor/data/templates.ts` so they aren't hardcoded in the UI component.

**DevRel:** **Clipboard Hygiene**.
In the Chat History, when the AI explains code, it often gives small snippets like:
*"Here is the CSS class you need:"*
```css
.button { background: red; }
```
I need a **Copy Button** on every single code block in the chat stream. Highlighting text with a mouse is so 2010.

**10x:** We're using `marked` for Markdown rendering, right?
We can use a custom renderer. When `marked` encounters a code block, instead of just returning `<pre><code>...</code></pre>`, I’ll wrap it in a `div.code-block-wrapper` with a relative copy button in the top-right corner.
I'll add `src/editor/utils/markdown-renderer.ts` to handle this logic cleanly.

**DevRel:** **The "Open in New Tab" escape hatch**.
The iframe preview is great, but sometimes I need to debug using the *real* Chrome DevTools, not our specific console pane.
I need a button that takes the current `state.code`, creates a Blob URL, and opens it in `_blank`.

**10x:** Essential.
In `src/editor/components/editor-pane.ts`, next to "Download", I’ll add "Pop Out".
```typescript
const blob = new Blob([state.code], { type: 'text/html' });
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
```
*Wait*, there is a catch. If they open it in a new tab, the `window.franzai` bridge needs to work there too.
Since our extension injects into `<all_urls>`, it *should* work on Blob URLs if we set the permission correctly, or we might need to instruct them to save as HTML.
Actually, safer bet: **Download & Open**. But for now, Blob URL is a good "quick look".

**DevRel:** **Status Bar honesty**.
In `src/editor/components/status-bar.ts`, we show "OpenAI" or "Anthropic" keys.
But sometimes keys expire or hit rate limits.
Can we have the status indicator flash red if a request fails with a 401 or 429?

**10x:** Yes. `store.ts` tracks `lastResponse`.
If `lastResponse.status === 401`, I’ll dispatch an event or update a derived state `keyHealth`.
I’ll update `status-bar.ts` to subscribe to `lastResponse`. If it sees a 4xx error on an API domain, it turns that specific provider's dot from Green to Red immediately.

**DevRel:** **Mobile Prevention**.
This is a complex IDE. If someone opens `bridge.franzai.com/editor` on an iPhone, it’s going to look broken.
We should show a polite "Please use a desktop" overlay if `window.innerWidth < 768`.

**10x:** I disagree with blocking them. I'll add a CSS media query to stack the panes vertically instead of horizontally.
It won't be pretty, but it will be usable.
I'll tweak `src/editor/styles/layout.css`:
```css
@media (max-width: 768px) {
  .workbench { flex-direction: column; }
  .chat-pane { width: 100%; height: 40%; }
  .editor-pane { width: 100%; height: 60%; }
}
```
"Don't block, just stack."

**DevRel:** Fair enough. One last "delight" feature.
**The Favicon**.
When I'm building "Space Invaders", I want the browser tab to say "Space Invaders", not "Bridge AI IDE".
Can we parse the `<title>` tag from `state.code` and update the actual document title?

**10x:** That’s clever.
In `src/editor/state/store.ts`, inside the `pushHistory` (where we save code):
```typescript
const titleMatch = code.match(/<title>(.*?)<\/title>/);
if (titleMatch) {
  document.title = `${titleMatch[1]} - Bridge`;
}
```
Simple Regex. High impact. I’ll add it.

**DevRel:** Awesome. This list of "small things" is what makes people tweet about a tool.

1.  **Chat:** Arrow key history + Suggestion Chips.
2.  **Code:** Copy buttons on markdown snippets.
3.  **Preview:** "Pop Out" to new tab.
4.  **Feedback:** Status bar reacts to API errors.
5.  **Layout:** Responsive stacking.
6.  **Meta:** Dynamic document title.

**10x:** I'll implement these as a "Polish Pass" after the Streaming refactor is merged. The codebase is clean enough to handle these without spaghettification. Let's ship.