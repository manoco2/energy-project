import { chromium } from "file:///C:/Users/Pipirai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { mkdir } from "node:fs/promises";

const outputPath = "C:/Users/Pipirai/Desktop/Energy game/output/pdf/LEA-rezultato-korteles-pavyzdys.pdf";
await mkdir("C:/Users/Pipirai/Desktop/Energy game/output/pdf", { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ acceptDownloads: true });
await page.route("https://klzmbmmlkwrfehfmeceh.supabase.co/**", (route) => route.abort());
await page.goto("http://127.0.0.1:4173/index.html?event=pdf-perziura", { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  const sessionId = "90000000-0000-4000-8000-000000000001";
  localStorage.setItem("lea-awareness-session-id", sessionId);
  localStorage.setItem("lea-awareness-progress:pdf-perziura", JSON.stringify({
    version: 3,
    workshopId: "pdf-perziura",
    sessionId,
    stage: "result",
    selfRating: 61,
    profile: { S1: "house", S2: "individual", S3: "yes", S4: 65, S5: 3, S7: 180, S8: "self" },
    profileIndex: 6,
    applicableCodes: ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "H1", "H2", "H3", "H4", "H5"],
    questionIndex: 13,
    answers: {},
    result: { total_score: 72, electricity_awareness_score: 76, electricity_management_score: 69, heating_score: 70 },
    completedAt: "2026-08-31T12:00:00.000Z",
    submissionStatus: "sent",
    submissionError: "",
    pendingSubmission: null,
    groupComparison: {
      unlocked: true,
      completed_count: 28,
      group_average: 64,
      percentile: 68,
      score_distribution: [
        { label: "0–20", count: 1 },
        { label: "21–40", count: 4 },
        { label: "41–60", count: 7 },
        { label: "61–80", count: 12 },
        { label: "81–100", count: 4 }
      ],
      consumption_comparison_count: 22,
      other_per_square_metre: 2.35,
      other_per_household_member: 54.2
    }
  }));
});
await page.reload({ waitUntil: "domcontentloaded" });
const downloadPromise = page.waitForEvent("download");
await page.locator("#download-pdf-button").click();
const download = await downloadPromise;
await download.saveAs(outputPath);
await browser.close();
console.log(outputPath);
