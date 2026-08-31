(function () {
  const root = document.querySelector("#results-app");
  const config = window.APP_CONFIG;
  const api = window.AssessmentApi;
  let lastSummary = null;
  let lastUpdatedAt = null;
  let isRefreshing = false;
  let pdfStatus = "";

  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function workshopId() {
    const fromUrl = new URLSearchParams(location.search).get("event");
    const candidate = (fromUrl || config.DEFAULT_WORKSHOP_ID || "mokymai").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(candidate) ? candidate : "mokymai";
  }

  const eventId = workshopId();

  function participantLabel(count) {
    const value = Number(count) || 0;
    const lastTwo = value % 100;
    const last = value % 10;
    if (lastTwo >= 11 && lastTwo <= 19) return `${value} dalyvių`;
    if (last === 1) return `${value} dalyvis`;
    if (last >= 2 && last <= 9) return `${value} dalyviai`;
    return `${value} dalyvių`;
  }

  function header(summary) {
    const countMarkup = summary
      ? `<small>Testą baigė</small><strong>${participantLabel(summary.completed_count)}</strong>`
      : `<small>Rezultatų būsena</small><strong>Dar neatnaujinta</strong>`;
    return `<header class="moderator-header">
      <div class="brand"><img src="images/LEA-LOGOTIPAS-ŽALIAS.png" alt="Lietuvos energetikos agentūra" /><strong>Energijos vartojimo sąmoningumo testas</strong></div>
      <div class="event-meta"><span class="live-dot ${summary ? "active" : ""}"></span><div>${countMarkup}</div>${summary?.mode === "demo" ? "<em>Demonstracinis režimas</em>" : ""}</div>
    </header>`;
  }

  function controls(summary, errorMessage = "") {
    const updated = lastUpdatedAt && summary
      ? `Rezultatai atnaujinti ${lastUpdatedAt.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })} · ${participantLabel(summary.completed_count)}`
      : "Paspauskite „Atnaujinti rezultatus“, kad gautumėte naujausią duomenų snapshot.";
    return `<section class="result-controls">
      <p class="refresh-meta">${escapeHtml(updated)}</p>
      ${errorMessage ? `<p class="connection-warning">${escapeHtml(errorMessage)}</p>` : ""}
      <div class="control-buttons">
        <button class="refresh-button" id="refresh-results" type="button" ${isRefreshing ? "disabled" : ""}>${isRefreshing ? "Atnaujinama..." : "↻ Atnaujinti rezultatus"}</button>
        <button class="pdf-download-button" id="download-group-pdf" type="button" ${summary && !isRefreshing ? "" : "disabled"}>↓ Atsisiųsti rezultatą PDF</button>
      </div>
      <p class="pdf-status" aria-live="polite">${escapeHtml(pdfStatus)}</p>
    </section>`;
  }

  function initial(errorMessage = "") {
    root.innerHTML = `${header(null)}<section class="manual-start">
      <div class="waiting-symbol" aria-hidden="true"><span>●</span><span>●</span><span>●</span></div>
      <p>Grupės rezultatų peržiūra</p>
      <h1>Duomenys gaunami tik rankiniu būdu</h1>
      <strong>Rezultatai nebus atnaujinami automatiškai.</strong>
    </section>${controls(null, errorMessage)}<footer>Rodomi tik agreguoti anoniminiai rezultatai.</footer>`;
    bindControls();
  }

  function waiting(summary, errorMessage = "") {
    root.innerHTML = `${header(summary)}<section class="waiting-screen">
      <div class="waiting-symbol" aria-hidden="true"><span>●</span><span>●</span><span>●</span></div>
      <p>Laukiame rezultatų…</p>
      <h1>Testą baigė: ${summary.completed_count}</h1>
      <div class="waiting-track"><span style="width:${Math.min(100, (summary.completed_count / 5) * 100)}%"></span></div>
      <strong>Grupės rezultatai bus rodomi, kai testą baigs bent 5 dalyviai.</strong>
    </section>${controls(summary, errorMessage)}<footer>Rodomi tik agreguoti anoniminiai rezultatai.</footer>`;
    bindControls();
  }

  function questionCard(item, index, kind) {
    const question = window.EnergyAssessment.questionByCode(item.question_code);
    const score = Math.round(Number(item.score));
    return `<article class="insight-card ${kind}">
      <div class="insight-rank">${index + 1}</div>
      <div class="insight-score"><strong>${score}</strong><span>/ 100</span><small>Vidutinis įvertinimas</small></div>
      <div class="insight-copy"><p>${escapeHtml(question?.text || "Klausimo tekstas nerastas")}</p><small>Atsakė: ${Number(item.valid_n)}</small></div>
      <div class="insight-meter"><span style="width:${score}%"></span></div>
    </article>`;
  }

  function insightSection(title, items, kind) {
    const empty = "Dar nėra trijų klausimų, turinčių bent 5 galiojančius atsakymus.";
    return `<section class="insight-section ${kind}"><header><p>Grupės įžvalga</p><h2>${escapeHtml(title)}</h2><span>Rodomi tik klausimai, į kuriuos atsakė bent 5 dalyviai.</span></header>
      <div class="insight-list">${items.length ? items.map((item, index) => questionCard(item, index, kind)).join("") : `<div class="no-insights">${empty}</div>`}</div>
    </section>`;
  }

  function unlocked(summary, errorMessage = "") {
    const score = Math.round(Number(summary.overall_average));
    const selfRating = Math.round(Number(summary.self_rating_average));
    const weakest = summary.lowest_questions || [];
    const strongest = summary.highest_questions || [];
    root.innerHTML = `${header(summary)}<section class="dashboard">
      <section class="group-score-card">
        <div class="score-orbit" style="--score:${score}"><div><small>Grupės vidurkis</small><strong>${score}</strong><span>/ 100</span></div></div>
        <div class="group-score-copy"><p>Energijos vartojimo sąmoningumo testo rezultatas</p><h1>${Number(summary.completed_count)} dalyvių bendras vidurkis</h1>
          <div class="self-rating-average"><span>Vidutinis dalyvių savęs vertinimas prieš testą</span><strong>${selfRating} %</strong></div>
        </div>
      </section>
      <div class="insight-columns">
        ${insightSection("Kur turime tobulėti?", weakest, "improvement")}
        ${insightSection("Ką geriausiai išmanome?", strongest, "strength")}
      </div>
    </section>${controls(summary, errorMessage)}<footer>Rodomi tik agreguoti anoniminiai rezultatai.</footer>`;
    bindControls();
  }

  function render(summary, errorMessage = "") {
    if (!summary) initial(errorMessage);
    else if (!summary.unlocked) waiting(summary, errorMessage);
    else unlocked(summary, errorMessage);
  }

  async function refresh() {
    if (isRefreshing) return;
    isRefreshing = true;
    pdfStatus = "";
    render(lastSummary);
    try {
      const summary = await api.getGroupSummary(eventId);
      lastSummary = summary;
      lastUpdatedAt = new Date();
      isRefreshing = false;
      render(lastSummary);
    } catch (error) {
      isRefreshing = false;
      render(lastSummary, lastSummary
        ? "Nepavyko atnaujinti. Rodomi paskutiniai sėkmingai gauti rezultatai."
        : "Nepavyko gauti rezultatų. Bandykite dar kartą.");
      console.error("Grupės rezultatų klaida:", error);
    }
  }

  async function downloadPdf() {
    if (!lastSummary || !lastUpdatedAt) return;
    const button = document.querySelector("#download-group-pdf");
    button.disabled = true;
    pdfStatus = "Ruošiamas PDF iš ekrane rodomų rezultatų…";
    const status = document.querySelector(".pdf-status");
    if (status) status.textContent = pdfStatus;
    try {
      const data = window.ResultPdf.createGroupResultData({
        summary: lastSummary,
        updatedAt: lastUpdatedAt,
        questionByCode: window.EnergyAssessment.questionByCode,
      });
      await window.ResultPdf.downloadGroupResultPdf(data);
      pdfStatus = "PDF paruoštas ir atsiųstas.";
    } catch (error) {
      pdfStatus = "Nepavyko sukurti PDF. Bandykite dar kartą.";
      console.error("Grupės PDF klaida:", error);
    } finally {
      button.disabled = false;
      const currentStatus = document.querySelector(".pdf-status");
      if (currentStatus) currentStatus.textContent = pdfStatus;
    }
  }

  function bindControls() {
    document.querySelector("#refresh-results")?.addEventListener("click", refresh);
    document.querySelector("#download-group-pdf")?.addEventListener("click", downloadPdf);
  }

  render(null);
})();
