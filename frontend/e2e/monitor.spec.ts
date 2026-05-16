import { test, expect } from "@playwright/test";

const API_BASE = process.env.MIRA_E2E_API_BASE || "http://localhost:8000";

const SKIP = !!process.env.PLAYWRIGHT_SKIP_E2E;

test.describe("monitor flow", () => {
  test.skip(SKIP, "PLAYWRIGHT_SKIP_E2E set");

  test("monitor_start produces immediate baseline; view link opens report", async ({ page, request }) => {
    const ticker = "MSFT";

    // Clean slate — best-effort deactivate.
    await request.delete(`${API_BASE}/monitor/${ticker}`).catch(() => {});

    const startRes = await request.post(`${API_BASE}/monitor_start`, {
      data: { ticker, cadence_seconds: 3600, peers: [] },
    });
    expect(startRes.ok()).toBeTruthy();
    const startBody = await startRes.json();
    expect(startBody.initial_job_id, "monitor_start should return initial_job_id").toBeTruthy();

    // Poll status until the baseline job completes.
    const deadline = Date.now() + 120_000;
    let completed = false;
    while (Date.now() < deadline) {
      const s = await request.get(`${API_BASE}/status/${startBody.initial_job_id}`);
      if (s.ok()) {
        const body = await s.json();
        if (body.status === "completed") {
          completed = true;
          break;
        }
        if (body.status === "failed") throw new Error(`baseline job failed: ${body.error}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    expect(completed, "baseline job did not complete in 120s").toBeTruthy();

    await page.goto("/monitor");

    // Row for MSFT exists; price is shown (not "awaiting first tick").
    const row = page.locator(".monitor-row", { hasText: ticker });
    await expect(row).toBeVisible();
    await expect(row.locator(".price")).toBeVisible({ timeout: 30_000 });

    // The "view" link routes to /jobs/<id> and Report.tsx mounts.
    const viewLink = row.getByRole("link", { name: /view/i }).first();
    await expect(viewLink).toBeVisible();
    await viewLink.click();
    await expect(page).toHaveURL(/\/jobs\//);
    await expect(page.locator(".finding").first()).toBeVisible();

    // Cleanup.
    await request.delete(`${API_BASE}/monitor/${ticker}`).catch(() => {});
  });
});
