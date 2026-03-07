if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

(() => {
  "use strict";


  if (!window.db) {
  alert("No se cargó supabase.js correctamente.");
  return;
}

if (!window.APP_CONFIG) {
  alert("No se cargó config.js correctamente.");
  return;
}

if (!window.AppUtils) {
  alert("No se cargó utils.js correctamente.");
  return;
}

const supabase = window.db;

const {
  STORAGE_BUCKET,
  OFFLINE_DB_NAME,
  OFFLINE_STORE_NAME,
  APP_VERSION,
  CUSTOMER_PANEL_LIMIT,
  SEARCH_LIMIT,
  REGISTRY_LIMIT,
  COMPANY_LIMIT,
  CLIENT_HISTORY_LIMIT,
  TOAST_MS,
  TX_KINDS,
  PAYMENT_METHODS,
  MONTHS_ES,
} = window.APP_CONFIG;

const {
  $,
  byId,
  normalize,
  normalizeLower,
  toNumber,
  clampMoney,
  euro,
  uuidLike,
  escapeHtml,
  debounce,
  wait,
  withTimeout,
  todayISO,
  formatDate,
  formatDateTime,
  sortByDateDesc,
  sortByTextAsc,
  uniqueBy,
  isNonEmpty,
  safeArray,
  setText,
  setHTML,
  show,
  hide,
  toggle,
  setDisabled,
  addClass,
  removeClass,
  toggleClass,
  getQuarterByMonth,
  parseISODate,
  buildSearchHaystack,
  toPhoneComparable,
  getClientRequestId,
} = window.AppUtils;


  // =========================================
  // HELPERS BASE
  // =========================================

  function customerDisplayName(customer, company = null) {
    if (!customer) return "—";

    const customerName = `${normalize(customer.first_name)} ${normalize(customer.last_name)}`.trim();
    if (customer.is_company && company?.business_name) {
      return `${company.business_name} · ${customerName || "Sin contacto"}`;
    }

    return customerName || company?.business_name || "Sin nombre";
  }

  function companyDisplayLine(company) {
    if (!company) return "—";
    const parts = [
      company.business_name,
      company.cif ? `CIF: ${company.cif}` : "",
      company.city || "",
      company.province || "",
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function transactionKindLabel(kind) {
    switch (kind) {
      case "ticket":
        return "Ticket";
      case "factura":
        return "Factura";
      case "otro":
        return "Otro";
      case "nico":
        return "Nico";
      default:
        return kind || "—";
    }
  }

  function paymentMethodLabel(value) {
    switch (value) {
      case "efectivo":
        return "Efectivo";
      case "tarjeta":
        return "Tarjeta";
      case "bizum":
        return "Bizum";
      case "transferencia":
        return "Transferencia";
      default:
        return value || "—";
    }
  }

  // =========================================
  // DOM
  // =========================================
  const els = {
    // shell
    viewLogin: $("viewLogin"),
    viewApp: $("viewApp"),
    toast: $("toast"),

    // top
    btnNavBack: $("btnNavBack"),
    btnNavForward: $("btnNavForward"),
    netStatus: $("netStatus"),
    btnOfflineCount: $("btnOfflineCount"),
    btnOfflineExport: $("btnOfflineExport"),
    sessionBadge: $("sessionBadge"),
    btnLogout: $("btnLogout"),

    // login
    loginEmail: $("loginEmail"),
    loginPassword: $("loginPassword"),
    btnLogin: $("btnLogin"),
    loginMsg: $("loginMsg"),    

    // nav
    navButtons: [...document.querySelectorAll(".nav-btn")],
    tileButtons: [...document.querySelectorAll(".tile[data-nav]")],

    // panels
    panelHome: $("panelHome"),
    panelRegistry: $("panelRegistry"),
    panelAccounting: $("panelAccounting"),
    panelCreate: $("panelCreate"),
    panelSearch: $("panelSearch"),
    panelCompanies: $("panelCompanies"),
    panelDetail: $("panelDetail"),

    // home
    homeRecentTxCount: $("homeRecentTxCount"),
    homeCustomersCount: $("homeCustomersCount"),
    homeCompaniesCount: $("homeCompaniesCount"),
    homeOfflineCount: $("homeOfflineCount"),

    // create/edit customer
   formTitle: $("formTitle"),
customerForm: $("customerForm"),
formMsg: $("formMsg"),
btnCancelEdit: $("btnCancelEdit"),
btnResetCustomerForm: $("btnResetCustomerForm"),
btnDeleteCustomer: $("btnDeleteCustomer"),

    firstName: $("firstName"),
    lastName: $("lastName"),
    phone: $("phone"),
    address: $("address"),
    isCompany: $("isCompany"),

    companyBox: $("companyBox"),
    cif: $("cif"),
    businessName: $("businessName"),
    companyAddress: $("companyAddress"),
    city: $("city"),
    province: $("province"),
    postalCode: $("postalCode"),

    azCustomersCreate: $("azCustomersCreate"),
    azCustomersCreateEmpty: $("azCustomersCreateEmpty"),
    createPanelQuickFilter: $("createPanelQuickFilter"),

    // search
    searchInput: $("searchInput"),
    searchList: $("searchList"),
    searchCount: $("searchCount"),
    searchEmpty: $("searchEmpty"),

    // companies
    companiesFilter: $("companiesFilter"),
    companiesList: $("companiesList"),
    companiesEmpty: $("companiesEmpty"),

    // detail
    detailTitle: $("detailTitle"),
detailSubtitle: $("detailSubtitle"),
detailInfo: $("detailInfo"),
btnEditFromDetail: $("btnEditFromDetail"),
btnBackFromDetail: $("btnBackFromDetail"),
btnDeleteFromDetail: $("btnDeleteFromDetail"),

    // attachments
    fileInput: $("fileInput"),
    btnUpload: $("btnUpload"),
    attachmentsList: $("attachmentsList"),
    attachmentsEmpty: $("attachmentsEmpty"),
    selectedFileBox: $("selectedFileBox"),
    selectedFileName: $("selectedFileName"),
    btnClearSelected: $("btnClearSelected"),

    // client history mini
    btnClientHistoryOpenRegistry: $("btnClientHistoryOpenRegistry"),
    clientHistoryList: $("clientHistoryList"),
    clientHistoryEmpty: $("clientHistoryEmpty"),
    clientHistoryTabs: [...document.querySelectorAll('[data-chtab]')],

    // registry/accounting reserved for part 2
    btnNewTx: $("btnNewTx"),
    txFormBox: $("txFormBox"),
    txFormTitle: $("txFormTitle"),
    btnTxCancel: $("btnTxCancel"),
    btnTxSave: $("btnTxSave"),
    btnTxDelete: $("btnTxDelete"),
    btnTxReset: $("btnTxReset"),
    txMsg: $("txMsg"),
    txList: $("txList"),
    txListEmpty: $("txListEmpty"),
    txListCount: $("txListCount"),
    registryFilterInput: $("registryFilterInput"),
    registryDateFrom: $("registryDateFrom"),
    registryDateTo: $("registryDateTo"),
    registryVisibleCount: $("registryVisibleCount"),
    registryVisibleAmount: $("registryVisibleAmount"),
    regTabButtons: [...document.querySelectorAll("[data-regtab]")],

    txCustomerSearch: $("txCustomerSearch"),
    txCustomerResults: $("txCustomerResults"),
    txCustomerSelected: $("txCustomerSelected"),
    btnTxCreateCustomer: $("btnTxCreateCustomer"),
    btnTxClearCustomer: $("btnTxClearCustomer"),
    txDate: $("txDate"),
    txPayment: $("txPayment"),
    txComments: $("txComments"),
    txItemsBox: $("txItemsBox"),
    txItems: $("txItems"),
    txItemsEmpty: $("txItemsEmpty"),
    btnAddItem: $("btnAddItem"),
    txTotal: $("txTotal"),
    txNicoBox: $("txNicoBox"),
    nicoConcept: $("nicoConcept"),
    nicoMaterial: $("nicoMaterial"),
    nicoTotal: $("nicoTotal"),
    nicoForNico: $("nicoForNico"),
    nicoForFlopitec: $("nicoForFlopitec"),
    nicoPaid: $("nicoPaid"),
    nicoNotes: $("nicoNotes"),

    accountingYear: $("accountingYear"),
    accountingTableBody: $("accountingTableBody"),
    accountingEmpty: $("accountingEmpty"),
    accountingYearTotal: $("accountingYearTotal"),
    accountingQ1: $("accountingQ1"),
    accountingQ2: $("accountingQ2"),
    accountingQ3: $("accountingQ3"),
    accountingQ4: $("accountingQ4"),
    accountingTabButtons: [...document.querySelectorAll("[data-acctab]")],
  };

  // =========================================
  // STATE
  // =========================================
  const state = {
    session: null,
    user: null,
    isBootstrapping: false,
    loading: {
      bootstrap: false,
      customers: false,
      detail: false,
      search: false,
      companies: false,
      attachments: false,
      registry: false,
      accounting: false,
    },

    currentPanel: "home",
    historyBack: [],
    historyForward: [],

    customers: [],
    companies: [],
    customerMap: new Map(),
    companyMapByCustomerId: new Map(),

    attachmentsByCustomerId: new Map(),
    transactions: [],
    transactionItemsByTxId: new Map(),

    currentCustomerId: null,
    currentDetailCustomerId: null,
    currentDetailHistoryKind: "ticket",

    editingCustomerId: null,

    registry: {
      currentKind: "ticket",
      editingTxId: null,
      selectedCustomerId: null,
      draftItems: [],
      txLoadedOnce: false,
      openFromDetailCustomerId: null,
      lastFilterText: "",
      lastDateFrom: "",
      lastDateTo: "",
    },

    accounting: {
      year: "",
      kind: "ticket",
    },

    selectedUploadFile: null,

    offline: {
      syncing: false,
      lastCount: 0,
    },
    authReady: false,
  };

  // =========================================
  // PANEL SYSTEM
  // =========================================
  const PANEL_NAMES = [
    "home",
    "registry",
    "accounting",
    "create",
    "search",
    "companies",
    "detail",
  ];

  const panelMap = {
    home: els.panelHome,
    registry: els.panelRegistry,
    accounting: els.panelAccounting,
    create: els.panelCreate,
    search: els.panelSearch,
    companies: els.panelCompanies,
    detail: els.panelDetail,
  };

  function updateActiveNavUI() {
    for (const btn of els.navButtons) {
      const target = btn.dataset.nav;
      btn.classList.toggle("is-active", target === state.currentPanel);
    }
  }

  function showPanel(panelName, options = {}) {
    if (!PANEL_NAMES.includes(panelName)) return;

    const { pushHistory = true, clearForward = true } = options;
    const previousPanel = state.currentPanel;

    if (pushHistory && previousPanel && previousPanel !== panelName) {
      state.historyBack.push(previousPanel);
      if (clearForward) {
        state.historyForward = [];
      }
    }

    state.currentPanel = panelName;

    for (const [name, panel] of Object.entries(panelMap)) {
      if (!panel) continue;
      panel.classList.toggle("hidden", name !== panelName);
    }

    updateActiveNavUI();
    updateNavArrows();
  }

  function updateNavArrows() {
    setDisabled(els.btnNavBack, state.historyBack.length === 0);
    setDisabled(els.btnNavForward, state.historyForward.length === 0);
  }

  function navigateTo(panelName, options = {}) {
    showPanel(panelName, options);

    if (panelName === "search") {
      renderSearchResults();
    } else if (panelName === "companies") {
      renderCompaniesList();
    } else if (panelName === "create") {
      renderCustomerAzPanel();
    } else if (panelName === "home") {
      renderHomeStats();
    } else if (panelName === "detail") {
      renderDetailPanel();
    }
  }

  function navigateBack() {
    if (!state.historyBack.length) return;
    const prev = state.historyBack.pop();
    if (state.currentPanel) {
      state.historyForward.push(state.currentPanel);
    }
    showPanel(prev, { pushHistory: false, clearForward: false });
    afterNavigation(prev);
  }

  function navigateForward() {
    if (!state.historyForward.length) return;
    const next = state.historyForward.pop();
    if (state.currentPanel) {
      state.historyBack.push(state.currentPanel);
    }
    showPanel(next, { pushHistory: false, clearForward: false });
    afterNavigation(next);
  }

  function afterNavigation(panelName) {
    if (panelName === "search") {
      renderSearchResults();
    } else if (panelName === "companies") {
      renderCompaniesList();
    } else if (panelName === "create") {
      renderCustomerAzPanel();
    } else if (panelName === "home") {
      renderHomeStats();
    } else if (panelName === "detail") {
      renderDetailPanel();
    }
  }

  // =========================================
  // TOAST / STATUS
  // =========================================
  let toastTimer = null;

  function showToast(message, type = "success", ms = TOAST_MS) {
    if (!els.toast) return;

    els.toast.textContent = message || "";
    els.toast.className = "toast";
    els.toast.classList.add(`is-${type}`);
    show(els.toast);

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hide(els.toast);
      els.toast.className = "toast hidden";
    }, ms);
  }

  function setInlineMessage(el, message = "", type = "muted") {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("muted");
    el.style.color = "";
    if (!message) {
      el.classList.add("muted");
      return;
    }

    if (type === "error") {
      el.style.color = "#ffb0b0";
    } else if (type === "success") {
      el.style.color = "#bff2cf";
    } else if (type === "warning") {
      el.style.color = "#ffd89a";
    } else {
      el.classList.add("muted");
    }
  }

  // =========================================
  // ONLINE / OFFLINE
  // =========================================
  function updateNetStatusUI() {
    if (!els.netStatus) return;

    if (navigator.onLine) {
      els.netStatus.textContent = "Online";
      els.netStatus.classList.remove("offline");
      els.netStatus.classList.add("online");
    } else {
      els.netStatus.textContent = "Offline (guardando en este PC)";
      els.netStatus.classList.remove("online");
      els.netStatus.classList.add("offline");
    }
  }

  function openOfflineDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(OFFLINE_DB_NAME, 1);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
          db.createObjectStore(OFFLINE_STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function offlineAdd(operation) {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE_NAME, "readwrite");
      tx.objectStore(OFFLINE_STORE_NAME).add({
        created_at: Date.now(),
        ...operation,
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function offlineGetAll() {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE_NAME, "readonly");
      const req = tx.objectStore(OFFLINE_STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function offlineDelete(id) {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE_NAME, "readwrite");
      tx.objectStore(OFFLINE_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function updateOfflineCounter() {
    try {
      const operations = await offlineGetAll();
      state.offline.lastCount = operations.length;

      if (els.btnOfflineCount) {
        els.btnOfflineCount.textContent = `Pendientes: ${operations.length}`;
      }

      if (els.homeOfflineCount) {
        els.homeOfflineCount.textContent = String(operations.length);
      }
    } catch (error) {
      console.error("No se pudo actualizar el contador offline:", error);
    }
  }

  async function exportOfflineBackup() {
    const operations = await offlineGetAll();

    if (!operations.length) {
      alert("No hay datos offline pendientes.");
      return;
    }

    const blob = new Blob([JSON.stringify(operations, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flopitec_offline_backup_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function syncOfflineQueue() {
    if (!navigator.onLine || state.offline.syncing) return;

    state.offline.syncing = true;

    try {
      const operations = await offlineGetAll();
      const sorted = [...operations].sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

      for (const operation of sorted) {
        try {
          if (operation.kind === "customer_save") {
            await syncOfflineCustomerSave(operation);
          } else if (operation.kind === "tx_save") {
            await syncOfflineTxSave(operation);
          } else if (operation.kind === "tx_delete") {
            await syncOfflineTxDelete(operation);
          } else if (operation.kind === "attachment_delete") {
            await syncOfflineAttachmentDelete(operation);
          }

          await offlineDelete(operation.id);
        } catch (error) {
          console.warn("No se pudo sincronizar una operación offline. Se reintentará luego.", error);
          break;
        }
      }
    } finally {
      state.offline.syncing = false;
      await updateOfflineCounter();
    }
  }

  async function syncOfflineCustomerSave(operation) {
    const {
      customerPayload,
      companyPayload,
      companyOn,
      editingCustomerId,
    } = operation;

    let savedCustomerId = editingCustomerId || null;

    if (!savedCustomerId) {
      const { data, error } = await supabase
        .from("customers")
        .insert(customerPayload)
        .select("id")
        .single();

      if (error) throw error;
      savedCustomerId = data.id;
    } else {
      const { error } = await supabase
        .from("customers")
        .update(customerPayload)
        .eq("id", savedCustomerId);

      if (error) throw error;
    }

    if (companyOn) {
      await supabase.from("companies").delete().eq("customer_id", savedCustomerId);

      const { error } = await supabase.from("companies").insert({
        ...companyPayload,
        customer_id: savedCustomerId,
      });

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("customer_id", savedCustomerId);

      if (error) throw error;
    }
  }


  async function syncOfflineTxDelete(operation) {
    if (!operation?.txId) return;
    const { error } = await supabase.from("transactions").delete().eq("id", operation.txId);
    if (error) throw error;
  }

  async function syncOfflineAttachmentDelete(operation) {
    if (!operation?.attachmentId) return;
    const { error } = await supabase.from("attachments").delete().eq("id", operation.attachmentId);
    if (error) throw error;
  }

  // =========================================
  // AUTH
  // =========================================
  function updateSessionUI() {
    const hasSession = !!state.session;
    toggle(els.viewLogin, !hasSession);
    toggle(els.viewApp, hasSession);
    toggle(els.btnLogout, hasSession);

    if (hasSession) {
      setText(els.sessionBadge, state.user?.email || "Sesión iniciada");
      show(els.sessionBadge);
    } else {
      setText(els.sessionBadge, "");
      hide(els.sessionBadge);
    }
  }

  async function doLogin() {
    const email = normalize(els.loginEmail?.value);
    const password = normalize(els.loginPassword?.value);

    if (!email || !password) {
      setInlineMessage(els.loginMsg, "Introduce email y contraseña.", "error");
      return;
    }

    setDisabled(els.btnLogin, true);
    setInlineMessage(els.loginMsg, "Entrando...", "muted");

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        12000
      );

      if (error) throw error;

      state.session = data.session || null;
      state.user = data.user || data.session?.user || null;

      updateSessionUI();
      setInlineMessage(els.loginMsg, "");
      els.loginPassword.value = "";

    navigateTo("home");
    showToast("Sesión iniciada correctamente.", "success");
    } catch (error) {
      console.error(error);
      setInlineMessage(
        els.loginMsg,
        error?.message || "No se pudo iniciar sesión.",
        "error"
      );
    } finally {
      setDisabled(els.btnLogin, false);
    }
  }

  async function doLogout() {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Error al cerrar sesión:", error);
    }

    state.session = null;
    state.user = null;
    updateSessionUI();
    navigateTo("home", { pushHistory: false });
  }

  async function checkExistingSession() {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), 12000);
    state.session = data?.session || null;
    state.user = data?.session?.user || null;
    updateSessionUI();

    if (state.session) {
      state.authReady = true;
      navigateTo("home", { pushHistory: false });
      await bootstrapDataAfterAuth();
    }
  } catch (error) {
    console.warn("No se pudo recuperar la sesión a tiempo:", error);
    state.session = null;
    state.user = null;
    state.authReady = false;
    updateSessionUI();
  }
}

  // =========================================
  // DATA LOADERS
  // =========================================
  async function fetchCustomersAndCompanies() {
    state.loading.customers = true;

    try {
      const [{ data: customers, error: customersError }, { data: companies, error: companiesError }] =
        await Promise.all([
          withTimeout(
            supabase
              .from("customers")
              .select("*")
              .order("last_name", { ascending: true })
              .order("first_name", { ascending: true }),
            15000
          ),
          withTimeout(
            supabase
              .from("companies")
              .select("*")
              .order("business_name", { ascending: true }),
            15000
          ),
        ]);

      if (customersError) throw customersError;
      if (companiesError) throw companiesError;

      const uniqueCustomers = uniqueBy(safeArray(customers), (row) => row.id);
      const uniqueCompanies = uniqueBy(safeArray(companies), (row) => row.customer_id || row.id);

      state.customers = uniqueCustomers;
      state.companies = uniqueCompanies;

      rebuildCustomerMaps();
    } finally {
      state.loading.customers = false;
    }
  }

  function rebuildCustomerMaps() {
    state.customerMap = new Map();
    state.companyMapByCustomerId = new Map();

    for (const customer of state.customers) {
      state.customerMap.set(customer.id, customer);
    }

    for (const company of state.companies) {
      if (company.customer_id) {
        state.companyMapByCustomerId.set(company.customer_id, company);
      }
    }
  }

  async function fetchAttachmentsForCustomer(customerId) {
    if (!customerId) return [];

    state.loading.attachments = true;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("attachments")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        12000
      );

      if (error) throw error;

      const unique = uniqueBy(safeArray(data), (row) => row.id);
      state.attachmentsByCustomerId.set(customerId, unique);
      return unique;
    } finally {
      state.loading.attachments = false;
    }
  }

  async function fetchTransactionsBase() {
    // La carga detallada de registro/ítems se completa en la PARTE 2.
    // Dejamos la base para que home/detalle no rompan.
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("transactions")
          .select("*")
          .order("tx_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(REGISTRY_LIMIT),
        15000
      );

      if (error) throw error;

      state.transactions = uniqueBy(safeArray(data), (row) => row.id);
    } catch (error) {
      console.error("No se pudieron cargar las transacciones base:", error);
      state.transactions = [];
    }
  }

  async function bootstrapDataAfterAuth() {
  if (state.isBootstrapping) return;
  state.isBootstrapping = true;

  try {
    await Promise.all([
      fetchCustomersAndCompanies(),
      fetchTransactionsBase(),
    ]);

    renderAllCoreViews();
    await updateOfflineCounter();
    await syncOfflineQueue().catch(console.error);
  } finally {
    state.isBootstrapping = false;
  }
}

  function renderAllCoreViews() {
    renderHomeStats();
    renderCustomerAzPanel();
    renderSearchResults();
    renderCompaniesList();
    renderDetailPanel();
    renderClientHistory();
  }

  // =========================================
  // HOME
  // =========================================
  function renderHomeStats() {
    setText(els.homeCustomersCount, String(state.customers.length));
    setText(els.homeCompaniesCount, String(state.companies.length));
    setText(els.homeRecentTxCount, String(state.transactions.length));
    setText(els.homeOfflineCount, String(state.offline.lastCount || 0));
  }

  // =========================================
  // CUSTOMER FORM
  // =========================================
  function resetCustomerForm({ preservePanel = false } = {}) {
    if (els.customerForm) {
      els.customerForm.reset();
    }

    state.editingCustomerId = null;

    if (els.companyBox) {
      hide(els.companyBox);
    }

    setInlineMessage(els.formMsg, "");
    setText(els.formTitle, "Crear ficha");
    hide(els.btnCancelEdit);

    if (!preservePanel && state.currentPanel !== "create") {
      navigateTo("create");
    }
  }

  function setCompanyBoxVisibility() {
    const enabled = !!els.isCompany?.checked;
    toggle(els.companyBox, enabled);
  }

  function fillCustomerForm(customerId) {
    const customer = state.customerMap.get(customerId);
    if (!customer) return;

    const company = state.companyMapByCustomerId.get(customerId) || null;

    state.editingCustomerId = customerId;

    els.firstName.value = customer.first_name || "";
    els.lastName.value = customer.last_name || "";
    els.phone.value = customer.phone || "";
    els.address.value = customer.address || "";
    els.isCompany.checked = !!customer.is_company;

    setCompanyBoxVisibility();

    els.cif.value = company?.cif || "";
    els.businessName.value = company?.business_name || "";
    els.companyAddress.value = company?.address || "";
    els.city.value = company?.city || "";
    els.province.value = company?.province || "";
    els.postalCode.value = company?.postal_code || "";

    setText(els.formTitle, "Editar ficha");
    show(els.btnCancelEdit);
    setInlineMessage(els.formMsg, "");
    navigateTo("create");
  }

  function collectCustomerFormPayload() {
    const customerPayload = {
      first_name: normalize(els.firstName?.value),
      last_name: normalize(els.lastName?.value),
      phone: normalize(els.phone?.value),
      address: normalize(els.address?.value),
      is_company: !!els.isCompany?.checked,
    };

    const companyOn = !!els.isCompany?.checked;

    const companyPayload = {
      cif: normalize(els.cif?.value),
      business_name: normalize(els.businessName?.value),
      address: normalize(els.companyAddress?.value),
      city: normalize(els.city?.value),
      province: normalize(els.province?.value),
      postal_code: normalize(els.postalCode?.value),
    };

    return { customerPayload, companyPayload, companyOn };
  }

  function validateCustomerForm() {
    const { customerPayload, companyPayload, companyOn } = collectCustomerFormPayload();

    if (!customerPayload.first_name) {
      return "El nombre es obligatorio.";
    }

    if (!customerPayload.last_name) {
      return "Los apellidos son obligatorios.";
    }

    if (companyOn) {
      if (!companyPayload.cif) return "El CIF es obligatorio si es empresa.";
      if (!companyPayload.business_name) return "La razón social es obligatoria si es empresa.";
      if (!companyPayload.address) return "La dirección de empresa es obligatoria.";
      if (!companyPayload.city) return "La ciudad es obligatoria.";
      if (!companyPayload.province) return "La provincia es obligatoria.";
      if (!companyPayload.postal_code) return "El código postal es obligatorio.";
    }

    return "";
  }

  function isDuplicatedCustomerCandidate(customerPayload, companyPayload, editingCustomerId = null) {
    const phoneComparable = toPhoneComparable(customerPayload.phone);
    const fullNameComparable = buildSearchHaystack([
      customerPayload.first_name,
      customerPayload.last_name,
    ]);

    const cifComparable = normalizeLower(companyPayload.cif);
    const businessComparable = normalizeLower(companyPayload.business_name);

    return state.customers.some((customer) => {
      if (editingCustomerId && customer.id === editingCustomerId) return false;

      const company = state.companyMapByCustomerId.get(customer.id) || null;

      const samePhone =
        phoneComparable &&
        toPhoneComparable(customer.phone) &&
        toPhoneComparable(customer.phone) === phoneComparable;

      const sameName =
        fullNameComparable &&
        buildSearchHaystack([customer.first_name, customer.last_name]) === fullNameComparable;

      const sameCif =
        cifComparable &&
        normalizeLower(company?.cif) &&
        normalizeLower(company?.cif) === cifComparable;

      const sameBusiness =
        businessComparable &&
        normalizeLower(company?.business_name) &&
        normalizeLower(company?.business_name) === businessComparable;

      return samePhone || sameName || sameCif || sameBusiness;
    });
  }

async function saveCustomerForm(event) {
  event.preventDefault();

  const validationError = validateCustomerForm();
  if (validationError) {
    setInlineMessage(els.formMsg, validationError, "error");
    return;
  }

  const { customerPayload, companyPayload, companyOn } = collectCustomerFormPayload();

  if (isDuplicatedCustomerCandidate(customerPayload, companyPayload, state.editingCustomerId)) {
    setInlineMessage(
      els.formMsg,
      "Ya existe una ficha con datos muy parecidos. Revisa antes de guardar para evitar duplicados.",
      "warning"
    );
    return;
  }

  setDisabled(els.customerForm, true);
  setInlineMessage(els.formMsg, "Guardando...", "muted");

  try {
    if (!navigator.onLine) {
      await offlineAdd({
        kind: "customer_save",
        customerPayload,
        companyPayload,
        companyOn,
        editingCustomerId: state.editingCustomerId,
      });

      resetCustomerForm({ preservePanel: true });
      await updateOfflineCounter();
      showToast("Guardado en modo offline. Se sincronizará cuando vuelva internet.", "warning");
      await fetchCustomersAndCompanies().catch(() => {});
      renderAllCoreViews();
      return;
    }

    let savedCustomerId = state.editingCustomerId || null;

    if (!savedCustomerId) {
      const { data, error } = await withTimeout(
        supabase.from("customers").insert(customerPayload).select("id").single(),
        12000
      );
      if (error) throw error;
      savedCustomerId = data.id;
    } else {
      const { error } = await withTimeout(
        supabase.from("customers").update(customerPayload).eq("id", savedCustomerId),
        12000
      );
      if (error) throw error;
    }

    if (companyOn) {
      const { error: deleteCompanyError } = await withTimeout(
        supabase.from("companies").delete().eq("customer_id", savedCustomerId),
        12000
      );
      if (deleteCompanyError) throw deleteCompanyError;

      const { error: insertCompanyError } = await withTimeout(
        supabase.from("companies").insert({
          ...companyPayload,
          customer_id: savedCustomerId,
        }),
        12000
      );
      if (insertCompanyError) throw insertCompanyError;
    } else {
      const { error } = await withTimeout(
        supabase.from("companies").delete().eq("customer_id", savedCustomerId),
        12000
      );
      if (error) throw error;
    }

    await fetchCustomersAndCompanies();
    renderAllCoreViews();

    if (savedCustomerId) {
      state.currentDetailCustomerId = savedCustomerId;
    }

    resetCustomerForm({ preservePanel: true });
    setInlineMessage(els.formMsg, "Ficha guardada correctamente.", "success");
    showToast("Ficha guardada correctamente.", "success");
  } catch (error) {
    console.error(error);
    setInlineMessage(
      els.formMsg,
      error?.message || "No se pudo guardar la ficha.",
      "error"
    );
  } finally {
    setDisabled(els.customerForm, false);
  }
}

async function deleteCurrentCustomer() {
  const customerId = state.currentDetailCustomerId || state.editingCustomerId;

  if (!customerId) {
    showToast("No hay ninguna ficha seleccionada.", "warning");
    return;
  }

  const customer = state.customerMap.get(customerId) || null;
  const customerName = customer
    ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
    : "esta ficha";

  const confirmed = window.confirm(
    `¿Seguro que quieres eliminar ${customerName || "esta ficha"}? Esta acción no se puede deshacer.`
  );

  if (!confirmed) return;

  try {
    const customerTx = state.transactions.filter((tx) => tx.customer_id === customerId);

    if (customerTx.length > 0) {
      showToast(
        "No puedes borrar esta ficha porque tiene registros asociados en el historial.",
        "warning",
        4500
      );
      return;
    }

    const attachments = state.attachmentsByCustomerId.get(customerId) || [];

    if (attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.file_path) {
          const { error: storageError } = await withTimeout(
            supabase.storage.from(STORAGE_BUCKET).remove([attachment.file_path]),
            20000
          );
          if (storageError) throw storageError;
        }
      }

      const { error: attachmentsDeleteError } = await withTimeout(
        supabase.from("attachments").delete().eq("customer_id", customerId),
        12000
      );
      if (attachmentsDeleteError) throw attachmentsDeleteError;
    }

    const { error: companyDeleteError } = await withTimeout(
      supabase.from("companies").delete().eq("customer_id", customerId),
      12000
    );
    if (companyDeleteError) throw companyDeleteError;

    const { error: customerDeleteError } = await withTimeout(
      supabase.from("customers").delete().eq("id", customerId),
      12000
    );
    if (customerDeleteError) throw customerDeleteError;

    state.currentDetailCustomerId = null;
    state.editingCustomerId = null;
    state.selectedUploadFile = null;

    clearSelectedFile();

    await fetchCustomersAndCompanies();
    renderAllCoreViews();
    navigateTo("search");

    showToast("Ficha eliminada correctamente.", "success");
  } catch (error) {
    console.error(error);
    showToast(error?.message || "No se pudo eliminar la ficha.", "error", 4500);
  }
}


  // =========================================
  // CUSTOMER SEARCH / AZ PANEL
  // =========================================
  function getEnrichedCustomers() {
    return state.customers.map((customer) => ({
      customer,
      company: state.companyMapByCustomerId.get(customer.id) || null,
      displayName: customerDisplayName(customer, state.companyMapByCustomerId.get(customer.id) || null),
      haystack: buildSearchHaystack([
        customer.first_name,
        customer.last_name,
        customer.phone,
        customer.address,
        state.companyMapByCustomerId.get(customer.id)?.business_name,
        state.companyMapByCustomerId.get(customer.id)?.cif,
        state.companyMapByCustomerId.get(customer.id)?.city,
        state.companyMapByCustomerId.get(customer.id)?.province,
      ]),
    }));
  }

  function filterCustomersByText(text) {
    const needle = normalizeLower(text);
    const enriched = getEnrichedCustomers();

    const filtered = !needle
      ? enriched
      : enriched.filter((row) => row.haystack.includes(needle));

    return sortByTextAsc(filtered, (row) => row.displayName);
  }

  function renderCustomerAzPanel() {
    if (!els.azCustomersCreate) return;

    const text = normalize(els.createPanelQuickFilter?.value);
    const results = filterCustomersByText(text).slice(0, CUSTOMER_PANEL_LIMIT);

    if (!results.length) {
      setHTML(els.azCustomersCreate, "");
      show(els.azCustomersCreateEmpty);
      return;
    }

    hide(els.azCustomersCreateEmpty);

    setHTML(
      els.azCustomersCreate,
      results
        .map(({ customer, company, displayName }) => {
          const subtitle = customer.is_company
            ? companyDisplayLine(company)
            : [customer.phone, customer.address].filter(Boolean).join(" · ") || "Cliente particular";

          return `
            <article class="list-item">
              <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(displayName)}</div>
                <div class="list-item-subtitle">${escapeHtml(subtitle)}</div>
              </div>

              <div class="list-item-actions">
                <button class="btn btn-ghost" type="button" data-open-customer="${escapeHtml(customer.id)}">
                  Abrir
                </button>
                <button class="btn btn-primary" type="button" data-edit-customer="${escapeHtml(customer.id)}">
                  Editar
                </button>
              </div>
            </article>
          `;
        })
        .join("")
    );
  }

  function renderSearchResults() {
    if (!els.searchList) return;

    const query = normalize(els.searchInput?.value);
    const rows = filterCustomersByText(query).slice(0, SEARCH_LIMIT);

    setText(els.searchCount, String(rows.length));

    if (!rows.length) {
      setHTML(els.searchList, "");
      show(els.searchEmpty);
      return;
    }

    hide(els.searchEmpty);

    setHTML(
      els.searchList,
      rows
        .map(({ customer, company, displayName }) => {
          const tags = [];
          if (customer.is_company) tags.push(`<span class="pill primary">Empresa</span>`);
          if (customer.phone) tags.push(`<span class="pill">${escapeHtml(customer.phone)}</span>`);
          if (company?.cif) tags.push(`<span class="pill">${escapeHtml(company.cif)}</span>`);

          const subtitle = customer.is_company
            ? companyDisplayLine(company)
            : [customer.address, company?.city].filter(Boolean).join(" · ") || "Cliente particular";

          return `
            <article class="list-item">
              <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(displayName)}</div>
                <div class="list-item-subtitle">${escapeHtml(subtitle)}</div>
                <div class="list-item-meta">${tags.join("")}</div>
              </div>

              <div class="list-item-actions">
                <button class="btn btn-ghost" type="button" data-open-customer="${escapeHtml(customer.id)}">
                  Abrir
                </button>
                <button class="btn btn-primary" type="button" data-edit-customer="${escapeHtml(customer.id)}">
                  Editar
                </button>
              </div>
            </article>
          `;
        })
        .join("")
    );
  }

  function renderCompaniesList() {
    if (!els.companiesList) return;

    const filterText = normalizeLower(els.companiesFilter?.value);

    const rows = state.customers
      .filter((customer) => customer.is_company)
      .map((customer) => ({
        customer,
        company: state.companyMapByCustomerId.get(customer.id) || null,
      }))
      .filter(({ company, customer }) => {
        const haystack = buildSearchHaystack([
          company?.business_name,
          company?.cif,
          company?.city,
          company?.province,
          customer.first_name,
          customer.last_name,
          customer.phone,
        ]);

        return !filterText || haystack.includes(filterText);
      });

    const sorted = sortByTextAsc(rows, ({ company, customer }) =>
      company?.business_name || `${customer.last_name} ${customer.first_name}`
    ).slice(0, COMPANY_LIMIT);

    if (!sorted.length) {
      setHTML(els.companiesList, "");
      show(els.companiesEmpty);
      return;
    }

    hide(els.companiesEmpty);

    setHTML(
      els.companiesList,
      sorted
        .map(({ customer, company }) => {
          const title = company?.business_name || customerDisplayName(customer, company);
          const subtitle = [
            company?.cif ? `CIF: ${company.cif}` : "",
            company?.city || "",
            company?.province || "",
            customer.phone || "",
          ]
            .filter(Boolean)
            .join(" · ");

          return `
            <article class="list-item">
              <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(title)}</div>
                <div class="list-item-subtitle">${escapeHtml(subtitle || "Empresa")}</div>
                <div class="list-item-meta">
                  <span class="pill primary">Empresa</span>
                </div>
              </div>

              <div class="list-item-actions">
                <button class="btn btn-ghost" type="button" data-open-customer="${escapeHtml(customer.id)}">
                  Abrir
                </button>
                <button class="btn btn-primary" type="button" data-edit-customer="${escapeHtml(customer.id)}">
                  Editar
                </button>
              </div>
            </article>
          `;
        })
        .join("")
    );
  }

  // =========================================
  // DETAIL PANEL
  // =========================================
  function openCustomerDetail(customerId) {
    if (!customerId) return;
    state.currentDetailCustomerId = customerId;
    navigateTo("detail");
    renderDetailPanel();
    renderClientHistory();
    fetchAttachmentsForCustomer(customerId)
      .then(() => renderAttachments())
      .catch((error) => {
        console.error(error);
        renderAttachments();
      });
  }

  function renderDetailPanel() {
    if (!els.detailInfo) return;

    const customerId = state.currentDetailCustomerId;
    const customer = customerId ? state.customerMap.get(customerId) : null;

    if (!customer) {
      setText(els.detailTitle, "Ficha");
      setText(els.detailSubtitle, "");
      setHTML(
        els.detailInfo,
        `<div class="empty-box">Selecciona una ficha para ver su detalle.</div>`
      );
      renderAttachments();
      renderClientHistory();
      return;
    }

    const company = state.companyMapByCustomerId.get(customerId) || null;

    setText(els.detailTitle, customerDisplayName(customer, company));
    setText(
      els.detailSubtitle,
      customer.is_company ? "Ficha de empresa" : "Ficha de cliente"
    );

    const blocks = [
      {
        label: "Nombre",
        value: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "—",
      },
      {
        label: "Teléfono",
        value: customer.phone || "—",
      },
      {
        label: "Dirección",
        value: customer.address || "—",
      },
      {
        label: "Creado",
        value: formatDateTime(customer.created_at),
      },
    ];

    if (customer.is_company) {
      blocks.push(
        { label: "Razón social", value: company?.business_name || "—" },
        { label: "CIF", value: company?.cif || "—" },
        { label: "Dirección empresa", value: company?.address || "—" },
        { label: "Ciudad", value: company?.city || "—" },
        { label: "Provincia", value: company?.province || "—" },
        { label: "CP", value: company?.postal_code || "—" }
      );
    }

    setHTML(
      els.detailInfo,
      blocks
        .map(
          (block) => `
            <div class="detail-block">
              <span class="detail-label">${escapeHtml(block.label)}</span>
              <div class="detail-value">${escapeHtml(block.value)}</div>
            </div>
          `
        )
        .join("")
    );

    renderAttachments();
    renderClientHistory();
  }

  // =========================================
  // ATTACHMENTS
  // =========================================
  function updateSelectedFileUI() {
    const hasFile = !!state.selectedUploadFile;
    toggle(els.selectedFileBox, hasFile);
    if (els.selectedFileName) {
      els.selectedFileName.value = hasFile ? state.selectedUploadFile.name : "";
    }
  }

  function clearSelectedFile() {
    state.selectedUploadFile = null;
    if (els.fileInput) {
      els.fileInput.value = "";
    }
    updateSelectedFileUI();
  }

  function buildAttachmentStoragePath(customerId, fileName) {
    const safeName = normalize(fileName).replace(/[^\w.\-]+/g, "_");
    return `${customerId}/${Date.now()}_${safeName}`;
  }

  async function uploadSelectedAttachment() {
    const customerId = state.currentDetailCustomerId;
    if (!customerId) {
      showToast("Selecciona primero una ficha.", "warning");
      return;
    }

    if (!state.selectedUploadFile) {
      showToast("Selecciona un archivo antes de subirlo.", "warning");
      return;
    }

    setDisabled(els.btnUpload, true);

    try {
      const file = state.selectedUploadFile;
      const filePath = buildAttachmentStoragePath(customerId, file.name);

      const { error: uploadError } = await withTimeout(
        supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, {
          upsert: false,
        }),
        20000
      );

      if (uploadError) throw uploadError;

      const payload = {
        customer_id: customerId,
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type || "application/octet-stream",
      };

      const { error: insertError } = await withTimeout(
        supabase.from("attachments").insert(payload),
        12000
      );

      if (insertError) throw insertError;

      clearSelectedFile();
      await fetchAttachmentsForCustomer(customerId);
      renderAttachments();
      showToast("Archivo subido correctamente.", "success");
    } catch (error) {
      console.error(error);
      showToast(error?.message || "No se pudo subir el archivo.", "error", 4000);
    } finally {
      setDisabled(els.btnUpload, false);
    }
  }

  async function deleteAttachment(attachmentId) {
    const customerId = state.currentDetailCustomerId;
    const attachments = state.attachmentsByCustomerId.get(customerId) || [];
    const attachment = attachments.find((row) => row.id === attachmentId);

    if (!attachment) return;

    const confirmed = window.confirm(`¿Seguro que quieres eliminar "${attachment.file_name}"?`);
    if (!confirmed) return;

    try {
      const { error: storageError } = await withTimeout(
        supabase.storage.from(STORAGE_BUCKET).remove([attachment.file_path]),
        20000
      );

      if (storageError) throw storageError;

      const { error: rowError } = await withTimeout(
        supabase.from("attachments").delete().eq("id", attachmentId),
        12000
      );

      if (rowError) throw rowError;

      await fetchAttachmentsForCustomer(customerId);
      renderAttachments();
      showToast("Adjunto eliminado correctamente.", "success");
    } catch (error) {
      console.error(error);
      showToast(error?.message || "No se pudo eliminar el adjunto.", "error", 4000);
    }
  }

  async function openAttachment(attachmentId) {
    const customerId = state.currentDetailCustomerId;
    const attachments = state.attachmentsByCustomerId.get(customerId) || [];
    const attachment = attachments.find((row) => row.id === attachmentId);

    if (!attachment?.file_path) return;

    try {
      const { data, error } = await withTimeout(
        supabase.storage.from(STORAGE_BUCKET).createSignedUrl(attachment.file_path, 60),
        12000
      );

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error(error);
      showToast("No se pudo abrir el adjunto.", "error");
    }
  }

  function renderAttachments() {
    const customerId = state.currentDetailCustomerId;

    if (!customerId || !state.customerMap.get(customerId)) {
      setHTML(els.attachmentsList, "");
      show(els.attachmentsEmpty);
      return;
    }

    const attachments = uniqueBy(
      state.attachmentsByCustomerId.get(customerId) || [],
      (row) => row.id
    );

    if (!attachments.length) {
      setHTML(els.attachmentsList, "");
      show(els.attachmentsEmpty);
      return;
    }

    hide(els.attachmentsEmpty);

    setHTML(
      els.attachmentsList,
      attachments
        .map(
          (attachment) => `
            <article class="list-item">
              <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(attachment.file_name || "Archivo")}</div>
                <div class="list-item-subtitle">
                  ${escapeHtml(attachment.mime_type || "Tipo desconocido")} ·
                  ${escapeHtml(formatDateTime(attachment.created_at))}
                </div>
              </div>

              <div class="list-item-actions">
                <button class="btn btn-ghost" type="button" data-open-attachment="${escapeHtml(attachment.id)}">
                  Abrir
                </button>
                <button class="btn btn-danger" type="button" data-delete-attachment="${escapeHtml(attachment.id)}">
                  Eliminar
                </button>
              </div>
            </article>
          `
        )
        .join("")
    );
  }

  // =========================================
  // CLIENT HISTORY (detail)
  // =========================================
  function setClientHistoryKind(kind) {
    if (!TX_KINDS.includes(kind)) return;
    state.currentDetailHistoryKind = kind;

    for (const btn of els.clientHistoryTabs) {
      btn.classList.toggle("is-active", btn.dataset.chtab === kind);
    }

    renderClientHistory();
  }

  function getTransactionsForCustomer(customerId, kind = "") {
    return state.transactions.filter((tx) => {
      const matchCustomer = tx.customer_id === customerId;
      const matchKind = !kind || tx.kind === kind;
      return matchCustomer && matchKind;
    });
  }

  function renderClientHistory() {
    if (!els.clientHistoryList) return;

    const customerId = state.currentDetailCustomerId;
    if (!customerId) {
      setHTML(els.clientHistoryList, "");
      show(els.clientHistoryEmpty);
      return;
    }

    const rows = sortByDateDesc(
      getTransactionsForCustomer(customerId, state.currentDetailHistoryKind),
      "tx_date"
    ).slice(0, CLIENT_HISTORY_LIMIT);

    if (!rows.length) {
      setHTML(els.clientHistoryList, "");
      show(els.clientHistoryEmpty);
      return;
    }

    hide(els.clientHistoryEmpty);

    setHTML(
      els.clientHistoryList,
      rows
        .map((tx) => {
          const total =
            tx.kind === "nico"
              ? clampMoney(tx.amount_paid || tx.total_amount || 0)
              : clampMoney(tx.total_amount || 0);

          const meta = [
            `<span class="pill primary">${escapeHtml(transactionKindLabel(tx.kind))}</span>`,
            `<span class="pill">${escapeHtml(formatDate(tx.tx_date))}</span>`,
            tx.payment_method
              ? `<span class="pill">${escapeHtml(paymentMethodLabel(tx.payment_method))}</span>`
              : "",
            `<span class="pill success">${escapeHtml(euro(total))}</span>`,
          ]
            .filter(Boolean)
            .join("");

          return `
            <article class="list-item">
              <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(tx.comments || "Registro")}</div>
                <div class="list-item-subtitle">
                  ${escapeHtml(tx.kind === "nico" ? (tx.comments || tx.nico_amount || "Nico") : "Venta / reparación")}
                </div>
                <div class="list-item-meta">${meta}</div>
              </div>

              <div class="list-item-actions">
                <button class="btn btn-ghost" type="button" data-open-registry-tx="${escapeHtml(tx.id)}">
                  Ver en registro
                </button>
              </div>
            </article>
          `;
        })
        .join("")
    );
  }

  // =========================================
  // GENERIC ACTION DISPATCH
  // =========================================
  function handleGlobalClick(event) {
    const target = event.target.closest("button");
    if (!target) return;

    const openCustomerId = target.dataset.openCustomer;
    if (openCustomerId) {
      openCustomerDetail(openCustomerId);
      return;
    }

    const editCustomerId = target.dataset.editCustomer;
    if (editCustomerId) {
      fillCustomerForm(editCustomerId);
      return;
    }

    const openAttachmentId = target.dataset.openAttachment;
    if (openAttachmentId) {
      openAttachment(openAttachmentId).catch(console.error);
      return;
    }

    const deleteAttachmentId = target.dataset.deleteAttachment;
    if (deleteAttachmentId) {
      deleteAttachment(deleteAttachmentId).catch(console.error);
      return;
    }

    if (target.dataset.openRegistryTx) {
      // La apertura exacta del registro se termina en la PARTE 2.
      navigateTo("registry");
      showToast("Abriendo registro...", "success", 1200);
      return;
    }
  }

  // =========================================
  // EVENTS BASE
  // =========================================
  function bindBaseEvents() {
    els.btnLogin?.addEventListener("click", doLogin);

    els.loginPassword?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        doLogin();
      }
    });

    els.btnLogout?.addEventListener("click", doLogout);

    els.btnNavBack?.addEventListener("click", navigateBack);
    els.btnNavForward?.addEventListener("click", navigateForward);

    els.navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.nav;
        if (target) navigateTo(target);
      });
    });

    els.tileButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.nav;
        if (target) navigateTo(target);
      });
    });

    els.isCompany?.addEventListener("change", setCompanyBoxVisibility);
    els.customerForm?.addEventListener("submit", saveCustomerForm);

    els.btnCancelEdit?.addEventListener("click", () => {
      resetCustomerForm({ preservePanel: true });
    });

    els.btnResetCustomerForm?.addEventListener("click", () => {
      resetCustomerForm({ preservePanel: true });
    });

    els.createPanelQuickFilter?.addEventListener(
      "input",
      debounce(() => {
        renderCustomerAzPanel();
      }, 180)
    );

    els.searchInput?.addEventListener(
      "input",
      debounce(() => {
        renderSearchResults();
      }, 180)
    );

    els.companiesFilter?.addEventListener(
      "input",
      debounce(() => {
        renderCompaniesList();
      }, 180)
    );

    els.btnEditFromDetail?.addEventListener("click", () => {
      if (state.currentDetailCustomerId) {
        fillCustomerForm(state.currentDetailCustomerId);
      }
    });

    els.btnBackFromDetail?.addEventListener("click", () => {
      navigateBack();
    });

    els.btnDeleteCustomer?.addEventListener("click", deleteCurrentCustomer);
els.btnDeleteFromDetail?.addEventListener("click", deleteCurrentCustomer);

    els.fileInput?.addEventListener("change", () => {
      state.selectedUploadFile = els.fileInput?.files?.[0] || null;
      updateSelectedFileUI();
    });

    els.btnClearSelected?.addEventListener("click", clearSelectedFile);
    els.btnUpload?.addEventListener("click", uploadSelectedAttachment);

    els.clientHistoryTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        setClientHistoryKind(btn.dataset.chtab);
      });
    });

    els.btnClientHistoryOpenRegistry?.addEventListener("click", () => {
      if (!state.currentDetailCustomerId) return;
      state.registry.openFromDetailCustomerId = state.currentDetailCustomerId;
      navigateTo("registry");
    });

    els.btnOfflineExport?.addEventListener("click", exportOfflineBackup);

    document.addEventListener("click", handleGlobalClick);

    window.addEventListener("online", async () => {
      updateNetStatusUI();
      await syncOfflineQueue().catch(console.error);
    });

    window.addEventListener("offline", updateNetStatusUI);

    supabase.auth.onAuthStateChange((event, session) => {
  state.session = session || null;
  state.user = session?.user || null;
  updateSessionUI();

  if (event === "SIGNED_OUT") {
    state.authReady = false;
    return;
  }

  if (!session) {
    return;
  }

  if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") {
    return;
  }

  if (state.authReady && event === "INITIAL_SESSION") {
    return;
  }

  state.authReady = true;

  queueMicrotask(() => {
    bootstrapDataAfterAuth().catch((error) => {
      console.error("Error cargando datos tras recuperar sesión:", error);
    });
  });
});
  }

  // =========================================
  // INITIAL BOOTSTRAP
  // =========================================
  async function init() {
    updateNetStatusUI();
    updateSelectedFileUI();
    updateNavArrows();
    setCompanyBoxVisibility();
    setClientHistoryKind("ticket");
    showPanel("home", { pushHistory: false, clearForward: false });
    bindBaseEvents();
    await updateOfflineCounter();
    await checkExistingSession();
  }

  init().catch((error) => {
    console.error("Error al iniciar la app:", error);
    showToast("Error al iniciar la aplicación.", "error", 5000);
  });

  // =========================================
  // PARTE 2 CONTINÚA DESDE AQUÍ
  // =========================================
    // =========================================
  // REGISTRY HELPERS
  // =========================================
  function setRegistryKind(kind) {
    if (!TX_KINDS.includes(kind)) return;

    state.registry.currentKind = kind;

    for (const btn of els.regTabButtons) {
      btn.classList.toggle("is-active", btn.dataset.regtab === kind);
    }

    const isNico = kind === "nico";
    toggle(els.txNicoBox, isNico);
    toggle(els.txItemsBox, !isNico);

    if (els.txFormTitle) {
      const mode = state.registry.editingTxId ? "Editar" : "Nueva";
      els.txFormTitle.textContent = `${mode} ficha de ${transactionKindLabel(kind)}`;
    }

    if (!state.registry.editingTxId) {
      if (isNico) {
        ensureNicoDefaults();
      } else if (!state.registry.draftItems.length) {
        addDraftItem();
      }
    }

    renderTxDraftItems();
    renderRegistryList();
  }

  function ensureNicoDefaults() {
    if (els.txDate && !els.txDate.value) {
      els.txDate.value = todayISO();
    }
  }

  function createEmptyDraftItem() {
    return {
      id: uuidLike(),
      concept: "",
      amount: "",
    };
  }

  function addDraftItem(item = null) {
    state.registry.draftItems.push(
      item
        ? {
            id: item.id || uuidLike(),
            concept: normalize(item.concept),
            amount:
              item.amount === null || item.amount === undefined
                ? ""
                : String(item.amount),
          }
        : createEmptyDraftItem()
    );
    renderTxDraftItems();
  }

  function removeDraftItem(itemId) {
    state.registry.draftItems = state.registry.draftItems.filter(
      (item) => item.id !== itemId
    );

    if (!state.registry.draftItems.length && state.registry.currentKind !== "nico") {
      state.registry.draftItems = [createEmptyDraftItem()];
    }

    renderTxDraftItems();
  }

  function updateDraftItem(itemId, patch, { rerender = false } = {}) {
    let changed = false;

    state.registry.draftItems = state.registry.draftItems.map((item) => {
      if (item.id !== itemId) return item;
      changed = true;
      return { ...item, ...patch };
    });

    if (!changed) return;

    if (rerender) {
      renderTxDraftItems();
      return;
    }

    if (state.registry.currentKind !== "nico") {
      setText(els.txTotal, euro(getDraftItemsTotal()));
    }
  }

  function getDraftItemsSanitized() {
    return state.registry.draftItems
      .map((item) => ({
        concept: normalize(item.concept),
        amount: clampMoney(item.amount),
      }))
      .filter((item) => item.concept || item.amount > 0);
  }

  function getDraftItemsTotal() {
    return getDraftItemsSanitized().reduce((sum, item) => sum + clampMoney(item.amount), 0);
  }

  function renderTxDraftItems() {
    if (!els.txItems || !els.txTotal) return;

    const isNico = state.registry.currentKind === "nico";

    if (isNico) {
      setText(els.txTotal, euro(clampMoney(els.nicoPaid?.value || 0)));
      hide(els.txItemsEmpty);
      setHTML(els.txItems, "");
      return;
    }

    const items = state.registry.draftItems;
    const safeItems = items.length ? items : [createEmptyDraftItem()];

    if (!items.length) {
      state.registry.draftItems = safeItems;
    }

    if (!safeItems.length) {
      show(els.txItemsEmpty);
      setHTML(els.txItems, "");
      setText(els.txTotal, euro(0));
      return;
    }

    hide(els.txItemsEmpty);

    setHTML(
      els.txItems,
      safeItems
        .map(
          (item, index) => `
            <div class="item-row" data-item-row="${escapeHtml(item.id)}">
              <div class="field">
                <label>Concepto ${index + 1}</label>
                <input
                  type="text"
                  value="${escapeHtml(item.concept || "")}"
                  data-item-concept="${escapeHtml(item.id)}"
                  placeholder="Ej: Cambio de pantalla, reparación, accesorio..."
                />
              </div>

              <div class="field">
                <label>Importe (€)</label>
                <input
                  type="number"
                  step="0.01"
                  inputmode="decimal"
                  value="${escapeHtml(item.amount || "")}"
                  data-item-amount="${escapeHtml(item.id)}"
                  placeholder="0.00"
                />
              </div>

              <button
                class="btn btn-danger"
                type="button"
                data-remove-item="${escapeHtml(item.id)}"
                ${safeItems.length === 1 ? "disabled" : ""}
              >
                Eliminar
              </button>
            </div>
          `
        )
        .join("")
    );

    setText(els.txTotal, euro(getDraftItemsTotal()));
  }

  function bindDraftItemsDelegation() {
    els.txItems?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      const conceptId = target.dataset.itemConcept;
      if (conceptId) {
        updateDraftItem(conceptId, { concept: target.value }, { rerender: false });
        return;
      }

      const amountId = target.dataset.itemAmount;
      if (amountId) {
        updateDraftItem(amountId, { amount: target.value }, { rerender: false });
      }
    });

    els.txItems?.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      const removeId = button.dataset.removeItem;
      if (removeId) {
        removeDraftItem(removeId);
      }
    });
  }

  function setSelectedTxCustomer(customerId) {
    state.registry.selectedCustomerId = customerId || null;

    const customer = customerId ? state.customerMap.get(customerId) : null;
    const company = customerId ? state.companyMapByCustomerId.get(customerId) || null : null;

    setText(
      els.txCustomerSelected,
      customer ? customerDisplayName(customer, company) : "—"
    );

    const miniItems = [...(els.txCustomerResults?.children || [])];
    miniItems.forEach((item) => {
      item.classList.toggle("is-selected", item.dataset.customerPick === customerId);
    });
  }

  function resetTxForm({ keepKind = true, keepOpen = false } = {}) {
    const prevKind = state.registry.currentKind;

    state.registry.editingTxId = null;
    state.registry.selectedCustomerId = null;
    state.registry.draftItems = [];

    setText(els.txMsg, "");
    setInlineMessage(els.txMsg, "");
    hide(els.btnTxDelete);

    if (els.txCustomerSearch) els.txCustomerSearch.value = "";
    if (els.txDate) els.txDate.value = todayISO();
    if (els.txPayment) els.txPayment.value = "";
    if (els.txComments) els.txComments.value = "";

    if (els.nicoConcept) els.nicoConcept.value = "";
    if (els.nicoMaterial) els.nicoMaterial.value = "";
    if (els.nicoTotal) els.nicoTotal.value = "";
    if (els.nicoForNico) els.nicoForNico.value = "";
    if (els.nicoForFlopitec) els.nicoForFlopitec.value = "";
    if (els.nicoPaid) els.nicoPaid.value = "";
    if (els.nicoNotes) els.nicoNotes.value = "";

    setSelectedTxCustomer(null);
    setHTML(els.txCustomerResults, "");

    if (keepKind) {
      if (prevKind === "nico") {
        ensureNicoDefaults();
      } else {
        state.registry.draftItems = [createEmptyDraftItem()];
      }
      setRegistryKind(prevKind);
    } else {
      state.registry.currentKind = "ticket";
      state.registry.draftItems = [createEmptyDraftItem()];
      setRegistryKind("ticket");
    }

    if (!keepOpen) {
      hide(els.txFormBox);
    } else {
      show(els.txFormBox);
    }
  }

  function openNewTxForm(kind = null) {
    resetTxForm({ keepKind: true, keepOpen: true });

    if (kind && TX_KINDS.includes(kind)) {
      state.registry.currentKind = kind;
    }

    if (state.registry.openFromDetailCustomerId) {
      setSelectedTxCustomer(state.registry.openFromDetailCustomerId);
    }

    setRegistryKind(state.registry.currentKind);
    show(els.txFormBox);
    if (els.txCustomerSearch) {
      els.txCustomerSearch.focus();
    }
  }

  function txMatchesOpenFromDetail(tx) {
    return (
      state.registry.openFromDetailCustomerId &&
      tx.customer_id === state.registry.openFromDetailCustomerId
    );
  }

  function buildTransactionClientFingerprint(tx, items = []) {
    if (!tx) return "";
    const base = [
      tx.kind,
      tx.customer_id,
      tx.tx_date,
      clampMoney(tx.total_amount),
      normalizeLower(tx.payment_method),
      normalizeLower(tx.comments),
    ].join("|");

    const itemsPart = (items || [])
      .map((item) => `${normalizeLower(item.concept)}:${clampMoney(item.amount)}`)
      .sort()
      .join("|");

    const nicoPart =
      tx.kind === "nico"
        ? [
            clampMoney(tx.material_cost),
            clampMoney(tx.nico_amount),
            clampMoney(tx.flopitec_amount),
            clampMoney(tx.amount_paid),
          ].join("|")
        : "";

    return `${base}|${itemsPart}|${nicoPart}`;
  }

  function dedupeTransactionsInState() {
    const seen = new Set();
    const uniqueTx = [];

    for (const tx of sortByDateDesc(state.transactions, "created_at")) {
      const items = state.transactionItemsByTxId.get(tx.id) || [];
      const fingerprint = tx.id || buildTransactionClientFingerprint(tx, items);

      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      uniqueTx.push(tx);
    }

    state.transactions = uniqueBy(uniqueTx, (tx) => tx.id);
  }

  // =========================================
  // FETCH REGISTRY DATA
  // =========================================
  async function fetchTransactionsFull() {
    state.loading.registry = true;

    try {
      const [{ data: txData, error: txError }, { data: itemsData, error: itemsError }] =
        await Promise.all([
          withTimeout(
            supabase
              .from("transactions")
              .select("*")
              .order("tx_date", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(REGISTRY_LIMIT),
            18000
          ),
          withTimeout(
            supabase
              .from("transaction_items")
              .select("*")
              .order("created_at", { ascending: true }),
            18000
          ),
        ]);

      if (txError) throw txError;
      if (itemsError) throw itemsError;

      state.transactions = uniqueBy(safeArray(txData), (row) => row.id);

      const itemsMap = new Map();
      for (const item of uniqueBy(safeArray(itemsData), (row) => row.id)) {
        const list = itemsMap.get(item.transaction_id) || [];
        list.push(item);
        itemsMap.set(item.transaction_id, list);
      }
      state.transactionItemsByTxId = itemsMap;

      dedupeTransactionsInState();
      state.registry.txLoadedOnce = true;
    } finally {
      state.loading.registry = false;
    }
  }

  async function ensureTransactionsLoaded() {
    if (!state.registry.txLoadedOnce) {
      await fetchTransactionsFull();
      renderHomeStats();
      renderClientHistory();
    }
  }

  // =========================================
  // CUSTOMER PICKER FOR TX
  // =========================================
  function filterCustomersForTxPicker(text) {
    return filterCustomersByText(text).slice(0, 50);
  }

  function renderTxCustomerSearchResults() {
    const text = normalize(els.txCustomerSearch?.value);
    const results = filterCustomersForTxPicker(text);

    if (!results.length) {
      setHTML(
        els.txCustomerResults,
        text
          ? `<div class="empty-box">No se han encontrado clientes.</div>`
          : ""
      );
      return;
    }

    setHTML(
      els.txCustomerResults,
      results
        .map(({ customer, company, displayName }) => {
          const subtitle = customer.is_company
            ? companyDisplayLine(company)
            : [customer.phone, customer.address].filter(Boolean).join(" · ") || "Cliente particular";

          return `
            <div
              class="mini-item ${
                state.registry.selectedCustomerId === customer.id ? "is-selected" : ""
              }"
              data-customer-pick="${escapeHtml(customer.id)}"
              role="option"
              aria-selected="${state.registry.selectedCustomerId === customer.id ? "true" : "false"}"
            >
              <div class="mini-item-title">${escapeHtml(displayName)}</div>
              <div class="mini-item-subtitle">${escapeHtml(subtitle)}</div>
            </div>
          `;
        })
        .join("")
    );
  }

  function bindTxCustomerPicker() {
    els.txCustomerSearch?.addEventListener(
      "input",
      debounce(() => {
        renderTxCustomerSearchResults();
      }, 160)
    );

    els.txCustomerResults?.addEventListener("click", (event) => {
      const item = event.target.closest("[data-customer-pick]");
      if (!item) return;

      const customerId = item.dataset.customerPick;
      setSelectedTxCustomer(customerId);
      renderTxCustomerSearchResults();
    });

    els.btnTxClearCustomer?.addEventListener("click", () => {
      setSelectedTxCustomer(null);
      renderTxCustomerSearchResults();
    });

    els.btnTxCreateCustomer?.addEventListener("click", () => {
      navigateTo("create");
      resetCustomerForm({ preservePanel: true });
    });
  }

  // =========================================
  // TX COLLECT / VALIDATE
  // =========================================
  function collectNicoPayload() {
    return {
      concept: normalize(els.nicoConcept?.value),
      material_cost: clampMoney(els.nicoMaterial?.value),
      total_amount: clampMoney(els.nicoTotal?.value),
      nico_amount: clampMoney(els.nicoForNico?.value),
      flopitec_amount: clampMoney(els.nicoForFlopitec?.value),
      amount_paid: clampMoney(els.nicoPaid?.value),
      notes: normalize(els.nicoNotes?.value),
    };
  }

  function collectTxPayloadFromForm() {
    const kind = state.registry.currentKind;

    const base = {
      kind,
      customer_id: state.registry.selectedCustomerId,
      tx_date: normalize(els.txDate?.value) || todayISO(),
      payment_method: normalize(els.txPayment?.value) || null,
      comments: normalize(els.txComments?.value),
    };

    if (kind === "nico") {
      const nico = collectNicoPayload();
      return {
        txPayload: {
          ...base,
          comments: [base.comments, nico.notes].filter(Boolean).join(" · "),
          total_amount: clampMoney(nico.total_amount),
          material_cost: clampMoney(nico.material_cost),
          nico_amount: clampMoney(nico.nico_amount),
          flopitec_amount: clampMoney(nico.flopitec_amount),
          amount_paid: clampMoney(nico.amount_paid),
        },
        itemsPayload: nico.concept
          ? [
              {
                concept: nico.concept,
                amount: clampMoney(nico.total_amount),
              },
            ]
          : [],
      };
    }

    const sanitizedItems = getDraftItemsSanitized();

    return {
      txPayload: {
        ...base,
        total_amount: clampMoney(
          sanitizedItems.reduce((sum, item) => sum + clampMoney(item.amount), 0)
        ),
        material_cost: null,
        nico_amount: null,
        flopitec_amount: null,
        amount_paid: null,
      },
      itemsPayload: sanitizedItems,
    };
  }

  function validateTxForm() {
    if (!state.registry.selectedCustomerId) {
      return "Debes seleccionar un cliente.";
    }

    const kind = state.registry.currentKind;
    const date = normalize(els.txDate?.value);

    if (!date) {
      return "La fecha es obligatoria.";
    }

    const paymentMethod = normalize(els.txPayment?.value);
    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
      return "El método de pago no es válido.";
    }

    if (kind === "nico") {
      const nico = collectNicoPayload();

      if (!nico.concept) {
        return "El concepto de Nico es obligatorio.";
      }

      if (nico.total_amount <= 0) {
        return "El importe total de Nico debe ser mayor que 0.";
      }

      if (nico.amount_paid < 0 || nico.material_cost < 0 || nico.nico_amount < 0 || nico.flopitec_amount < 0) {
        return "Los importes de Nico no pueden ser negativos.";
      }

      return "";
    }

    const items = getDraftItemsSanitized();

    if (!items.length) {
      return "Debes añadir al menos una línea con concepto e importe.";
    }

    const hasInvalid = items.some((item) => !item.concept || clampMoney(item.amount) <= 0);
    if (hasInvalid) {
      return "Cada línea debe tener concepto e importe mayor que 0.";
    }

    return "";
  }

  function findPotentialDuplicateTx(txPayload, itemsPayload, editingTxId = null) {
    const incomingFingerprint = buildTransactionClientFingerprint(txPayload, itemsPayload);

    return state.transactions.some((tx) => {
      if (editingTxId && tx.id === editingTxId) return false;

      const txItems = state.transactionItemsByTxId.get(tx.id) || [];
      const fp = buildTransactionClientFingerprint(tx, txItems);
      return fp === incomingFingerprint;
    });
  }

  // =========================================
  // TX SAVE / UPDATE / DELETE
  // =========================================
  async function saveTransactionForm() {
    const validationError = validateTxForm();
    if (validationError) {
      setInlineMessage(els.txMsg, validationError, "error");
      return;
    }

    const { txPayload, itemsPayload } = collectTxPayloadFromForm();
    const editingTxId = state.registry.editingTxId;

    if (findPotentialDuplicateTx(txPayload, itemsPayload, editingTxId)) {
      setInlineMessage(
        els.txMsg,
        "Este registro parece duplicado. Revisa fecha, cliente, conceptos e importe antes de guardarlo.",
        "warning"
      );
      return;
    }

    setDisabled(els.btnTxSave, true);
    setDisabled(els.btnTxDelete, true);
    setInlineMessage(els.txMsg, "Guardando...", "muted");

    try {
      if (!navigator.onLine) {
        await offlineAdd({
          kind: "tx_save",
          editingTxId,
          txPayload,
          itemsPayload,
          clientRequestId: getClientRequestId("tx"),
        });

        await updateOfflineCounter();

        const optimisticTxId = editingTxId || `offline-${uuidLike()}`;
        const optimisticTx = {
          id: optimisticTxId,
          ...txPayload,
          client_request_id: getClientRequestId("local"),
          created_at: new Date().toISOString(),
        };

        state.transactions = state.transactions.filter((tx) => tx.id !== editingTxId);
        state.transactions.unshift(optimisticTx);
        state.transactionItemsByTxId.set(
          optimisticTxId,
          itemsPayload.map((item) => ({
            id: uuidLike(),
            transaction_id: optimisticTxId,
            concept: item.concept,
            amount: item.amount,
            created_at: new Date().toISOString(),
          }))
        );

        dedupeTransactionsInState();
        renderRegistryList();
        renderHomeStats();
        renderClientHistory();

        resetTxForm({ keepKind: true, keepOpen: false });
        showToast("Registro guardado en modo offline. Se sincronizará al volver internet.", "warning", 4200);
        return;
      }

      let txId = editingTxId || null;
      const clientRequestId =
        editingTxId
          ? null
          : getClientRequestId("tx");

      if (!txId) {
        const { data, error } = await withTimeout(
          supabase
            .from("transactions")
            .insert({
              ...txPayload,
              client_request_id: clientRequestId,
            })
            .select("id")
            .single(),
          18000
        );

        if (error) throw error;
        txId = data.id;
      } else {
        const { error } = await withTimeout(
          supabase
            .from("transactions")
            .update(txPayload)
            .eq("id", txId),
          18000
        );

        if (error) throw error;

        const { error: deleteItemsError } = await withTimeout(
          supabase.from("transaction_items").delete().eq("transaction_id", txId),
          18000
        );

        if (deleteItemsError) throw deleteItemsError;
      }

      if (itemsPayload.length) {
        const rows = itemsPayload.map((item) => ({
          transaction_id: txId,
          concept: item.concept,
          amount: clampMoney(item.amount),
        }));

        const { error: insertItemsError } = await withTimeout(
          supabase.from("transaction_items").insert(rows),
          18000
        );

        if (insertItemsError) throw insertItemsError;
      }

      await fetchTransactionsFull();
      renderRegistryList();
      renderHomeStats();
      renderClientHistory();
      renderAccountingYearOptions();
      renderAccountingView();

      resetTxForm({ keepKind: true, keepOpen: false });
      showToast("Registro guardado correctamente.", "success");
    } catch (error) {
      console.error(error);

      const possibleDuplicate =
        String(error?.message || "").toLowerCase().includes("duplicate") ||
        String(error?.message || "").toLowerCase().includes("client_request_id") ||
        String(error?.message || "").toLowerCase().includes("unique");

      setInlineMessage(
        els.txMsg,
        possibleDuplicate
          ? "Supabase ha detectado una posible duplicidad y no se ha guardado el registro."
          : error?.message || "No se pudo guardar el registro.",
        "error"
      );
    } finally {
      setDisabled(els.btnTxSave, false);
      setDisabled(els.btnTxDelete, !state.registry.editingTxId);
    }
  }

  async function deleteTransaction(txId = null) {
    const id = txId || state.registry.editingTxId;
    if (!id) return;

    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar este registro? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    setDisabled(els.btnTxDelete, true);

    try {
      if (!navigator.onLine) {
        await offlineAdd({
          kind: "tx_delete",
          txId: id,
        });

        state.transactions = state.transactions.filter((tx) => tx.id !== id);
        state.transactionItemsByTxId.delete(id);

        renderRegistryList();
        renderHomeStats();
        renderClientHistory();
        renderAccountingYearOptions();
        renderAccountingView();

        resetTxForm({ keepKind: true, keepOpen: false });
        await updateOfflineCounter();
        showToast("Eliminación guardada en modo offline.", "warning");
        return;
      }

      const { error } = await withTimeout(
        supabase.from("transactions").delete().eq("id", id),
        18000
      );

      if (error) throw error;

      await fetchTransactionsFull();
      renderRegistryList();
      renderHomeStats();
      renderClientHistory();
      renderAccountingYearOptions();
      renderAccountingView();

      resetTxForm({ keepKind: true, keepOpen: false });
      showToast("Registro eliminado correctamente.", "success");
    } catch (error) {
      console.error(error);
      setInlineMessage(
        els.txMsg,
        error?.message || "No se pudo eliminar el registro.",
        "error"
      );
    } finally {
      setDisabled(els.btnTxDelete, !state.registry.editingTxId);
    }
  }

  async function syncOfflineTxSave(operation) {
    if (!operation?.txPayload) {
      throw new Error("Operación offline inválida.");
    }

    const { editingTxId, txPayload, itemsPayload, clientRequestId } = operation;
    let txId = editingTxId || null;

    if (!txId) {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          ...txPayload,
          client_request_id: clientRequestId || getClientRequestId("tx"),
        })
        .select("id")
        .single();

      if (error) throw error;
      txId = data.id;
    } else {
      const { error } = await supabase
        .from("transactions")
        .update(txPayload)
        .eq("id", txId);

      if (error) throw error;

      const { error: deleteItemsError } = await supabase
        .from("transaction_items")
        .delete()
        .eq("transaction_id", txId);

      if (deleteItemsError) throw deleteItemsError;
    }

    if (safeArray(itemsPayload).length) {
      const rows = itemsPayload.map((item) => ({
        transaction_id: txId,
        concept: normalize(item.concept),
        amount: clampMoney(item.amount),
      }));

      const { error } = await supabase.from("transaction_items").insert(rows);
      if (error) throw error;
    }

    await fetchTransactionsFull();
    renderRegistryList();
    renderHomeStats();
    renderClientHistory();
    renderAccountingYearOptions();
    renderAccountingView();
  }

  // =========================================
  // REGISTRY RENDER
  // =========================================
  function getRegistryFilteredTransactions() {
    const kind = state.registry.currentKind;
    const filterText = normalizeLower(els.registryFilterInput?.value);
    const dateFrom = normalize(els.registryDateFrom?.value);
    const dateTo = normalize(els.registryDateTo?.value);

    state.registry.lastFilterText = filterText;
    state.registry.lastDateFrom = dateFrom;
    state.registry.lastDateTo = dateTo;

    let rows = state.transactions.filter((tx) => tx.kind === kind);

    if (state.registry.openFromDetailCustomerId) {
      rows = rows.filter((tx) => tx.customer_id === state.registry.openFromDetailCustomerId);
    }

    if (dateFrom) {
      rows = rows.filter((tx) => String(tx.tx_date || "") >= dateFrom);
    }

    if (dateTo) {
      rows = rows.filter((tx) => String(tx.tx_date || "") <= dateTo);
    }

    if (filterText) {
      rows = rows.filter((tx) => {
        const customer = state.customerMap.get(tx.customer_id);
        const company = state.companyMapByCustomerId.get(tx.customer_id) || null;
        const items = state.transactionItemsByTxId.get(tx.id) || [];

        const haystack = buildSearchHaystack([
          tx.comments,
          tx.payment_method,
          tx.tx_date,
          customer?.first_name,
          customer?.last_name,
          customer?.phone,
          company?.business_name,
          company?.cif,
          ...items.map((item) => item.concept),
        ]);

        return haystack.includes(filterText);
      });
    }

    return sortByDateDesc(rows, "tx_date");
  }

  function renderRegistryList() {
    if (!els.txList) return;

    const rows = getRegistryFilteredTransactions();

    setText(els.txListCount, `${rows.length} resultados`);
    setText(els.registryVisibleCount, String(rows.length));

    const visibleSum = rows.reduce((sum, tx) => {
      const amount =
        tx.kind === "nico"
          ? clampMoney(tx.amount_paid || tx.total_amount || 0)
          : clampMoney(tx.total_amount || 0);
      return sum + amount;
    }, 0);

    setText(els.registryVisibleAmount, euro(visibleSum));

    if (!rows.length) {
      setHTML(els.txList, "");
      show(els.txListEmpty);
      return;
    }

    hide(els.txListEmpty);

    setHTML(
      els.txList,
      rows
        .map((tx) => {
          const customer = state.customerMap.get(tx.customer_id);
          const company = state.companyMapByCustomerId.get(tx.customer_id) || null;
          const items = state.transactionItemsByTxId.get(tx.id) || [];
          const customerName = customerDisplayName(customer, company);
          const total =
            tx.kind === "nico"
              ? clampMoney(tx.amount_paid || tx.total_amount || 0)
              : clampMoney(tx.total_amount || 0);

          const concepts =
            items.length > 0
              ? items
                  .slice(0, 3)
                  .map((item) => item.concept)
                  .filter(Boolean)
                  .join(" · ")
              : tx.comments || "Sin detalle";

          const meta = [
            `<span class="pill primary">${escapeHtml(transactionKindLabel(tx.kind))}</span>`,
            `<span class="pill">${escapeHtml(formatDate(tx.tx_date))}</span>`,
            tx.payment_method
              ? `<span class="pill">${escapeHtml(paymentMethodLabel(tx.payment_method))}</span>`
              : "",
            `<span class="pill success">${escapeHtml(euro(total))}</span>`,
            txMatchesOpenFromDetail(tx)
              ? `<span class="pill warning">Cliente actual</span>`
              : "",
          ]
            .filter(Boolean)
            .join("");

          return `
            <article class="list-item">
              <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(customerName)}</div>
                <div class="list-item-subtitle">${escapeHtml(concepts || "Registro")}</div>
                <div class="list-item-subtitle">${escapeHtml(tx.comments || "")}</div>
                <div class="list-item-meta">${meta}</div>
              </div>

              <div class="list-item-actions">
                <button class="btn btn-ghost" type="button" data-edit-tx="${escapeHtml(tx.id)}">
                  Editar
                </button>
                <button class="btn btn-danger" type="button" data-delete-tx="${escapeHtml(tx.id)}">
                  Eliminar
                </button>
              </div>
            </article>
          `;
        })
        .join("")
    );
  }

  async function openEditTransaction(txId) {
    await ensureTransactionsLoaded();

    const tx = state.transactions.find((row) => row.id === txId);
    if (!tx) {
      showToast("No se ha encontrado el registro.", "error");
      return;
    }

    state.registry.editingTxId = tx.id;
    state.registry.currentKind = tx.kind;

    show(els.txFormBox);
    show(els.btnTxDelete);
    setDisabled(els.btnTxDelete, false);

    setSelectedTxCustomer(tx.customer_id || null);

    if (els.txDate) els.txDate.value = tx.tx_date || todayISO();
    if (els.txPayment) els.txPayment.value = tx.payment_method || "";
    if (els.txComments) els.txComments.value = tx.comments || "";

    if (tx.kind === "nico") {
      toggle(els.txNicoBox, true);
      toggle(els.txItemsBox, false);

      const items = state.transactionItemsByTxId.get(tx.id) || [];
      if (els.nicoConcept) els.nicoConcept.value = items[0]?.concept || "";
      if (els.nicoMaterial) els.nicoMaterial.value = tx.material_cost ?? "";
      if (els.nicoTotal) els.nicoTotal.value = tx.total_amount ?? "";
      if (els.nicoForNico) els.nicoForNico.value = tx.nico_amount ?? "";
      if (els.nicoForFlopitec) els.nicoForFlopitec.value = tx.flopitec_amount ?? "";
      if (els.nicoPaid) els.nicoPaid.value = tx.amount_paid ?? "";
      if (els.nicoNotes) els.nicoNotes.value = "";
    } else {
      toggle(els.txNicoBox, false);
      toggle(els.txItemsBox, true);

      const items = state.transactionItemsByTxId.get(tx.id) || [];
      state.registry.draftItems = items.length
        ? items.map((item) => ({
            id: item.id || uuidLike(),
            concept: item.concept || "",
            amount: String(item.amount ?? ""),
          }))
        : [createEmptyDraftItem()];
    }

    setRegistryKind(tx.kind);
    renderTxDraftItems();
    setInlineMessage(els.txMsg, "");
  }

  // =========================================
  // ACCOUNTING
  // =========================================
  function getAccountingYears() {
    const years = new Set();

    for (const tx of state.transactions) {
      if (!tx?.tx_date) continue;
      const date = parseISODate(tx.tx_date);
      if (!date) continue;
      years.add(date.getFullYear());
    }

    return [...years].sort((a, b) => b - a);
  }

  function renderAccountingYearOptions() {
    if (!els.accountingYear) return;

    const years = getAccountingYears();
    const currentValue = state.accounting.year || String(years[0] || new Date().getFullYear());

    if (!state.accounting.year) {
      state.accounting.year = currentValue;
    }

    setHTML(
      els.accountingYear,
      `
        <option value="">Seleccionar año</option>
        ${years
          .map(
            (year) => `
              <option value="${year}" ${String(year) === String(currentValue) ? "selected" : ""}>
                ${year}
              </option>
            `
          )
          .join("")}
      `
    );
  }

  function setAccountingKind(kind) {
    if (!TX_KINDS.includes(kind)) return;
    state.accounting.kind = kind;

    for (const btn of els.accountingTabButtons) {
      btn.classList.toggle("is-active", btn.dataset.acctab === kind);
    }

    renderAccountingView();
  }

  function getAccountingRows() {
    const year = Number(state.accounting.year);
    const kind = state.accounting.kind;

    if (!year || !kind) return [];

    const rows = state.transactions.filter((tx) => {
      if (tx.kind !== kind || !tx.tx_date) return false;
      const d = parseISODate(tx.tx_date);
      return d && d.getFullYear() === year;
    });

    const monthlyTotals = Array.from({ length: 12 }, (_, monthIndex) => {
      const txs = rows.filter((tx) => {
        const d = parseISODate(tx.tx_date);
        return d && d.getMonth() === monthIndex;
      });

      const monthTotal = txs.reduce((sum, tx) => {
        const amount =
          kind === "nico"
            ? clampMoney(tx.amount_paid || tx.total_amount || 0)
            : clampMoney(tx.total_amount || 0);
        return sum + amount;
      }, 0);

      return {
        monthIndex,
        monthName: MONTHS_ES[monthIndex],
        quarter: getQuarterByMonth(monthIndex),
        monthTotal: clampMoney(monthTotal),
      };
    });

    return monthlyTotals.map((row) => {
      const quarterAccumulated = monthlyTotals
        .filter((item) => item.quarter === row.quarter && item.monthIndex <= row.monthIndex)
        .reduce((sum, item) => sum + item.monthTotal, 0);

      return {
        ...row,
        quarterAccumulated: clampMoney(quarterAccumulated),
      };
    });
  }

  function renderAccountingView() {
    if (!els.accountingTableBody) return;

    const rows = getAccountingRows();

    if (!rows.length) {
      setHTML(els.accountingTableBody, "");
      show(els.accountingEmpty);
      setText(els.accountingYearTotal, euro(0));
      setText(els.accountingQ1, euro(0));
      setText(els.accountingQ2, euro(0));
      setText(els.accountingQ3, euro(0));
      setText(els.accountingQ4, euro(0));
      return;
    }

    hide(els.accountingEmpty);

    const q1 = clampMoney(
      rows.filter((r) => r.quarter === 1).reduce((sum, r) => sum + r.monthTotal, 0)
    );
    const q2 = clampMoney(
      rows.filter((r) => r.quarter === 2).reduce((sum, r) => sum + r.monthTotal, 0)
    );
    const q3 = clampMoney(
      rows.filter((r) => r.quarter === 3).reduce((sum, r) => sum + r.monthTotal, 0)
    );
    const q4 = clampMoney(
      rows.filter((r) => r.quarter === 4).reduce((sum, r) => sum + r.monthTotal, 0)
    );

    const yearTotal = clampMoney(q1 + q2 + q3 + q4);

    setText(els.accountingYearTotal, euro(yearTotal));
    setText(els.accountingQ1, euro(q1));
    setText(els.accountingQ2, euro(q2));
    setText(els.accountingQ3, euro(q3));
    setText(els.accountingQ4, euro(q4));

    setHTML(
      els.accountingTableBody,
      rows
        .map(
          (row) => `
            <tr>
              <td>${escapeHtml(row.monthName)}</td>
              <td class="mono">${escapeHtml(euro(row.monthTotal))}</td>
              <td>T${row.quarter}</td>
              <td class="mono">${escapeHtml(euro(row.quarterAccumulated))}</td>
            </tr>
          `
        )
        .join("")
    );
  }

  // =========================================
  // EXTRA GLOBAL CLICK ACTIONS
  // =========================================
  function bindRegistryDelegation() {
    els.txList?.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      const editTxId = button.dataset.editTx;
      if (editTxId) {
        openEditTransaction(editTxId).catch(console.error);
        return;
      }

      const deleteTxId = button.dataset.deleteTx;
      if (deleteTxId) {
        deleteTransaction(deleteTxId).catch(console.error);
      }
    });
  }

  // =========================================
  // REGISTRY PANEL INIT
  // =========================================
  async function openRegistryPanel() {
    await ensureTransactionsLoaded();

    if (state.registry.openFromDetailCustomerId) {
      const customer = state.customerMap.get(state.registry.openFromDetailCustomerId);
      const company =
        state.companyMapByCustomerId.get(state.registry.openFromDetailCustomerId) || null;

      if (customer && els.registryFilterInput && !normalize(els.registryFilterInput.value)) {
        els.registryFilterInput.value = customerDisplayName(customer, company);
      }
    }

    renderRegistryList();
  }

  // =========================================
  // OVERRIDE / EXTEND NAVIGATION AFTER PART 2
  // =========================================
  const previousAfterNavigation = afterNavigation;
  afterNavigation = function patchedAfterNavigation(panelName) {
    previousAfterNavigation(panelName);

    if (panelName === "registry") {
      openRegistryPanel().catch(console.error);
    } else if (panelName === "accounting") {
      renderAccountingYearOptions();
      renderAccountingView();
    }
  };

  const previousNavigateTo = navigateTo;
  navigateTo = function patchedNavigateTo(panelName, options = {}) {
    showPanel(panelName, options);

    if (panelName === "search") {
      renderSearchResults();
    } else if (panelName === "companies") {
      renderCompaniesList();
    } else if (panelName === "create") {
      renderCustomerAzPanel();
    } else if (panelName === "home") {
      renderHomeStats();
    } else if (panelName === "detail") {
      renderDetailPanel();
    } else if (panelName === "registry") {
      openRegistryPanel().catch(console.error);
    } else if (panelName === "accounting") {
      renderAccountingYearOptions();
      renderAccountingView();
    }
  };

  // =========================================
  // PATCH GLOBAL CLICK HANDLER
  // =========================================
  const previousHandleGlobalClick = handleGlobalClick;
  handleGlobalClick = function patchedHandleGlobalClick(event) {
    previousHandleGlobalClick(event);

    const target = event.target.closest("button");
    if (!target) return;

    if (target.dataset.openRegistryTx) {
      const txId = target.dataset.openRegistryTx;
      state.registry.openFromDetailCustomerId = state.currentDetailCustomerId || null;
      navigateTo("registry");
      openEditTransaction(txId).catch(console.error);
    }
  };

  // =========================================
  // BIND PART 2 EVENTS
  // =========================================
  function bindPart2Events() {
    bindDraftItemsDelegation();
    bindTxCustomerPicker();
    bindRegistryDelegation();

    els.regTabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.registry.openFromDetailCustomerId = null;
        setRegistryKind(btn.dataset.regtab);
      });
    });

    els.accountingTabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setAccountingKind(btn.dataset.acctab);
      });
    });

    els.accountingYear?.addEventListener("change", () => {
      state.accounting.year = normalize(els.accountingYear.value);
      renderAccountingView();
    });

    els.btnNewTx?.addEventListener("click", () => {
      openNewTxForm(state.registry.currentKind);
    });

    els.btnTxCancel?.addEventListener("click", () => {
      resetTxForm({ keepKind: true, keepOpen: false });
    });

    els.btnTxReset?.addEventListener("click", () => {
      resetTxForm({ keepKind: true, keepOpen: true });
    });

    els.btnAddItem?.addEventListener("click", () => {
      addDraftItem();
    });

    els.btnTxSave?.addEventListener("click", () => {
      saveTransactionForm().catch(console.error);
    });

    els.btnTxDelete?.addEventListener("click", () => {
      deleteTransaction().catch(console.error);
    });

    els.registryFilterInput?.addEventListener(
      "input",
      debounce(() => {
        renderRegistryList();
      }, 180)
    );

    els.registryDateFrom?.addEventListener("change", () => {
      renderRegistryList();
    });

    els.registryDateTo?.addEventListener("change", () => {
      renderRegistryList();
    });

    [
      els.nicoMaterial,
      els.nicoTotal,
      els.nicoForNico,
      els.nicoForFlopitec,
      els.nicoPaid,
    ].forEach((input) => {
      input?.addEventListener("input", () => {
        if (state.registry.currentKind === "nico") {
          setText(els.txTotal, euro(clampMoney(els.nicoPaid?.value || 0)));
        }
      });
    });

    document.removeEventListener("click", handleGlobalClick);
    document.addEventListener("click", handleGlobalClick);
  }

  // =========================================
  // PATCH AUTH BOOTSTRAP
  // =========================================
  const previousBootstrapDataAfterAuth = bootstrapDataAfterAuth;
  bootstrapDataAfterAuth = async function patchedBootstrapDataAfterAuth() {
    if (state.isBootstrapping) return;
    state.isBootstrapping = true;

    try {
      await Promise.all([fetchCustomersAndCompanies(), fetchTransactionsFull()]);
      renderAllCoreViews();
      renderAccountingYearOptions();
      renderAccountingView();
      await updateOfflineCounter();
      await syncOfflineQueue().catch(console.error);
    } finally {
      state.isBootstrapping = false;
    }
  };

  // =========================================
  // PATCH RENDER CORE VIEWS
  // =========================================
  const previousRenderAllCoreViews = renderAllCoreViews;
  renderAllCoreViews = function patchedRenderAllCoreViews() {
    previousRenderAllCoreViews();
    renderRegistryList();
    renderAccountingYearOptions();
    renderAccountingView();
  };

  // =========================================
  // FINALIZE INIT
  // =========================================
  bindPart2Events();
  setRegistryKind("ticket");
  setAccountingKind("ticket");
  renderAccountingYearOptions();
  renderAccountingView();

})();