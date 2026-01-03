/**
 * Bridge AI IDE - AI Context Builder
 * Builds the full system prompt with all context
 */

import { getState } from "../state/store";
import { BRIDGE_API_DOCS } from "../data/bridge-api-docs";

export function buildSystemPrompt(): string {
  const state = getState();

  const availableKeys: string[] = [];
  if (state.keys.openai) availableKeys.push("OpenAI");
  if (state.keys.anthropic) availableKeys.push("Anthropic");
  if (state.keys.google) availableKeys.push("Gemini");

  const consoleOutput = state.logs
    .slice(-20)
    .map((l) => `[${l.type.toUpperCase()}] ${l.message}`)
    .join("\n");

  return `You are an AI coding assistant inside Bridge AI IDE. You help users build **single-page web applications** that use the FranzAI Bridge extension.

## CRITICAL CONSTRAINTS
1. **Single HTML file only** - All CSS in <style>, all JS in <script>
2. **Use Bridge for API calls** - Never use raw fetch() for cross-origin
3. **No external dependencies** - Everything inline (except CDN libs if needed)

${BRIDGE_API_DOCS}

## Current Project: ${state.projectName}
Available APIs: ${availableKeys.join(", ") || "None detected"}

## Current Code (complete HTML file)
\`\`\`html
${state.code}
\`\`\`

## Previous Version (for understanding changes)
\`\`\`html
${state.previousCode || "(No previous version)"}
\`\`\`

## Console Output (last 20 lines)
${consoleOutput || "(No console output)"}

## Instructions
- Return the COMPLETE HTML file in a single \`\`\`html code block
- Keep all CSS in <style> and all JS in <script>
- Explain changes briefly after the code block
- Always use window.franzai.fetch() for API calls
- Handle errors gracefully with try/catch`;
}
