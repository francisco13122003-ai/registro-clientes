(() => {
  "use strict";

  if (!window.supabase?.createClient) {
    console.error("No se cargó la librería UMD de Supabase.");
    return;
  }

  if (!window.APP_CONFIG) {
    console.error("No se cargó config.js antes de supabase.js.");
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

  function createInMemoryLock() {
    let queue = Promise.resolve();

    return async function inMemoryLock(_name, _acquireTimeout, fn) {
      const previous = queue;
      let release;
      queue = new Promise((resolve) => {
        release = resolve;
      });

      await previous;

      try {
        return await fn();
      } finally {
        release();
      }
    };
  }

  window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "flopitec-auth-token",
      lock: createInMemoryLock(),
      lockAcquireTimeout: 2000,
    },
  });
})();
