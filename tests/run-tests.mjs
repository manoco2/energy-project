import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

globalThis.window = globalThis;
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
};
globalThis.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY",
  DEFAULT_WORKSHOP_ID: "tests",
  RESULT_REFRESH_INTERVAL: 5000,
};

await import("../questions.js");
await import("../supabase-client.js");
await import("../pdf-export.js");

const { getApplicableQuestions, calculateScores } = globalThis.EnergyAssessment;
const api = globalThis.AssessmentApi;
const codes = (profile) => getApplicableQuestions(profile).map((question) => question.code);
const base = { S4: 65, S5: 3, S7: 180, S8: "self" };
const expectCodes = (profile, expected, label) => assert.deepEqual(codes({ ...base, ...profile }), expected, label);
const E = ["E1","E2","E3","E4","E5","E6","E7","E8","E9"];

expectCodes({ S1: "apartment", S2: "district", S3: "yes" }, [...E,"H1","H2","H3","H4","H6","H7","H8","H9"], "TEST 1");
expectCodes({ S1: "apartment", S2: "district", S3: "no" }, [...E,"H1","H6","H7","H8","H9"], "TEST 2");
expectCodes({ S1: "house", S2: "individual", S3: "yes" }, [...E,"H1","H2","H3","H4","H5"], "TEST 3");
expectCodes({ S1: "house", S2: "individual", S3: "no" }, [...E,"H1","H5"], "TEST 4");
expectCodes({ S1: "cottage", S2: "district", S3: "yes" }, [...E,"H1","H2","H3","H4"], "TEST 5");
expectCodes({ S1: "house", S2: "unknown", S3: "yes" }, E, "TEST 6");

const makePayload = (workshop, session, answers) => ({
  workshop_id: workshop,
  session_id: session,
  self_rating: 70,
  profile: { ...base, S1: "house", S2: "unknown", S3: "unknown" },
  answers,
});
const perfectAnswers = Object.fromEntries(E.map((code) => [code, 2]));
const perfectScores = { total_score: 100, electricity_awareness_score: 100, electricity_management_score: 100, heating_score: null };

for (let index = 1; index <= 4; index += 1) await api.submitAssessment(makePayload("unlock-test", `00000000-0000-4000-8000-00000000000${index}`, perfectAnswers), perfectScores);
let summary = await api.getGroupSummary("unlock-test");
assert.equal(summary.completed_count, 4, "TEST 7 dalyvių skaičius");
assert.equal(summary.unlocked, false, "TEST 7 rezultatai užrakinti");

await api.submitAssessment(makePayload("unlock-test", "00000000-0000-4000-8000-000000000005", perfectAnswers), perfectScores);
summary = await api.getGroupSummary("unlock-test");
assert.equal(summary.completed_count, 5, "TEST 8 dalyvių skaičius");
assert.equal(summary.unlocked, true, "TEST 8 rezultatai atrakinti");
assert.equal(summary.overall_average, 100, "TEST 8 grupės vidurkis");
assert.equal(summary.self_rating_average, 70, "TEST 8 savęs vertinimo vidurkis procentais");
assert.equal(summary.highest_questions.length, 3, "TEST 8 trys geriausiai įvertinti klausimai");
const comparison = await api.getScorePercentile("unlock-test", 100, "00000000-0000-4000-8000-000000000005");
assert.equal(comparison.consumption_comparison_count, 4, "TEST 8 kitų dalyvių suvartojimo imtis");
assert.equal(comparison.other_per_square_metre, 2.77, "TEST 8 kWh vienam kvadratiniam metrui");
assert.equal(comparison.other_per_household_member, 60, "TEST 8 kWh vienam namų ūkio nariui");
assert.deepEqual(comparison.score_distribution.map((band) => band.count), [0, 0, 0, 0, 5], "TEST 8 grupės balų pasiskirstymas");
const pdfData = globalThis.ResultPdf.createResultData({
  result: perfectScores,
  profile: { ...base, S1: "house", S2: "unknown", S3: "unknown" },
  groupComparison: comparison,
  completedAt: "2026-08-30T10:00:00.000Z",
});
assert.equal(pdfData.categories.length, 2, "TEST 8 PDF kategorijos");
assert.match(pdfData.consumptionRows[0].own, /2,77 kWh\/m²/, "TEST 8 PDF suvartojimas vienam m²");
const minimalPdf = globalThis.ResultPdf.buildPdfFromJpeg(new Uint8Array([255, 216, 255, 217]), 1, 1);
assert.equal(new TextDecoder().decode(minimalPdf.slice(0, 8)), "%PDF-1.4", "TEST 8 PDF antraštė");
const groupPdfData = globalThis.ResultPdf.createGroupResultData({
  summary,
  updatedAt: "2026-08-31T11:52:00.000Z",
  questionByCode: globalThis.EnergyAssessment.questionByCode,
});
assert.equal(groupPdfData.overallAverage, 100, "TEST 8 grupės PDF naudoja snapshot vidurkį");
assert.equal(groupPdfData.selfRatingAverage, 70, "TEST 8 grupės PDF savęs vertinimas procentais");
assert.equal(groupPdfData.highestQuestions.length, 3, "TEST 8 grupės PDF geriausi klausimai");

for (let index = 1; index <= 5; index += 1) {
  const answers = { ...perfectAnswers };
  if (index <= 4) answers.H9 = 0;
  await api.submitAssessment(makePayload("minimum-n-test", `10000000-0000-4000-8000-00000000000${index}`, answers), perfectScores);
}
summary = await api.getGroupSummary("minimum-n-test");
assert.equal(summary.lowest_questions.some((item) => item.question_code === "H9"), false, "TEST 9 H9 neįtraukiamas, kai valid_n=4");

const naAnswers = { ...perfectAnswers, E3: null };
const naScores = calculateScores(getApplicableQuestions({ ...base, S1: "house", S2: "unknown", S3: "unknown" }), naAnswers);
assert.equal(naScores.total_score, 100, "TEST 10 Netaikoma nemažina balo");
assert.equal(naScores.electricity_awareness_score, 100, "TEST 10 kategorijos balas");

const progress = { stage: "questionnaire", questionIndex: 4, answers: { E1: 2, E2: 1 } };
localStorage.setItem("progress-test", JSON.stringify(progress));
assert.deepEqual(JSON.parse(localStorage.getItem("progress-test")), progress, "TEST 11 progresas išlieka");

await api.submitAssessment(makePayload("upsert-test", "20000000-0000-4000-8000-000000000001", perfectAnswers), perfectScores);
await api.submitAssessment(makePayload("upsert-test", "20000000-0000-4000-8000-000000000001", Object.fromEntries(E.map((code) => [code, 0]))), { total_score: 0, electricity_awareness_score: 0, electricity_management_score: 0, heating_score: null });
summary = await api.getGroupSummary("upsert-test");
assert.equal(summary.completed_count, 1, "TEST 12 pakartotinis pateikimas neatkuria antro dalyvio");

assert.equal(globalThis.EnergyAssessment.PROFILE_QUESTIONS.length, 7, "TEST 13 liko septyni situacijos klausimai");
assert.equal(globalThis.EnergyAssessment.PROFILE_QUESTIONS.some((question) => question.code === "S6"), false, "TEST 13 S6 pašalintas");
assert.deepEqual(globalThis.EnergyAssessment.PROFILE_QUESTIONS.find((question) => question.code === "S2").options.map((option) => option.value), ["district", "individual", "unknown"], "TEST 14 vietinė katilinė pašalinta");
assert.equal(globalThis.EnergyAssessment.questionByCode("E3").text, "Peržiūriu savo elektros energijos suvartojimo palyginimą su panašiais objektais, jei energijos tiekėjas tokį pateikia.", "TEST 15 E3 tekstas");

const resultsSource = await fs.readFile(new URL("../results.js", import.meta.url), "utf8");
const appSource = await fs.readFile(new URL("../app.js", import.meta.url), "utf8");
assert.equal(resultsSource.includes("setInterval("), false, "TEST 16 grupės rezultatų ekranas neatnaujinamas periodiškai");
assert.equal(appSource.includes("setInterval("), false, "TEST 16 individualus ekranas neatlieka periodinių API užklausų");
const handlers = new Map();
const root = { innerHTML: "", prepend() {} };
let summaryCalls = 0;
let groupPdfCalls = 0;
const element = (selector) => ({
  disabled: false,
  textContent: "",
  addEventListener: (_event, handler) => handlers.set(selector, handler),
});
const resultsSandbox = {
  window: {
    APP_CONFIG: { DEFAULT_WORKSHOP_ID: "tests" },
    AssessmentApi: {
      getGroupSummary: async () => {
        summaryCalls += 1;
        return { mode: "demo", completed_count: 5, unlocked: false, overall_average: null, self_rating_average: null, lowest_questions: [], highest_questions: [] };
      },
    },
    EnergyAssessment: globalThis.EnergyAssessment,
    ResultPdf: {
      createGroupResultData: (value) => value,
      downloadGroupResultPdf: async () => { groupPdfCalls += 1; },
    },
  },
  document: { querySelector: (selector) => selector === "#results-app" ? root : element(selector) },
  location: { search: "?event=tests" },
  URLSearchParams,
  Date,
  Math,
  Number,
  String,
  Array,
  console,
};
vm.runInNewContext(resultsSource, resultsSandbox);
assert.equal(summaryCalls, 0, "TEST 16 puslapio atidarymas API nekviečia");
await handlers.get("#refresh-results")();
assert.equal(summaryCalls, 1, "TEST 16 mygtukas atlieka vieną API užklausą");
await handlers.get("#download-group-pdf")();
assert.equal(groupPdfCalls, 1, "TEST 16 PDF kuriamas iš turimo snapshot");
assert.equal(summaryCalls, 1, "TEST 16 PDF papildomai API nekviečia");

console.log("16/16 scenarijų patikrinta sėkmingai.");
