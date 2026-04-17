/**
 * E2E Demo: open_chat app — headed, slowMo: 800
 *
 * Journey:
 *  1. Navigate to http://localhost:3002 → redirects to /chat
 *  2. Click "New chat"
 *  3. Switch to "Browser (lite)" tab in model picker
 *  4. Select the first model (SmolLM2 360M)
 *  5. Click "Download & use" and wait for model to load
 *  6. Send two messages and observe AI responses
 *  7. Hover over AI response to reveal copy button, click it
 *  8. Take a final screenshot
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:3002";
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const MODEL_LOAD_TIMEOUT = 5 * 60 * 1000; // 5 minutes — model may need to download
const RESPONSE_TIMEOUT = 3 * 60 * 1000;   // 3 minutes — on-device inference can be slow

(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 800,
    args: [
      "--enable-features=WebGPU,WebGPUDeveloperFeatures",
      "--enable-unsafe-webgpu",
      "--enable-dawn-features=allow_unsafe_apis",
      // Allow SharedArrayBuffer and WASM threads (needed by TransformersJS)
      "--enable-features=SharedArrayBuffer",
      "--disable-web-security",
      "--allow-running-insecure-content",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Capture console errors for debugging
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Error] ${msg.text()}`);
    }
  });

  try {
    // ── Step 1: Navigate to the app ───────────────────────────────────────────
    console.log("Step 1: Navigating to http://localhost:3002 ...");
    // Use "domcontentloaded" to avoid timing out on background 404s (service worker, etc.)
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // The root page redirects to /chat — wait for that
    await page.waitForURL((url) => url.pathname.startsWith("/chat"), { timeout: 15_000 });
    console.log(`  → URL is now: ${page.url()}`);

    // Wait for the page to fully hydrate (sidebar + main content visible)
    await page.waitForLoadState("domcontentloaded");
    await new Promise((r) => setTimeout(r, 1500)); // allow React hydration

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-landing.png") });

    // ── Step 2: Click "New chat" ──────────────────────────────────────────────
    console.log("Step 2: Clicking 'New chat' button ...");
    // There are two "New chat" buttons — one in the sidebar (aside) and one in main.
    // Click the sidebar one (inside the <aside> element) for a clean interaction.
    const sidebarNewChatBtn = page.locator("aside").getByRole("button", { name: "New chat" });
    await sidebarNewChatBtn.waitFor({ state: "visible", timeout: 10_000 });
    await sidebarNewChatBtn.click();

    // Wait for navigation to a chat page — URL changes to /chat/{id}
    // The backend may be unreachable so the app uses a local fallback UUID.
    // Wait for the model picker or main chat area to appear instead.
    await page.waitForFunction(
      () => window.location.pathname.match(/\/chat\/.+/),
      null,
      { timeout: 15_000, polling: 500 }
    );
    console.log(`  → URL is now: ${page.url()}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-new-chat.png") });

    // ── Step 3: Model picker — switch to "Browser (lite)" tab ─────────────────
    console.log("Step 3: Model picker opened. Looking for 'Browser (lite)' tab ...");

    // Wait for model picker heading
    await page.getByText("Choose a model").waitFor({ state: "visible", timeout: 10_000 });

    // Check which tab is currently active (default is "Cloud")
    // Click "Browser (lite)" tab
    const browserLiteTab = page.getByRole("button", { name: "Browser (lite)" });
    await browserLiteTab.waitFor({ state: "visible", timeout: 10_000 });
    await browserLiteTab.click();
    console.log("  → Clicked 'Browser (lite)' tab");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-browser-lite-tab.png") });

    // ── Step 4: Select the first available model (SmolLM2 360M) ───────────────
    console.log("Step 4: Selecting the first on-device model ...");

    // The transformers models are rendered as buttons inside the model list.
    // Find the first non-disabled model row — SmolLM2 360M should appear first.
    // We target the model name text inside the list area.
    const modelList = page.locator(".overflow-y-auto.max-h-64");
    await modelList.waitFor({ state: "visible", timeout: 10_000 });

    // Try SmolLM2 360M first, then fall back to any available model button
    let modelButton = page.getByText("SmolLM2 360M").first();
    const smolExists = await modelButton.isVisible().catch(() => false);

    if (!smolExists) {
      console.log("  SmolLM2 360M not found by text, falling back to first model button ...");
      modelButton = modelList.locator("button").first();
    }

    await modelButton.scrollIntoViewIfNeeded();
    await modelButton.click();
    console.log("  → Model selected");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-model-selected.png") });

    // ── Step 5: Click "Download & use" / "Use" button ─────────────────────────
    console.log("Step 5: Clicking Download & use button ...");

    // The CTA button label changes based on whether the model is cached.
    // Look for a button containing "Download" or "Use" at the bottom of the card.
    const ctaButton = page.locator("button").filter({
      hasText: /Download & use|Use SmolLM|Use Qwen/i,
    }).first();

    await ctaButton.waitFor({ state: "visible", timeout: 10_000 });
    console.log(`  → CTA button text: "${await ctaButton.textContent()}"`);
    await ctaButton.click();

    // Wait for model to finish loading (progress bar disappears, no more % text)
    console.log("  → Waiting for model to load (may take a while if downloading) ...");

    // The loading state shows a progress bar; when done, the ModelPickerScreen
    // returns null (modelReady=true) and the chat input becomes available.
    await page.waitForFunction(
      () => {
        // Check that the model picker is gone — the "Choose a model" heading disappears
        const headings = Array.from(document.querySelectorAll("h2"));
        return !headings.some((h) => h.textContent?.includes("Choose a model"));
      },
      null,  // arg (unused)
      { timeout: MODEL_LOAD_TIMEOUT, polling: 3000 }
    );

    console.log("  → Model is ready!");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-model-ready.png") });

    // ── Step 6: Send first message ─────────────────────────────────────────────
    console.log("Step 6: Sending first message ...");

    const textarea = page.locator("textarea").first();
    await textarea.waitFor({ state: "visible", timeout: 10_000 });
    await textarea.click();
    await textarea.fill("Hello! What can you help me with today?");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-message-typed.png") });

    await textarea.press("Enter");
    console.log("  → Message sent, waiting for AI response ...");

    // The textarea becomes disabled while the AI is generating ("Waiting for response...").
    // Wait for it to become enabled again — that means generation finished.
    await textarea.waitFor({ state: "visible", timeout: RESPONSE_TIMEOUT });
    await page.waitForFunction(
      () => {
        const ta = document.querySelector("textarea");
        return ta && !ta.disabled;
      },
      null,
      { timeout: RESPONSE_TIMEOUT, polling: 1000 }
    );

    console.log("  → AI responded to first message!");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-first-response.png") });

    // ── Step 7: Send second message ───────────────────────────────────────────
    console.log("Step 7: Sending second message ...");

    // Small pause so the user can see the response
    await new Promise((r) => setTimeout(r, 1000));
    await textarea.click();
    await textarea.fill("Can you write a short poem about the ocean?");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-second-message-typed.png") });

    await textarea.press("Enter");
    console.log("  → Second message sent, waiting for AI to start generating ...");

    // Wait for streaming to START (textarea becomes disabled)
    await page.waitForFunction(
      () => {
        const ta = document.querySelector("textarea");
        return ta && ta.disabled;
      },
      null,
      { timeout: 30_000, polling: 500 }
    );

    // Wait up to 45 seconds for some content, then proceed regardless.
    // Small models can loop but will still produce visible output.
    const streamingTimeout = 45_000;
    await new Promise((r) => setTimeout(r, streamingTimeout));

    // Take screenshot of the current conversation state (mid-stream is fine)
    console.log("  → Taking screenshot of conversation with second response ...");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-second-response.png") });

    // ── Step 8: Hover over FIRST AI message to reveal copy button ─────────────
    // The first AI response is always complete. The copy button lives on completed
    // MessageBubble components (not on the streaming bubble which has no copy btn).
    console.log("Step 8: Hovering over the first AI message to reveal copy button ...");

    // Scroll to top to find the first AI response
    await page.keyboard.press("Home");
    await new Promise((r) => setTimeout(r, 500));

    // The AI message bubbles have class "group" and show copy button on hover.
    const aiMessageGroups = page.locator(".group.flex.items-start");

    // Wait for at least one AI message group to exist
    await aiMessageGroups.first().waitFor({ state: "visible", timeout: 10_000 });

    const count = await aiMessageGroups.count();
    console.log(`  → Found ${count} message group(s)`);

    // Find the FIRST completed AI message (copy button is only on completed messages)
    let firstAiGroup = null;
    for (let i = 0; i < count; i++) {
      const group = aiMessageGroups.nth(i);
      const classes = await group.getAttribute("class");
      // AI messages use flex-row (not flex-row-reverse which is user messages)
      if (classes && !classes.includes("flex-row-reverse")) {
        firstAiGroup = group;
        break;
      }
    }

    if (!firstAiGroup) {
      console.log("  WARNING: Could not find first AI message group");
      firstAiGroup = aiMessageGroups.first();
    }

    await firstAiGroup.scrollIntoViewIfNeeded();
    await new Promise((r) => setTimeout(r, 800));
    await firstAiGroup.hover();
    console.log("  → Hovering over first AI message");

    // Wait for copy button to become visible (opacity: 0 → 1 transition)
    const copyButton = firstAiGroup.getByRole("button", { name: /copy/i });
    await copyButton.waitFor({ state: "visible", timeout: 5_000 });

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10-copy-button-visible.png") });

    // ── Step 9: Click the copy button ─────────────────────────────────────────
    console.log("Step 9: Clicking the copy button ...");
    await copyButton.click();

    // Wait for "Copied" confirmation to appear
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.some((b) => b.textContent?.includes("Copied"));
      },
      null,
      { timeout: 5_000, polling: 500 }
    );

    console.log("  → Copy button clicked, 'Copied' confirmation visible!");

    // ── Step 10: Final screenshot ──────────────────────────────────────────────
    console.log("Step 10: Taking final screenshot of the conversation ...");
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "11-final-conversation.png"),
      fullPage: false,
    });

    console.log("\n=== ALL STEPS COMPLETED SUCCESSFULLY ===");
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

    // Keep browser open for a few seconds so the user can see the final state
    await new Promise((r) => setTimeout(r, 4000));

  } catch (err) {
    console.error("\n=== TEST FAILED ===");
    console.error(err);

    // Capture failure screenshot
    try {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "FAILURE.png"),
        fullPage: true,
      });
      console.log(`Failure screenshot saved to: ${SCREENSHOT_DIR}/FAILURE.png`);
    } catch {
      // ignore screenshot error
    }

    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
