Here is the strategy session between **DevRel** and **10x** regarding robust testing and high-fidelity UI feedback (animations).

***

**DevRel:** Okay, we’re building a complex IDE inside a browser extension. If this breaks, I can't just tell users "refresh the page." We need a bulletproof testing strategy.
Also, the app needs to feel *alive*. Right now, it's just text appearing. I want animations that tell the user exactly what's happening without them reading a status bar.

**10x:** Agreed. Reliability and "Juice" (game feel). Let’s tackle Testing first. We need a split strategy: **Vitest for Logic** and **Playwright for the Full Experience**.

---

### Phase 1: The Testing Strategy

#### 1. Unit Testing (Vitest)
**10x:** We don't need to unit test the DOM. That's slow and brittle. We unit test the *brains*.
We need to rigorously test `src/editor/state/store.ts` and `src/editor/services/ai-client.ts`.

*   **State Management:** Verify that `pushHistory`, `undo`, and `redo` actually work. If a user loses code because our undo stack is broken, they churn.
*   **Prompt Engineering:** Test `ai-context.ts`. We should have a snapshot test for the `buildSystemPrompt()` function to ensure we don't accidentally drop the "Use System UI font" instruction during a refactor.

**DevRel:** What about the Extension API? `chrome.runtime` doesn't exist in Vitest.

**10x:** We mock it. We already have `vi.stubGlobal("chrome", ...)` in `tests/storage.test.ts`. We extend that pattern.
We create a `tests/editor/store.test.ts` that simulates a full chat session purely in data structures, ensuring the state transitions are correct.

#### 2. E2E Testing (Playwright)
**DevRel:** This is the hard part. How do we test the AI? We can't pay for OpenAI tokens on every CI run, and the output is non-deterministic.

**10x:** We **mock the AI** at the network layer.
Playwright has `page.route()`. We intercept requests to `api.openai.com` and return a **controlled stream**.

```typescript
// e2e/editor-flow.spec.ts
test('Editor generates code from prompt', async ({ page }) => {
  // 1. Mock OpenAI Stream
  await page.route('**/chat/completions', async route => {
    const json = {
      choices: [{ message: { content: '```html\n<h1>Hello World</h1>\n```' } }]
    };
    await route.fulfill({ json });
  });

  // 2. Load Editor with Extension
  // (We reuse your existing extension-helpers.ts)
  
  // 3. User interaction
  await page.click('#chat-input');
  await page.keyboard.type('Build a hello world app');
  await page.keyboard.press('Enter');

  // 4. Verification
  // Check if the iframe updated
  const iframe = page.frameLocator('#preview-frame');
  await expect(iframe.locator('h1')).toHaveText('Hello World');
});
```

**DevRel:** Smart. We test the *plumbing*, not the *intelligence*.
What about **Streaming Tests**?

**10x:** We can simulate network delay in Playwright!
We can make the mock response take 2 seconds to "stream" chunks. This ensures our UI handles the "Generating..." state correctly and doesn't unlock the input box too early.

---

### Phase 2: Animations & Direct Feedback (The "Juice")

**DevRel:** Okay, testing is solid. Now, **Animations**.
I want the user to *feel* the data moving.
When the AI finishes writing code, and we update the Preview... it just snaps. It’s jarring.

**10x:** We need a **"Hot Swap" Flash**.
When `updatePreview()` runs in `editor-pane.ts`, we trigger a CSS animation on the container.

```css
/* src/editor/styles/animations.css */
@keyframes flash-update {
  0% { opacity: 0.7; filter: blur(2px); }
  100% { opacity: 1; filter: blur(0); }
}

.preview-container.updating {
  animation: flash-update 0.3s ease-out;
  border: 1px solid var(--accent); /* Subtle border flash */
}
```

**10x:** In the code:
1.  Add `.updating` class to `preview-container`.
2.  Update iframe `srcdoc`.
3.  Remove class after 300ms.
This tells the brain: "Something changed here."

**DevRel:** Nice. What about the **Chat Stream**?
When text is streaming in, it needs to autoscroll, but it should feel like a typewriter.

**10x:** We can add a **Cursor Pulse**.
In `chat-pane.ts`, while `state.isStreaming` is true, we append a fake cursor element `▍` to the end of the last message content.
CSS: `animation: blink 1s step-end infinite`.
When streaming stops, we remove it. It’s purely visual but makes it feel like the AI is "typing" live.

**DevRel:** **Input Actions**.
When I send a message, the message shouldn't just "appear" in the list. It should slide up from the bottom.

**10x:** Standard list transition.
```css
.message {
  animation: slide-in 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}
@keyframes slide-in {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```
This makes the conversation feel fluid.

**DevRel:** One specific interaction: **Applying Code**.
If I click "Undo" or "Redo", I want to see the code pane *slide* to the left or right, representing time travel.

**10x:** That’s tricky with CodeMirror, but we can animate the *container* opacity.
On Undo: `opacity: 0.5` -> `opacity: 1`.
It’s cheaper than a slide (which causes layout trashing) but gives immediate feedback that the state changed.

**DevRel:** Finally: **The "Busy" State**.
When the AI is thinking (before the first token arrives), the user panics. "Did it freeze?"
The status bar isn't enough.

**10x:** We need an **Indeterminate Progress Bar** right at the top of the chat pane, or a "Skeleton Loader" bubble.
Actually, the Skeleton Bubble is best.
1.  User sends message.
2.  Immediate append of a gray "Assistant" bubble containing 3 bouncing dots.
3.  When the first token arrives, replace the dots with the text.
This lowers perceived latency to zero.

---

### Implementation Plan

**DevRel:** Okay, here is the checklist for the next sprint.

**Testing:**
1.  [ ] **Unit:** Mock `chrome` global in Vitest setup. Test `store.ts` history logic (push/undo/redo).
2.  [ ] **E2E:** Create `e2e/editor.spec.ts`.
3.  [ ] **E2E:** Implement `mockOpenAIResponse` helper in Playwright to simulate streaming JSON.

**UX/Animations:**
1.  [ ] **Styles:** Create `src/editor/styles/animations.css`.
2.  [ ] **Chat:** Add "Skeleton Bubble" for loading state (0ms latency feedback).
3.  [ ] **Chat:** Add "Typewriter Cursor" during streaming.
4.  [ ] **Preview:** Add "Flash" animation when `srcdoc` updates.
5.  [ ] **Transitions:** Add CSS keyframes for message entry (`slide-in`).

**10x:** I'll set up the E2E harness first. If we can't verify the streaming logic automatically, the animations are just lipstick on a pig. I'll get the Playwright route interception working today.

**DevRel:** Perfect. I'll write the CSS keyframes. Let's make this thing buttery smooth.