(function () {
  const { PROFILE_QUESTIONS, CATEGORIES, getApplicableQuestions, calculateScores } = window.EnergyAssessment;
  const api = window.AssessmentApi;
  const config = window.APP_CONFIG;
  const app = document.querySelector("#app");
  const SESSION_KEY = "lea-awareness-session-id";
  const STATE_VERSION = 3;

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function makeUuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
  }

  function getSessionId() {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = makeUuid();
    localStorage.setItem(SESSION_KEY, created);
    return created;
  }

  function resolveWorkshopId() {
    const fromUrl = new URLSearchParams(location.search).get("event");
    const candidate = (fromUrl || config.DEFAULT_WORKSHOP_ID || "mokymai").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(candidate) ? candidate : "mokymai";
  }

  const workshopId = resolveWorkshopId();
  const STATE_KEY = `lea-awareness-progress:${workshopId}`;

  function freshState() {
    return {
      version: STATE_VERSION,
      workshopId,
      sessionId: getSessionId(),
      stage: "welcome",
      selfRating: null,
      profile: {},
      profileIndex: 0,
      applicableCodes: [],
      questionIndex: 0,
      answers: {},
      result: null,
      completedAt: null,
      submissionStatus: "idle",
      submissionError: "",
      pendingSubmission: null,
      groupComparison: null,
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_KEY));
      if (saved?.version === STATE_VERSION && saved.workshopId === workshopId && saved.sessionId === getSessionId()) return { ...freshState(), ...saved };
    } catch { /* Pradedama nauja būsena. */ }
    return freshState();
  }

  let state = loadState();
  const save = () => localStorage.setItem(STATE_KEY, JSON.stringify(state));
  const applicableQuestions = () => state.applicableCodes.map((code) => window.EnergyAssessment.questionByCode(code)).filter(Boolean);

  function brandHeader() {
    return `<header class="brand-line compact-brand"><img src="images/LEA-LOGOTIPAS-ŽALIAS.png" alt="Lietuvos energetikos agentūra" /></header>`;
  }

  function flowHeader(label, current, total) {
    const percentage = total ? Math.round((current / total) * 100) : 0;
    return `${brandHeader()}<div class="flow-meta"><span>${escapeHtml(label)}</span><strong>${current} / ${total}</strong></div>
      <div class="progress-track" aria-hidden="true"><span style="width:${percentage}%"></span></div>`;
  }

  function renderWelcome() {
    app.innerHTML = `<section class="welcome-panel" aria-labelledby="welcome-title">
      ${brandHeader()}
      <div class="welcome-visual" aria-hidden="true"><span class="energy-mark">⚡</span><i class="orbit orbit-one"></i><i class="orbit orbit-two"></i></div>
      <p class="eyebrow">3–5 min. · Anonimiška</p>
      <h1 id="welcome-title">Energijos vartojimo sąmoningumo testas</h1>
      <p class="lead">Kaip gerai pažįstate ir valdote savo energijos vartojimą namuose?</p>
      <p class="supporting-copy">Atsakykite į kelis trumpus klausimus ir palyginkite savo rezultatą su kitais mokymų dalyviais.</p>
      <button class="primary-button" id="start-button" type="button">Pradėti <span aria-hidden="true">→</span></button>
    </section>`;
    document.querySelector("#start-button").addEventListener("click", () => { state.stage = "self-rating"; save(); render(); });
  }

  function renderSelfRating() {
    if (state.selfRating === null) {
      state.selfRating = 50;
      save();
    }
    app.innerHTML = `<section class="test-panel">
      ${flowHeader("Trumpas įsivertinimas", 1, 1)}
      <div class="question-icon" aria-hidden="true">◒</div>
      <p class="eyebrow">Prieš pradedant</p>
      <h1 class="question-title">Kaip pats (-i) įvertintumėte savo energijos vartojimo sąmoningumą?</h1>
      <div class="selected-rating" aria-live="polite">Pasirinkta: <strong id="self-rating-value">${state.selfRating} %</strong></div>
      <div class="rating-slider-wrap">
        <input class="rating-slider" id="self-rating" type="range" min="0" max="100" step="1" value="${state.selfRating}" aria-label="Energijos vartojimo sąmoningumo įvertinimas procentais" />
      </div>
      <div class="scale-labels"><span>0 % · Labai žemas</span><span>100 % · Labai aukštas</span></div>
      <button class="primary-button" id="self-next" type="button">Toliau <span aria-hidden="true">→</span></button>
      <p class="context-note">Šis įsivertinimas į testo balą neįtraukiamas.</p>
    </section>`;
    document.querySelector("#self-rating").addEventListener("input", (event) => {
      state.selfRating = Number(event.target.value);
      document.querySelector("#self-rating-value").textContent = `${state.selfRating} %`;
      save();
    });
    document.querySelector("#self-next").addEventListener("click", () => { state.stage = "profile"; state.profileIndex = 0; save(); render(); });
  }

  function goToNextProfileQuestion() {
    if (state.profileIndex < PROFILE_QUESTIONS.length - 1) state.profileIndex += 1;
    else {
      const questions = getApplicableQuestions(state.profile);
      state.applicableCodes = questions.map((question) => question.code);
      state.questionIndex = 0;
      state.stage = "questionnaire";
    }
    save(); render();
  }

  function renderProfile() {
    const question = PROFILE_QUESTIONS[state.profileIndex];
    const currentValue = state.profile[question.code];
    const choiceMarkup = question.options?.map((option) => `<button class="option-card ${currentValue === option.value ? "active" : ""}" data-profile-value="${escapeHtml(option.value)}" type="button"><span>${escapeHtml(option.label)}</span><b aria-hidden="true">→</b></button>`).join("") || "";
    const numberMarkup = `<label class="number-field"><input id="number-input" type="number" inputmode="numeric" min="${question.min}" max="${question.max}" step="1" value="${currentValue ?? ""}" placeholder="${escapeHtml(question.placeholder)}" aria-describedby="number-help" /><span>${escapeHtml(question.unit)}</span></label>
      <p class="field-help" id="number-help">Leistina reikšmė: ${question.min}–${question.max} ${escapeHtml(question.unit)}.</p>
      <p class="field-error" id="field-error" role="alert"></p>
      ${question.type === "number-or-unknown" ? `<button class="secondary-button unknown-button ${currentValue === null ? "active" : ""}" id="unknown-button" type="button">Nežinau</button>` : ""}
      <button class="primary-button" id="number-next" type="button">Toliau <span aria-hidden="true">→</span></button>`;

    app.innerHTML = `<section class="test-panel">
      ${flowHeader("Apie jūsų situaciją", state.profileIndex + 1, PROFILE_QUESTIONS.length)}
      <div class="question-icon" aria-hidden="true">${escapeHtml(question.icon)}</div>
      <p class="eyebrow">Kad klausimai būtų aktualūs</p>
      <h1 class="question-title">${escapeHtml(question.text)}</h1>
      <div class="answer-stack">${question.type === "choice" ? choiceMarkup : numberMarkup}</div>
      ${state.profileIndex > 0 ? `<button class="back-button" id="profile-back" type="button">← Atgal</button>` : ""}
      ${question.code === "S7" ? `<p class="context-note">Suvartojimas nebus vertinamas kaip „didelis“, „mažas“ ar „normalus“.</p>` : ""}
    </section>`;

    document.querySelectorAll("[data-profile-value]").forEach((button) => button.addEventListener("click", () => {
      state.profile[question.code] = button.dataset.profileValue; save(); setTimeout(goToNextProfileQuestion, 130);
    }));
    document.querySelector("#number-next")?.addEventListener("click", () => {
      const input = document.querySelector("#number-input");
      const value = Number(input.value);
      const error = document.querySelector("#field-error");
      if (!Number.isFinite(value) || !Number.isInteger(value) || value < question.min || value > question.max) {
        error.textContent = `Įrašykite skaičių nuo ${question.min} iki ${question.max}.`; input.focus(); return;
      }
      state.profile[question.code] = value; goToNextProfileQuestion();
    });
    document.querySelector("#unknown-button")?.addEventListener("click", () => { state.profile[question.code] = null; goToNextProfileQuestion(); });
    document.querySelector("#profile-back")?.addEventListener("click", () => { state.profileIndex -= 1; save(); render(); });
  }

  function answerQuestion(value) {
    const question = applicableQuestions()[state.questionIndex];
    state.answers[question.code] = value;
    if (state.questionIndex < state.applicableCodes.length - 1) state.questionIndex += 1;
    else finishAssessment();
    save();
    if (state.stage !== "result") setTimeout(render, 130);
  }

  function renderQuestionnaire() {
    const questions = applicableQuestions();
    const question = questions[state.questionIndex];
    const selected = state.answers[question.code];
    const scale = [
      { value: 2, icon: "✓", label: "Taip / reguliariai", className: "yes" },
      { value: 1, icon: "–", label: "Kartais / iš dalies", className: "sometimes" },
      { value: 0, icon: "×", label: "Ne", className: "no" },
    ];
    app.innerHTML = `<section class="test-panel question-panel">
      ${flowHeader(CATEGORIES[question.category].label, state.questionIndex + 1, questions.length)}
      <div class="question-icon" aria-hidden="true">${question.category === "heating" ? "🌡️" : "⚡"}</div>
      <p class="eyebrow">Pasirinkite jums tinkamiausią atsakymą</p>
      <h1 class="question-title">${escapeHtml(question.text)}</h1>
      ${question.hint ? `<p class="question-hint">${escapeHtml(question.hint)}</p>` : ""}
      <div class="score-options">${scale.map((option) => `<button class="score-option ${option.className} ${selected === option.value ? "active" : ""}" data-score="${option.value}" type="button"><span>${option.icon}</span><strong>${escapeHtml(option.label)}</strong></button>`).join("")}
        ${question.allowNA ? `<button class="score-option na ${selected === null ? "active" : ""}" id="na-answer" type="button"><span>○</span><strong>${escapeHtml(question.naLabel || "Netaikoma")}</strong></button>` : ""}
      </div>
      ${state.questionIndex > 0 ? `<button class="back-button" id="question-back" type="button">← Ankstesnis klausimas</button>` : ""}
    </section>`;
    document.querySelectorAll("[data-score]").forEach((button) => button.addEventListener("click", () => answerQuestion(Number(button.dataset.score))));
    document.querySelector("#na-answer")?.addEventListener("click", () => answerQuestion(null));
    document.querySelector("#question-back")?.addEventListener("click", () => { state.questionIndex -= 1; save(); render(); });
  }

  function payload() {
    const allowedAnswers = {};
    const allowedProfile = {};
    state.applicableCodes.forEach((code) => { allowedAnswers[code] = state.answers[code] ?? null; });
    PROFILE_QUESTIONS.forEach((question) => { allowedProfile[question.code] = state.profile[question.code]; });
    return { workshop_id: workshopId, session_id: state.sessionId, self_rating: state.selfRating, profile: allowedProfile, answers: allowedAnswers };
  }

  function finishAssessment() {
    const scores = calculateScores(applicableQuestions(), state.answers);
    state.result = scores;
    state.completedAt = new Date().toISOString();
    state.stage = "result";
    state.submissionStatus = "pending";
    state.submissionError = "";
    state.pendingSubmission = payload();
    save(); render(); submitPending();
  }

  function scoreBar(label, score) {
    return `<div class="category-score"><div><span>${escapeHtml(label)}</span><strong>${Math.round(score)} / 100</strong></div><i><span style="width:${Math.round(score)}%"></span></i></div>`;
  }

  function groupCard() {
    const group = state.groupComparison;
    if (!group || !group.unlocked) {
      return `<section class="result-card group-card locked"><div class="result-card-icon">●●●</div><div><h2>Palyginimas su grupe</h2><p>Grupės palyginimas bus rodomas, kai testą baigs bent 5 dalyviai.</p></div></section>`;
    }
    const ownScore = Math.round(Number(state.result.total_score));
    const groupAverage = Math.round(Number(group.group_average));
    const percentile = Math.round(Number(group.percentile));
    const bands = Array.isArray(group.score_distribution) && group.score_distribution.length === 5
      ? group.score_distribution
      : [
          { label: "0–20", count: 0 },
          { label: "21–40", count: 0 },
          { label: "41–60", count: 0 },
          { label: "61–80", count: 0 },
          { label: "81–100", count: 0 },
        ];
    const ownBand = ownScore <= 20 ? 0 : ownScore <= 40 ? 1 : ownScore <= 60 ? 2 : ownScore <= 80 ? 3 : 4;
    const maxBandCount = Math.max(1, ...bands.map((band) => Number(band.count) || 0));
    return `<section class="result-card group-card"><div class="result-card-icon">↗</div><div><h2>Palyginimas su grupe</h2>
      <div class="comparison-grid"><p class="own-score"><span>Tavo rezultatas</span><strong>${ownScore} / 100</strong></p><p><span>Grupės vidurkis</span><strong>${groupAverage} / 100</strong></p></div>
      <div class="comparison-scale" aria-label="Tavo rezultato ir grupės vidurkio skalė nuo 0 iki 100">
        <div class="comparison-track"><span class="group-marker" style="left:${groupAverage}%" title="Grupės vidurkis: ${groupAverage}"></span><span class="own-marker" style="left:${ownScore}%" title="Tavo rezultatas: ${ownScore}"></span></div>
        <div class="comparison-scale-labels"><span>0</span><span>100</span></div>
      </div>
      <p class="distribution-title">Grupės rezultatų pasiskirstymas</p>
      <div class="score-distribution">${bands.map((band, index) => `<div class="distribution-band ${index === ownBand ? "active" : ""}"><div class="distribution-bar"><i style="height:${Math.max(8, Math.round((Number(band.count) || 0) / maxBandCount * 100))}%"></i></div><strong>${escapeHtml(band.label)}</strong><span>${Number(band.count) || 0}</span>${index === ownBand ? "<small>Tavo intervalas</small>" : ""}</div>`).join("")}</div>
      ${percentile > 0 ? `<p class="percentile-copy">Tavo rezultatas aukštesnis už <strong>${percentile} %</strong> dalyvių.</p>` : ""}<small>Testą baigė: ${group.completed_count}</small></div></section>`;
  }

  function formatConsumption(value, unit) {
    return Number.isFinite(value) ? `${value.toLocaleString("lt-LT", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ${unit}` : "Nenurodyta";
  }

  function consumptionCard() {
    const monthlyKwh = typeof state.profile.S7 === "number" ? state.profile.S7 : null;
    const area = Number(state.profile.S4);
    const people = Number(state.profile.S5);
    const ownPerSquareMetre = monthlyKwh !== null && area > 0 ? monthlyKwh / area : NaN;
    const ownPerPerson = monthlyKwh !== null && people > 0 ? monthlyKwh / people : NaN;
    const group = state.groupComparison;
    const groupReady = Boolean(
      group?.unlocked &&
      group.other_per_square_metre !== null && group.other_per_square_metre !== undefined &&
      group.other_per_household_member !== null && group.other_per_household_member !== undefined &&
      Number.isFinite(Number(group.other_per_square_metre)) && Number.isFinite(Number(group.other_per_household_member))
    );
    const otherPerSquareMetre = groupReady ? Number(group.other_per_square_metre) : NaN;
    const otherPerPerson = groupReady ? Number(group.other_per_household_member) : NaN;
    const otherValue = (value, unit) => groupReady ? formatConsumption(value, unit) : "Laukiama bent 4 kitų atsakymų";

    return `<section class="result-card consumption-card"><h2>Elektros energijos suvartojimas per mėnesį</h2>
      <p class="consumption-intro">Palyginimas apskaičiuojamas pagal nurodytą būsto plotą, namų ūkio dydį ir vidutinį elektros energijos suvartojimą.</p>
      <div class="consumption-table">
        <div class="consumption-heading"><span></span><strong>Jūs</strong><strong>Kiti dalyviai vidutiniškai</strong></div>
        <div class="consumption-row"><span>Vienam būsto kvadratiniam metrui</span><strong data-label="Jūs">${formatConsumption(ownPerSquareMetre, "kWh/m²")}</strong><strong data-label="Kiti dalyviai vidutiniškai">${otherValue(otherPerSquareMetre, "kWh/m²")}</strong></div>
        <div class="consumption-row"><span>Vienam namų ūkio nariui</span><strong data-label="Jūs">${formatConsumption(ownPerPerson, "kWh/žm.")}</strong><strong data-label="Kiti dalyviai vidutiniškai">${otherValue(otherPerPerson, "kWh/žm.")}</strong></div>
      </div>
      ${groupReady ? `<small>Kitų dalyvių vidurkis apskaičiuotas iš ${Number(group.consumption_comparison_count)} galiojančių atsakymų.</small>` : `<small>Kitų dalyvių vidurkis rodomas tik turint bent 4 kitų dalyvių elektro energijos suvartojimo duomenis.</small>`}
    </section>`;
  }

  function renderResult() {
    const result = state.result || calculateScores(applicableQuestions(), state.answers);
    state.result = result;
    const statusMessages = {
      pending: "Rezultatas siunčiamas…",
      sent: "Rezultatas įtrauktas į grupės suvestinę",
      demo: "Demonstracinis režimas: rezultatas išsaugotas šiame įrenginyje",
      error: "Nepavyko pateikti rezultato. Jūsų atsakymai išsaugoti telefone. Bandysime dar kartą atsiradus interneto ryšiui.",
    };
    app.innerHTML = `<section class="result-panel">
      ${brandHeader()}
      <div class="result-hero">
        <p class="eyebrow">Tavo rezultatas</p>
        <div class="score-ring" style="--score:${Math.round(result.total_score)}"><div><strong>${Math.round(result.total_score)}</strong><span>/ 100</span></div></div>
        <h1>Energijos vartojimo sąmoningumo testo rezultatas</h1>
        <p>Praktinio mokymų testo rezultatas skirtas apmąstymui, o ne diagnostiniam vertinimui.</p>
      </div>
      <div class="submission-banner ${state.submissionStatus}"><i></i><span>${escapeHtml(statusMessages[state.submissionStatus] || statusMessages.pending)}</span></div>
      <section class="result-card categories-card"><h2>Rezultatas pagal temas</h2>
        ${scoreBar("Pažįstu savo elektros vartojimą", result.electricity_awareness_score)}
        ${scoreBar("Valdau elektros vartojimą", result.electricity_management_score)}
        ${result.heating_score !== null ? scoreBar("Suprantu savo šilumos vartojimą", result.heating_score) : ""}
      </section>
      <section class="result-card self-compare"><div class="result-card-icon">◒</div><div><h2>Tavo vertinimas ir testo balas</h2><p><span>Tavo vertinimas prieš testą</span><strong>${state.selfRating} %</strong></p><p><span>Testo rezultatas</span><strong>${Math.round(result.total_score)} / 100</strong></p></div></section>
      <div id="consumption-comparison">${consumptionCard()}</div>
      <div id="group-comparison">${groupCard()}</div>
      <button class="primary-button pdf-button" id="download-pdf-button" type="button"><span aria-hidden="true">↓</span> Atsisiųsti rezultatą PDF</button>
      <p class="pdf-status" id="pdf-status" aria-live="polite"></p>
      <button class="secondary-button restart-button" id="restart-button" type="button">↻ Pradėti iš naujo</button>
      <p class="context-note centered">Pradėjus iš naujo bus atnaujintas ankstesnis šios sesijos rezultatas, todėl grupės dalyvių skaičius nepadidės.</p>
    </section>`;
    document.querySelector("#restart-button").addEventListener("click", () => {
      if (!confirm("Pradėti testą iš naujo? Ankstesni atsakymai šiame telefone bus išvalyti.")) return;
      const sameSession = state.sessionId;
      state = freshState(); state.sessionId = sameSession; save(); render();
    });
    document.querySelector("#download-pdf-button").addEventListener("click", downloadPdf);
  }

  async function downloadPdf() {
    const button = document.querySelector("#download-pdf-button");
    const status = document.querySelector("#pdf-status");
    button.disabled = true;
    status.textContent = "Ruošiamas vieno puslapio PDF…";
    try {
      const data = window.ResultPdf.createResultData({
        result: state.result,
        profile: state.profile,
        groupComparison: state.groupComparison,
        completedAt: state.completedAt,
      });
      await window.ResultPdf.downloadResultPdf(data);
      status.textContent = "PDF paruoštas ir atsiųstas.";
    } catch (error) {
      console.error("Nepavyko sukurti PDF:", error);
      status.textContent = "Nepavyko sukurti PDF. Bandykite dar kartą.";
    } finally {
      button.disabled = false;
    }
  }

  async function submitPending() {
    if (!state.pendingSubmission || !["pending", "error"].includes(state.submissionStatus)) return;
    try {
      const clientScores = calculateScores(applicableQuestions(), state.answers);
      const response = await api.submitAssessment(state.pendingSubmission, clientScores);
      state.result = {
        total_score: Number(response.total_score),
        electricity_awareness_score: Number(response.electricity_awareness_score),
        electricity_management_score: Number(response.electricity_management_score),
        heating_score: response.heating_score === null || response.heating_score === undefined ? null : Number(response.heating_score),
      };
      state.submissionStatus = response.mode === "demo" ? "demo" : "sent";
      state.pendingSubmission = null;
      state.submissionError = "";
    } catch (error) {
      state.submissionStatus = "error";
      state.submissionError = error.message;
      console.error("Nepavyko pateikti testo:", error);
    }
    save(); if (state.stage === "result") { renderResult(); updateGroupComparison(); }
  }

  async function updateGroupComparison() {
    if (state.stage !== "result" || !state.result) return;
    try {
      state.groupComparison = await api.getScorePercentile(workshopId, state.result.total_score, state.sessionId);
      save();
      const container = document.querySelector("#group-comparison");
      if (container) container.innerHTML = groupCard();
      const consumptionContainer = document.querySelector("#consumption-comparison");
      if (consumptionContainer) consumptionContainer.innerHTML = consumptionCard();
    } catch (error) { console.warn("Nepavyko atnaujinti grupės palyginimo:", error.message); }
  }

  function updateConnection() {
    document.body.classList.toggle("offline", !navigator.onLine);
    if (navigator.onLine) submitPending();
  }

  function render() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    ({ welcome: renderWelcome, "self-rating": renderSelfRating, profile: renderProfile, questionnaire: renderQuestionnaire, result: renderResult }[state.stage] || renderWelcome)();
  }

  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
  updateConnection(); render();
  if (state.stage === "result") { submitPending(); updateGroupComparison(); }
})();
