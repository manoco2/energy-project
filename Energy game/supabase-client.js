(function () {
  const config = window.APP_CONFIG;
  const DEMO_KEY = "lea-awareness-demo-submissions-v1";

  function isConfigured() {
    return Boolean(
      config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY &&
      !config.SUPABASE_URL.includes("YOUR_") && !config.SUPABASE_URL.includes("***") &&
      !config.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_") && !config.SUPABASE_PUBLISHABLE_KEY.includes("***")
    );
  }

  async function rpc(functionName, body) {
    const response = await fetch(`${config.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: config.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${config.SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let details = "";
      try { details = (await response.json()).message || ""; } catch { details = await response.text(); }
      throw new Error(details || `Supabase klaida: ${response.status}`);
    }
    return response.json();
  }

  function readDemo() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)) || []; } catch { return []; }
  }

  function writeDemo(submissions) {
    localStorage.setItem(DEMO_KEY, JSON.stringify(submissions));
  }

  function demoForWorkshop(workshopId) {
    return readDemo().filter((item) => item.workshop_id === workshopId);
  }

  function calculateDemoSummary(workshopId) {
    const submissions = demoForWorkshop(workshopId);
    const completedCount = submissions.length;
    if (completedCount < 5) return { completed_count: completedCount, unlocked: false, overall_average: null, lowest_questions: [] };

    const overallAverage = Math.round(submissions.reduce((sum, item) => sum + Number(item.total_score), 0) / completedCount);
    const questionScores = window.EnergyAssessment.QUESTIONS.map((question) => {
      const values = submissions.map((item) => item.answers?.[question.code]).filter((value) => value !== null && value !== undefined);
      return { question_code: question.code, valid_n: values.length, score: values.length ? Math.round((values.reduce((sum, value) => sum + Number(value), 0) / (values.length * 2)) * 100) : null };
    }).filter((item) => item.valid_n >= 5).sort((a, b) => a.score - b.score || b.valid_n - a.valid_n).slice(0, 3);

    return { completed_count: completedCount, unlocked: true, overall_average: overallAverage, lowest_questions: questionScores };
  }

  async function submitAssessment(payload, clientScores) {
    if (!isConfigured()) {
      const submissions = readDemo();
      const record = { ...payload, ...clientScores, updated_at: new Date().toISOString() };
      const index = submissions.findIndex((item) => item.workshop_id === payload.workshop_id && item.session_id === payload.session_id);
      if (index >= 0) submissions[index] = record; else submissions.push(record);
      writeDemo(submissions);
      return { mode: "demo", ...clientScores };
    }
    const result = await rpc("submit_assessment", {
      p_workshop_id: payload.workshop_id,
      p_session_id: payload.session_id,
      p_self_rating: payload.self_rating,
      p_profile: payload.profile,
      p_answers: payload.answers,
    });
    return { mode: "remote", ...result };
  }

  async function getGroupSummary(workshopId) {
    if (!isConfigured()) return { mode: "demo", ...calculateDemoSummary(workshopId) };
    return { mode: "remote", ...(await rpc("get_group_summary", { p_workshop_id: workshopId })) };
  }

  async function getScorePercentile(workshopId, score, sessionId) {
    if (!isConfigured()) {
      const submissions = demoForWorkshop(workshopId);
      if (submissions.length < 5) return { mode: "demo", completed_count: submissions.length, unlocked: false };
      const lower = submissions.filter((item) => Number(item.total_score) < Number(score)).length;
      const comparable = submissions.filter((item) =>
        item.session_id !== sessionId &&
        typeof item.profile?.S7 === "number" && Number(item.profile.S4) > 0 && Number(item.profile.S5) > 0
      );
      const round2 = (value) => Math.round(value * 100) / 100;
      return {
        mode: "demo", completed_count: submissions.length, unlocked: true,
        group_average: Math.round(submissions.reduce((sum, item) => sum + Number(item.total_score), 0) / submissions.length),
        percentile: Math.round((lower / submissions.length) * 100),
        consumption_comparison_count: comparable.length,
        other_per_square_metre: comparable.length >= 4 ? round2(comparable.reduce((sum, item) => sum + item.profile.S7 / Number(item.profile.S4), 0) / comparable.length) : null,
        other_per_household_member: comparable.length >= 4 ? round2(comparable.reduce((sum, item) => sum + item.profile.S7 / Number(item.profile.S5), 0) / comparable.length) : null,
      };
    }
    return { mode: "remote", ...(await rpc("get_score_percentile", { p_workshop_id: workshopId, p_score: score, p_session_id: sessionId })) };
  }

  window.AssessmentApi = { isConfigured, submitAssessment, getGroupSummary, getScorePercentile };
})();
