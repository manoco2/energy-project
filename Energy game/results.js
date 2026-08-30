(function () {
  const root = document.querySelector("#results-app");
  const config = window.APP_CONFIG;
  const api = window.AssessmentApi;
  let lastSummary = null;

  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function workshopId() {
    const fromUrl = new URLSearchParams(location.search).get("event");
    const candidate = (fromUrl || config.DEFAULT_WORKSHOP_ID || "mokymai").trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(candidate) ? candidate : "mokymai";
  }

  const eventId = workshopId();

  function header(count, mode) {
    return `<header class="moderator-header">
      <div class="brand"><img src="images/LEA-LOGOTIPAS-ŽALIAS.png" alt="Lietuvos energetikos agentūra" /><strong>Energijos vartojimo sąmoningumo testas</strong></div>
      <div class="event-meta"><span class="live-dot"></span><div><small>Testą baigė</small><strong>${count} dalyvių</strong></div><em>${mode === "demo" ? "Demonstracinis režimas" : `Renginys: ${escapeHtml(eventId)}`}</em></div>
    </header>`;
  }

  function waiting(summary) {
    root.innerHTML = `${header(summary.completed_count, summary.mode)}<section class="waiting-screen">
      <div class="waiting-symbol" aria-hidden="true"><span>●</span><span>●</span><span>●</span></div>
      <p>Laukiame rezultatų…</p>
      <h1>Testą baigė: ${summary.completed_count}</h1>
      <div class="waiting-track"><span style="width:${Math.min(100, (summary.completed_count / 5) * 100)}%"></span></div>
      <strong>Grupės rezultatai bus rodomi, kai testą baigs bent 5 dalyviai.</strong>
    </section><footer>${summary.mode === "demo" ? "Prijunkite Supabase bendram kelių įrenginių testavimui." : "Rezultatai atnaujinami automatiškai kas kelias sekundes."}</footer>`;
  }

  function weakestCard(item, index) {
    const question = window.EnergyAssessment.questionByCode(item.question_code);
    return `<article class="weak-card">
      <div class="weak-rank">${index + 1}</div>
      <div class="weak-score"><strong>${Math.round(Number(item.score))}</strong><span>/ 100</span></div>
      <div class="weak-copy"><p>${escapeHtml(question?.text || "Klausimo tekstas nerastas")}</p><small>Atsakė: ${Number(item.valid_n)}</small></div>
      <div class="weak-meter"><span style="width:${Math.round(Number(item.score))}%"></span></div>
    </article>`;
  }

  function unlocked(summary) {
    const score = Math.round(Number(summary.overall_average));
    const weakest = summary.lowest_questions || [];
    root.innerHTML = `${header(summary.completed_count, summary.mode)}<section class="dashboard">
      <section class="group-score-card">
        <div class="score-orbit" style="--score:${score}"><div><small>Mūsų grupės rezultatas</small><strong>${score}</strong><span>/ 100</span></div></div>
        <div class="group-score-copy"><p>Energijos vartojimo sąmoningumo testo rezultatas</p><h1>${summary.completed_count} dalyvių bendras vidurkis</h1><span>Skaičiuojamas atskirų dalyvių normalizuotų rezultatų vidurkis.</span></div>
      </section>
      <section class="improvement-section"><header><p>Grupės įžvalga</p><h2>Kur turime daugiausia erdvės tobulėti?</h2><span>Rodomi tik klausimai, į kuriuos atsakė bent 5 dalyviai.</span></header>
        <div class="weak-list">${weakest.length ? weakest.map(weakestCard).join("") : `<div class="no-weakest">Dar nėra trijų klausimų, turinčių bent 5 galiojančius atsakymus.</div>`}</div>
      </section>
    </section><footer>Atnaujinta ${new Date().toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · Rodomi tik agreguoti anoniminiai rezultatai</footer>`;
  }

  function render(summary) {
    if (!summary.unlocked) waiting(summary); else unlocked(summary);
  }

  async function refresh() {
    try {
      lastSummary = await api.getGroupSummary(eventId);
      render(lastSummary);
    } catch (error) {
      if (lastSummary) render(lastSummary);
      const warning = document.createElement("div");
      warning.className = "connection-warning";
      warning.textContent = "Nepavyko atnaujinti. Rodomi paskutiniai gauti rezultatai.";
      root.prepend(warning);
      console.error("Grupės rezultatų klaida:", error);
    }
  }

  refresh();
  setInterval(refresh, Math.max(3000, Number(config.RESULT_REFRESH_INTERVAL) || 5000));
})();
