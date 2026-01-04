import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const editorRoot = path.resolve("public/editor");

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".map")) return "application/json";
  return "text/plain";
}

async function serveEditor(route: any) {
  const requestUrl = new URL(route.request().url());
  let filePath = requestUrl.pathname.replace(/^\/editor/, "");
  if (!filePath || filePath === "/") {
    filePath = "/index.html";
  }

  const fullPath = path.join(editorRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    await route.fulfill({ status: 404, body: "Not found" });
    return;
  }

  const body = fs.readFileSync(fullPath);
  await route.fulfill({
    status: 200,
    contentType: contentTypeFor(fullPath),
    body
  });
}

test.describe("Editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("http://localhost:8765/editor**", serveEditor);
  });

  test("generates code from prompt", async ({ page }) => {
    await page.goto("http://localhost:8765/editor");

    await page.waitForFunction(() => Boolean((window as any).franzai));
    await page.evaluate(() => {
      const mockResponse = {
        candidates: [
          { content: { parts: [{ text: JSON.stringify({
            explanation: "Built a simple hello page.",
            code: "<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello World</h1></body></html>",
            changes: ["Added heading"]
          }) }] } }
        ]
      };

      (window as any).franzai.fetch = async () => {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      };
    });

    await page.fill(".chat-input", "Build a hello world app");
    await page.keyboard.press("Enter");

    const frame = page.frameLocator("iframe.preview-frame");
    await expect(frame.locator("h1")).toHaveText("Hello World");
  });

  test("shows streaming skeleton while waiting", async ({ page }) => {
    await page.goto("http://localhost:8765/editor");

    await page.waitForFunction(() => Boolean((window as any).franzai));
    await page.evaluate(() => {
      (window as any).franzai.fetch = async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const mockResponse = {
          candidates: [
            { content: { parts: [{ text: JSON.stringify({
              explanation: "Delayed response.",
              code: "<!DOCTYPE html><html><head><title>Delayed</title></head><body><h1>Delayed</h1></body></html>"
            }) }] } }
          ]
        };
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      };
    });

    await page.fill(".chat-input", "Make a delayed response" );
    await page.keyboard.press("Enter");

    await expect(page.locator(".typing-dots")).toBeVisible();
    const frame = page.frameLocator("iframe.preview-frame");
    await expect(frame.locator("h1")).toHaveText("Delayed");
  });
});
