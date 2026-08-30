// ================================================================
// VIENINTELĖ VIETA, KURIĄ REIKIA PAKEISTI PRIJUNGIANT SUPABASE
// Naudokite tik viešą „publishable“ raktą, NIEKADA „secret“ ar „service_role“.
// ================================================================
window.ENERGY_GAME_CONFIG = {
  supabaseUrl: "https://klzmbmmlkwrfehfmeceh.supabase.co",
  supabasePublishableKey: "sb_publishable_m5O7Ms5UgeATQmeCMq9CqQ_KPsBIJkl",

  resultsRefreshMs: 5000,
};

// ================================================================
// PROGRAMOS NUSTATYMAI
// URL parametras ?event=... turi prioritetą prieš DEFAULT_WORKSHOP_ID.
// ================================================================
window.APP_CONFIG = {
  SUPABASE_URL: window.ENERGY_GAME_CONFIG.supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: window.ENERGY_GAME_CONFIG.supabasePublishableKey,
  DEFAULT_WORKSHOP_ID: "mokymai-2026",
  RESULT_REFRESH_INTERVAL: window.ENERGY_GAME_CONFIG.resultsRefreshMs || 5000,
};
