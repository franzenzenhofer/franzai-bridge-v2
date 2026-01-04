import { test as baseTest, expect } from "@playwright/test";
import { createServer, type Server } from "http";
import fs from "fs";
import path from "path";
import { withExtension, waitForFranzai, type ExtensionContext } from "./extension-helpers";

const editorRoot = path.resolve("public/editor");

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".map")) return "application/json";
  return "text/plain";
}

// Create a real HTTP server for testing
function startServer(port: number): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let filePath = req.url?.replace(/^\//, "") || "index.html";
      if (filePath === "" || filePath === "/") filePath = "index.html";

      const fullPath = path.join(editorRoot, filePath);
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const body = fs.readFileSync(fullPath);
      res.writeHead(200, { "Content-Type": contentTypeFor(fullPath) });
      res.end(body);
    });
    server.listen(port, () => resolve(server));
  });
}

// Custom test fixture with extension context and server
const test = baseTest.extend<{ ext: ExtensionContext; editorUrl: string }>({
  ext: async ({}, use) => {
    const ext = await withExtension();
    await use(ext);
    await ext.context.close();
    ext.cleanup();
  },
  editorUrl: async ({}, use) => {
    const port = 8765 + Math.floor(Math.random() * 1000);
    const server = await startServer(port);
    await use(`http://localhost:${port}/`);
    server.close();
  }
});

test.describe("Editor with Extension", () => {
  test("generates code from prompt", async ({ ext, editorUrl }) => {
    const page = await ext.context.newPage();
    await page.goto(editorUrl);

    // Wait for page to load and extension to inject franzai
    await page.waitForLoadState("domcontentloaded");
    const hasFranzai = await waitForFranzai(page, 15000);
    expect(hasFranzai).toBe(true);

    // Mock the fetch to return test data
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
    await expect(frame.locator("h1")).toHaveText("Hello World", { timeout: 15000 });
  });

  test("shows streaming skeleton while waiting", async ({ ext, editorUrl }) => {
    const page = await ext.context.newPage();
    await page.goto(editorUrl);

    // Wait for page to load and extension to inject franzai
    await page.waitForLoadState("domcontentloaded");
    const hasFranzai = await waitForFranzai(page, 15000);
    expect(hasFranzai).toBe(true);

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

    await page.fill(".chat-input", "Make a delayed response");
    await page.keyboard.press("Enter");

    await expect(page.locator(".typing-dots")).toBeVisible({ timeout: 5000 });
    const frame = page.frameLocator("iframe.preview-frame");
    await expect(frame.locator("h1")).toHaveText("Delayed", { timeout: 15000 });
  });
});
