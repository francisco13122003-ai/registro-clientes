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
    panelFiscal: $("panelFiscal"),
    panelExpenses: $("panelExpenses"),
    panelCreate: $("panelCreate"),
    panelSearch: $("panelSearch"),
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
    createMode: $("createMode"),

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
    btnToggleClientHistoryOrder: $("btnToggleClientHistoryOrder"),
    clientHistorySortDirectionLabel: $("clientHistorySortDirectionLabel"),
    clientHistoryList: $("clientHistoryList"),
    clientHistoryEmpty: $("clientHistoryEmpty"),
    clientHistoryTabs: [...document.querySelectorAll('[data-chtab]')],

    // registry/accounting reserved for part 2
    btnNewTx: $("btnNewTx"),
    btnToggleRegistryOrder: $("btnToggleRegistryOrder"),
    registrySortDirectionLabel: $("registrySortDirectionLabel"),
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
    accountingQuarter: $("accountingQuarter"),
    btnAccountingExportPdf: $("btnAccountingExportPdf"),

    fiscalQuarterLabel: $("fiscalQuarterLabel"),
    btnFiscalRefresh: $("btnFiscalRefresh"),
    fiscalCards: $("fiscalCards"),
    fiscalTicketAggregateInfo: $("fiscalTicketAggregateInfo"),
    fiscalYearAccumulated: $("fiscalYearAccumulated"),

    txPaidFull: $("txPaidFull"),
    txPaidAmount: $("txPaidAmount"),
    txDelivered: $("txDelivered"),

    pendingRecordsList: $("pendingRecordsList"),
    pendingRecordsEmpty: $("pendingRecordsEmpty"),

    // expenses module
    btnExpenseNew: $("btnExpenseNew"),
    expenseFormBox: $("expenseFormBox"),
    expenseFormTitle: $("expenseFormTitle"),
    btnExpenseCancel: $("btnExpenseCancel"),
    btnExpenseSave: $("btnExpenseSave"),
    btnExpenseDelete: $("btnExpenseDelete"),
    btnExpenseReset: $("btnExpenseReset"),
    expenseMsg: $("expenseMsg"),
    expenseDate: $("expenseDate"),
    expenseConcept: $("expenseConcept"),
    expenseCategory: $("expenseCategory"),
    expenseProvider: $("expenseProvider"),
    expenseBase: $("expenseBase"),
    expenseVatPercent: $("expenseVatPercent"),
    expenseVatAmount: $("expenseVatAmount"),
    expenseTotal: $("expenseTotal"),
    expenseDeductible: $("expenseDeductible"),
    expenseNotes: $("expenseNotes"),
    expenseFilterYear: $("expenseFilterYear"),
    expenseFilterQuarter: $("expenseFilterQuarter"),
    expenseFilterCategory: $("expenseFilterCategory"),
    expenseFilterDeductible: $("expenseFilterDeductible"),
    expenseList: $("expenseList"),
    expenseListEmpty: $("expenseListEmpty"),
    expenseListCount: $("expenseListCount"),
    searchTabButtons: [...document.querySelectorAll("#panelSearch [data-searchtab]")],
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
      fiscal: false,
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
    expenses: [],

    currentCustomerId: null,
    currentDetailCustomerId: null,
    currentDetailHistoryKind: "ticket",
    currentDetailHistorySortDescending: true,
    currentSearchMode: "cliente",

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
      sortDescending: true,
    },

    accounting: {
      year: "",
      kind: "ticket",
    },

    fiscal: {
      year: new Date().getFullYear(),
      quarter: getQuarterByMonth(new Date().getMonth()),
    },

    expensesUi: {
      editingId: null,
    },

    selectedUploadFile: null,

    offline: {
      syncing: false,
      lastCount: 0,
    },
    authReady: false,
    txCodeRegistry: {
      byTxId: new Map(),
      counters: {},
    },
  };

  // =========================================
  // PANEL SYSTEM
  // =========================================
  const PANEL_NAMES = [
    "home",
    "registry",
    "accounting",
    "fiscal",
    "expenses",
    "create",
    "search",
    "detail",
  ];

  const panelMap = {
    home: els.panelHome,
    registry: els.panelRegistry,
    accounting: els.panelAccounting,
    fiscal: els.panelFiscal,
    expenses: els.panelExpenses,
    create: els.panelCreate,
    search: els.panelSearch,
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
    } else if (panelName === "create") {
      renderCustomerAzPanel();
    } else if (panelName === "home") {
      renderHomeStats();
    } else if (panelName === "detail") {
      renderDetailPanel();
    } else if (panelName === "fiscal") {
      renderFiscalPanel().catch(console.error);
    } else if (panelName === "expenses") {
      renderExpensesPanel().catch(console.error);
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
    } else if (panelName === "create") {
      renderCustomerAzPanel();
    } else if (panelName === "home") {
      renderHomeStats();
    } else if (panelName === "detail") {
      renderDetailPanel();
    } else if (panelName === "fiscal") {
      renderFiscalPanel().catch(console.error);
    } else if (panelName === "expenses") {
      renderExpensesPanel().catch(console.error);
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

  async function fetchExpenses() {
    state.loading.fiscal = true;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from("expenses")
          .select("*")
          .order("fecha", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(2000),
        15000
      );

      if (error) throw error;
      state.expenses = uniqueBy(safeArray(data), (row) => row.id);
    } catch (error) {
      console.error("No se pudieron cargar los gastos:", error);
      state.expenses = [];
    } finally {
      state.loading.fiscal = false;
    }
  }

  async function ensureExpensesLoaded() {
    if (!state.expenses.length && navigator.onLine) {
      await fetchExpenses();
    }
  }

  async function renderFiscalPanel() {
    if (!els.fiscalCards || !els.fiscalYearAccumulated) return;

    const fiscalCore = window.FiscalCore;
    const fiscalUI = window.FiscalUI;

    if (!fiscalCore || !fiscalUI) {
      setHTML(els.fiscalCards, `<div class="empty-box">No se pudo cargar el módulo fiscal.</div>`);
      setHTML(els.fiscalYearAccumulated, "");
      return;
    }

    await ensureTransactionsLoaded();
    await ensureExpensesLoaded();

    const snapshot = fiscalCore.calculateQuarterFiscalSnapshot({
      transactions: state.transactions,
      expenses: state.expenses,
      year: state.fiscal.year,
      quarter: state.fiscal.quarter,
    });

    const yearAccumulated = fiscalCore.calculateYearFiscalAccumulated({
      transactions: state.transactions,
      expenses: state.expenses,
      year: state.fiscal.year,
    });

    setText(els.fiscalQuarterLabel, `T${state.fiscal.quarter} · ${state.fiscal.year}`);
    setHTML(els.fiscalCards, fiscalUI.buildFiscalCardsHTML(snapshot, euro));
    setHTML(els.fiscalTicketAggregateInfo, fiscalUI.buildTicketAggregateLineHTML(snapshot, euro));
    setHTML(els.fiscalYearAccumulated, fiscalUI.buildYearAccumulatedHTML(yearAccumulated, euro));
  }

  function resetExpenseForm({ keepOpen = false } = {}) {
    state.expensesUi.editingId = null;
    if (els.expenseFormBox && !keepOpen) hide(els.expenseFormBox);
    if (els.expenseFormBox && keepOpen) show(els.expenseFormBox);
    if (els.expenseFormTitle) setText(els.expenseFormTitle, "Nuevo gasto");
    if (els.expenseDate) els.expenseDate.value = todayISO();
    if (els.expenseConcept) els.expenseConcept.value = "";
    if (els.expenseCategory) els.expenseCategory.value = "";
    if (els.expenseProvider) els.expenseProvider.value = "";
    if (els.expenseBase) els.expenseBase.value = "";
    if (els.expenseVatPercent) els.expenseVatPercent.value = "";
    if (els.expenseVatAmount) els.expenseVatAmount.value = "";
    if (els.expenseTotal) els.expenseTotal.value = "";
    if (els.expenseDeductible) els.expenseDeductible.checked = false;
    if (els.expenseNotes) els.expenseNotes.value = "";
    hide(els.btnExpenseDelete);
    setInlineMessage(els.expenseMsg, "");
  }

  function getExpenseFilters() {
    return {
      year: normalize(els.expenseFilterYear?.value),
      quarter: normalize(els.expenseFilterQuarter?.value),
      category: normalizeLower(els.expenseFilterCategory?.value),
      deductible: normalize(els.expenseFilterDeductible?.value),
    };
  }

  function filterExpensesRows() {
    const { year, quarter, category, deductible } = getExpenseFilters();
    return state.expenses.filter((exp) => {
      const fecha = String(exp.fecha || "");
      if (year && !fecha.startsWith(`${year}-`)) return false;
      if (quarter) {
        const d = parseISODate(fecha);
        if (!d || String(getQuarterByMonth(d.getMonth())) !== String(quarter)) return false;
      }
      if (category && !normalizeLower(exp.categoria).includes(category)) return false;
      if (deductible === "true" && !exp.deducible) return false;
      if (deductible === "false" && !!exp.deducible) return false;
      return true;
    }).sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||"")));
  }

  function renderExpensesList() {
    if (!els.expenseList) return;
    const rows = filterExpensesRows();
    setText(els.expenseListCount, `${rows.length} resultados`);

    if (!rows.length) {
      setHTML(els.expenseList, "");
      show(els.expenseListEmpty);
      return;
    }

    hide(els.expenseListEmpty);
    setHTML(
      els.expenseList,
      rows.map((exp) => `
        <article class="list-item">
          <div class="list-item-main">
            <div class="list-item-title">${escapeHtml(exp.concepto || "Sin concepto")}</div>
            <div class="list-item-subtitle">${escapeHtml(formatDate(exp.fecha))} · ${escapeHtml(exp.categoria || "Sin categoría")} · ${escapeHtml(exp.proveedor || "Sin proveedor")}</div>
            <div class="list-item-meta">
              <span class="pill">Base ${escapeHtml(euro(exp.base_imponible || 0))}</span>
              <span class="pill">IVA ${escapeHtml(euro(exp.iva_importe || 0))}</span>
              <span class="pill success">Total ${escapeHtml(euro(exp.total || 0))}</span>
              <span class="pill ${exp.deducible ? "success" : "warning"}">${exp.deducible ? "Deducible" : "No deducible"}</span>
            </div>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-primary" type="button" data-edit-expense="${escapeHtml(String(exp.id))}">Editar</button>
            <button class="btn btn-danger" type="button" data-delete-expense="${escapeHtml(String(exp.id))}">Eliminar</button>
          </div>
        </article>
      `).join("")
    );
  }

  function fillExpenseForm(id) {
    const exp = state.expenses.find((x) => String(x.id) === String(id));
    if (!exp) return;
    state.expensesUi.editingId = exp.id;
    show(els.expenseFormBox);
    setText(els.expenseFormTitle, "Editar gasto");
    show(els.btnExpenseDelete);
    if (els.expenseDate) els.expenseDate.value = exp.fecha || todayISO();
    if (els.expenseConcept) els.expenseConcept.value = exp.concepto || "";
    if (els.expenseCategory) els.expenseCategory.value = exp.categoria || "";
    if (els.expenseProvider) els.expenseProvider.value = exp.proveedor || "";
    if (els.expenseBase) els.expenseBase.value = exp.base_imponible ?? "";
    if (els.expenseVatPercent) els.expenseVatPercent.value = exp.iva_porcentaje ?? "";
    if (els.expenseVatAmount) els.expenseVatAmount.value = exp.iva_importe ?? "";
    if (els.expenseTotal) els.expenseTotal.value = exp.total ?? "";
    if (els.expenseDeductible) els.expenseDeductible.checked = !!exp.deducible;
    if (els.expenseNotes) els.expenseNotes.value = exp.notas || "";
    setInlineMessage(els.expenseMsg, "");
  }

  function collectExpensePayload() {
    return {
      fecha: normalize(els.expenseDate?.value) || todayISO(),
      concepto: normalize(els.expenseConcept?.value),
      categoria: normalize(els.expenseCategory?.value) || null,
      proveedor: normalize(els.expenseProvider?.value) || null,
      base_imponible: clampMoney(els.expenseBase?.value || 0),
      iva_porcentaje: clampMoney(els.expenseVatPercent?.value || 0),
      iva_importe: clampMoney(els.expenseVatAmount?.value || 0),
      total: clampMoney(els.expenseTotal?.value || 0),
      deducible: !!els.expenseDeductible?.checked,
      notas: normalize(els.expenseNotes?.value) || null,
    };
  }

  function validateExpensePayload(payload) {
    if (!payload.fecha) return "La fecha es obligatoria.";
    if (!payload.concepto) return "El concepto es obligatorio.";
    return "";
  }

  async function saveExpenseForm() {
    const payload = collectExpensePayload();
    const validationError = validateExpensePayload(payload);
    if (validationError) {
      setInlineMessage(els.expenseMsg, validationError, "error");
      return;
    }

    const editingId = state.expensesUi.editingId;
    setDisabled(els.btnExpenseSave, true);
    setInlineMessage(els.expenseMsg, "Guardando...", "muted");

    try {
      if (!editingId) {
        const { error } = await withTimeout(supabase.from("expenses").insert(payload), 12000);
        if (error) throw error;
      } else {
        const { error } = await withTimeout(
          supabase.from("expenses").update(payload).eq("id", editingId),
          12000
        );
        if (error) throw error;
      }

      await fetchExpenses();
      renderExpensesList();
      renderFiscalPanel().catch(console.error);
      resetExpenseForm({ keepOpen: false });
      showToast("Gasto guardado correctamente.", "success");
    } catch (error) {
      console.error(error);
      setInlineMessage(els.expenseMsg, error?.message || "No se pudo guardar el gasto.", "error");
    } finally {
      setDisabled(els.btnExpenseSave, false);
    }
  }

  async function deleteExpense(id = null) {
    const expenseId = id || state.expensesUi.editingId;
    if (!expenseId) return;
    const exp = state.expenses.find((x) => String(x.id) === String(expenseId));
    const confirmed = window.confirm(`¿Eliminar gasto ${exp?.concepto || "seleccionado"}?`);
    if (!confirmed) return;

    try {
      const { error } = await withTimeout(supabase.from("expenses").delete().eq("id", expenseId), 12000);
      if (error) throw error;
      await fetchExpenses();
      renderExpensesList();
      renderFiscalPanel().catch(console.error);
      resetExpenseForm({ keepOpen: false });
      showToast("Gasto eliminado.", "success");
    } catch (error) {
      console.error(error);
      showToast(error?.message || "No se pudo eliminar el gasto.", "error");
    }
  }

  async function renderExpensesPanel() {
    await ensureExpensesLoaded();
    renderExpensesList();
  }

  async function bootstrapDataAfterAuth() {
  if (state.isBootstrapping) return;
  state.isBootstrapping = true;

  try {
    await Promise.all([
      fetchCustomersAndCompanies(),
      fetchTransactionsBase(),
      fetchExpenses(),
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
    setCompanyBoxVisibility();
    renderCompaniesList();
    renderDetailPanel();
    renderClientHistory();
    renderFiscalPanel().catch(console.error);
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

    if (els.createMode) els.createMode.value = "cliente";
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
    const mode = normalize(els.createMode?.value) || "cliente";
    toggle(els.companyBox, mode === "empresa");
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
    if (els.createMode) els.createMode.value = customer.is_company ? "empresa" : "cliente";

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
    const mode = (normalize(els.createMode?.value) || "cliente");
    const customerPayload = {
      first_name: mode === "empresa" ? "" : normalize(els.firstName?.value),
      last_name: mode === "empresa" ? "" : normalize(els.lastName?.value),
      phone: normalize(els.phone?.value),
      address: normalize(els.address?.value),
      is_company: mode === "empresa",
    };

    const companyOn = mode === "empresa";

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

    if (!companyOn && !customerPayload.first_name) {
      return "El nombre es obligatorio.";
    }

    if (!companyOn && !customerPayload.last_name) {
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
    const mode = state.currentSearchMode || "cliente";
    els.searchTabButtons.forEach((btn)=>btn.classList.toggle("is-active", btn.dataset.searchtab===mode));
    const rows = filterCustomersByText(query)
      .filter(({customer}) => mode === "empresa" ? customer.is_company : !customer.is_company)
      .slice(0, SEARCH_LIMIT);

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
    renderFiscalPanel().catch(console.error);
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

  function updateClientHistorySortDirectionUI() {
    if (els.clientHistorySortDirectionLabel) {
      setText(
        els.clientHistorySortDirectionLabel,
        state.currentDetailHistorySortDescending
          ? "más reciente a más antiguo"
          : "más antiguo a más reciente"
      );
    }

    if (els.btnToggleClientHistoryOrder) {
      const nextDirection = state.currentDetailHistorySortDescending
        ? "ascendente"
        : "descendente";
      els.btnToggleClientHistoryOrder.setAttribute(
        "aria-label",
        `Invertir listado (pasar a orden ${nextDirection})`
      );
      els.btnToggleClientHistoryOrder.title = `Cambiar a orden ${nextDirection}`;
    }
  }

  function getClientHistoryRowsSorted(customerId, kind) {
    const rowsDesc = sortByDateDesc(getTransactionsForCustomer(customerId, kind), "tx_date");
    return state.currentDetailHistorySortDescending ? rowsDesc : [...rowsDesc].reverse();
  }

  function renderClientHistory() {
    if (!els.clientHistoryList) return;

    updateClientHistorySortDirectionUI();

    const customerId = state.currentDetailCustomerId;
    if (!customerId) {
      setHTML(els.clientHistoryList, "");
      show(els.clientHistoryEmpty);
      return;
    }

    const rows = getClientHistoryRowsSorted(customerId, state.currentDetailHistoryKind).slice(
      0,
      CLIENT_HISTORY_LIMIT
    );

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
          const statusMeta = extractStatusMeta(tx.comments);
          const code = getTransactionCode(tx);
          const cleanComments = stripStatusMeta(tx.comments);
          const items = state.transactionItemsByTxId.get(tx.id) || [];

          const total =
            tx.kind === "nico"
              ? clampMoney(tx.total_amount || 0)
              : clampMoney(tx.total_amount || 0);

          const concepts =
            items.length > 0
              ? items
                  .slice(0, 3)
                  .map((item) => item.concept)
                  .filter(Boolean)
                  .join(" · ")
              : cleanComments || "Registro";

          const meta = [
            `<span class="pill primary">${escapeHtml(transactionKindLabel(tx.kind))}</span>`,
            `<span class="pill">${escapeHtml(formatDate(tx.tx_date))}</span>`,
            tx.payment_method
              ? `<span class="pill">${escapeHtml(paymentMethodLabel(tx.payment_method))}</span>`
              : "",
            `<span class="pill success">${escapeHtml(euro(total))}</span>`,
            `<span class="pill">${escapeHtml(code)}</span>`,
            `<span class="pill ${statusMeta.paidFull ? "success" : "danger"}">${statusMeta.paidFull ? "Pagado" : "Pago pendiente"}</span>`,
            `<span class="pill ${statusMeta.delivered ? "success" : "warning"}">${statusMeta.delivered ? "Entregado" : "Sin entregar"}</span>`,
          ]
            .filter(Boolean)
            .join("");

          return `
            <article class="list-item">
              <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(concepts)}</div>
                <div class="list-item-subtitle">
                  ${escapeHtml(
                    tx.kind === "nico"
                      ? cleanComments || "Registro tipo Nico"
                      : cleanComments || "Venta / reparación"
                  )}
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

    if (target.dataset.editExpense) {
      fillExpenseForm(target.dataset.editExpense);
      return;
    }

    if (target.dataset.deleteExpense) {
      deleteExpense(target.dataset.deleteExpense).catch(console.error);
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

    els.createMode?.addEventListener("change", setCompanyBoxVisibility);
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

    els.btnToggleClientHistoryOrder?.addEventListener("click", () => {
      state.currentDetailHistorySortDescending = !state.currentDetailHistorySortDescending;
      renderClientHistory();
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
      .filter((item) => item.concept || item.amount !== 0);
  }

  function getDraftItemsTotal() {
    return getDraftItemsSanitized().reduce((sum, item) => sum + clampMoney(item.amount), 0);
  }

  function renderTxDraftItems() {
    if (!els.txItems || !els.txTotal) return;

    const isNico = state.registry.currentKind === "nico";

    if (isNico) {
      setText(els.txTotal, euro(clampMoney(els.nicoTotal?.value || 0)));
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
    if (els.txPaidFull) els.txPaidFull.checked = false;
    if (els.txDelivered) els.txDelivered.checked = false;
    if (els.txPaidAmount) els.txPaidAmount.value = "";
    updateTxPaidAmountState();

    if (els.nicoConcept) els.nicoConcept.value = "";
    if (els.nicoMaterial) els.nicoMaterial.value = "";
    if (els.nicoTotal) els.nicoTotal.value = "";
    if (els.nicoForNico) els.nicoForNico.value = "";
    if (els.nicoForFlopitec) els.nicoForFlopitec.value = "";
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

  function getTransactionConceptText(tx) {
    const items = state.transactionItemsByTxId.get(tx.id) || [];
    return items
      .map((item) => normalize(item.concept))
      .filter(Boolean)
      .join(" · ");
  }

  async function createAndAttachTransactionPdf(tx) {
    const txPdfService = window.TxPdfService;
    const jspdfCtor = window.jspdf?.jsPDF;

    if (!tx || !tx.id || !tx.customer_id || !txPdfService || !jspdfCtor) {
      return null;
    }

    const customer = state.customerMap.get(tx.customer_id) || null;
    const company = state.companyMapByCustomerId.get(tx.customer_id) || null;
    const items = state.transactionItemsByTxId.get(tx.id) || [];
    const txCode = getTransactionCode(tx);

    const data = txPdfService.buildPdfData({
      tx,
      items,
      customer,
      company,
      txCode,
    });

    const doc = txPdfService.renderPdfToJsPdf(data, jspdfCtor);
    const blob = doc.output("blob");
    const fileName = txPdfService.buildTxPdfFileName({
      txId: tx.id,
      kind: tx.kind,
      txDate: tx.tx_date,
    });
    const filePath = `transactions/${tx.id}/${Date.now()}_${fileName}`;

    const { error: uploadError } = await withTimeout(
      supabase.storage.from(STORAGE_BUCKET).upload(filePath, blob, {
        upsert: true,
        contentType: "application/pdf",
      }),
      25000
    );
    if (uploadError) throw uploadError;

    const baseAttachmentPayload = {
      customer_id: tx.customer_id,
      file_name: fileName,
      file_path: filePath,
      mime_type: "application/pdf",
    };

    const payloadWithTx = {
      ...baseAttachmentPayload,
      transaction_id: tx.id,
    };

    let inserted = false;
    let lastError = null;

    for (const payload of [payloadWithTx, baseAttachmentPayload]) {
      const { error } = await withTimeout(supabase.from("attachments").insert(payload), 12000);
      if (!error) {
        inserted = true;
        break;
      }
      lastError = error;
    }

    if (!inserted && lastError) throw lastError;

    return { fileName, filePath };
  }

  async function findTransactionPdfAttachment(txId) {
    if (!txId) return null;

    const { data: rowsByTx, error: byTxError } = await withTimeout(
      supabase
        .from("attachments")
        .select("*")
        .eq("transaction_id", txId)
        .order("created_at", { ascending: false })
        .limit(1),
      12000
    );

    if (!byTxError && safeArray(rowsByTx).length) {
      return rowsByTx[0];
    }

    const tx = state.transactions.find((row) => row.id === txId) || null;
    if (!tx?.customer_id) return null;

    const { data: rowsByName, error: byNameError } = await withTimeout(
      supabase
        .from("attachments")
        .select("*")
        .eq("customer_id", tx.customer_id)
        .ilike("file_name", `TX-${txId}-%`)
        .order("created_at", { ascending: false })
        .limit(1),
      12000
    );

    if (byNameError) throw byNameError;
    return safeArray(rowsByName)[0] || null;
  }

  async function openTransactionPdf(txId) {
    try {
      const attachment = await findTransactionPdfAttachment(txId);
      if (!attachment?.file_path) {
        showToast("Este registro aún no tiene PDF asociado.", "warning");
        return;
      }

      const { data, error } = await withTimeout(
        supabase.storage.from(STORAGE_BUCKET).createSignedUrl(attachment.file_path, 120),
        12000
      );

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error(error);
      showToast("No se pudo abrir el PDF del registro.", "error");
    }
  }

  function compareTransactionsByCodeAsc(a, b, codeByTxId = new Map()) {
    const codeA = codeByTxId.get(a.id) || getTransactionCode(a);
    const codeB = codeByTxId.get(b.id) || getTransactionCode(b);

    const seqA = Number(String(codeA).match(/^[A-Z]{2}-(\d{5})-\d{2}$/)?.[1] || 0);
    const seqB = Number(String(codeB).match(/^[A-Z]{2}-(\d{5})-\d{2}$/)?.[1] || 0);

    if (seqA !== seqB) return seqA - seqB;
    return String(codeA).localeCompare(String(codeB));
  }

  function compareTransactionsForRegistryDesc(a, b) {
    const createdA = new Date(a?.created_at || 0).getTime();
    const createdB = new Date(b?.created_at || 0).getTime();
    if (createdA !== createdB) return createdB - createdA;

    const txDateA = new Date(a?.tx_date || 0).getTime();
    const txDateB = new Date(b?.tx_date || 0).getTime();
    if (txDateA !== txDateB) return txDateB - txDateA;

    return String(b?.id || "").localeCompare(String(a?.id || ""));
  }

  function compareTransactionsForRegistry(a, b) {
    const direction = state.registry.sortDescending ? 1 : -1;
    return compareTransactionsForRegistryDesc(a, b) * direction;
  }

  function updateRegistrySortDirectionUI() {
    if (els.registrySortDirectionLabel) {
      setText(
        els.registrySortDirectionLabel,
        state.registry.sortDescending
          ? "más reciente a más antiguo"
          : "más antiguo a más reciente"
      );
    }

    if (els.btnToggleRegistryOrder) {
      const nextDirection = state.registry.sortDescending ? "ascendente" : "descendente";
      els.btnToggleRegistryOrder.setAttribute(
        "aria-label",
        `Invertir listado (pasar a orden ${nextDirection})`
      );
      els.btnToggleRegistryOrder.title = `Cambiar a orden ${nextDirection}`;
    }
  }

  function compareTransactionsForPdfAsc(a, b, codeByTxId = new Map()) {
    return compareTransactionsByCodeAsc(a, b, codeByTxId);
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
        list.push({
          ...item,
          concept: normalize(item.concept),
        });
        itemsMap.set(item.transaction_id, list);
      }
      state.transactionItemsByTxId = itemsMap;

      dedupeTransactionsInState();
      syncTxCodeRegistryFromState();
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
      notes: normalize(els.nicoNotes?.value),
    };
  }

  function collectTxPayloadFromForm() {
    const kind = state.registry.currentKind;

    const baseComments = normalize(els.txComments?.value);
    const base = {
      kind,
      customer_id: state.registry.selectedCustomerId,
      tx_date: normalize(els.txDate?.value) || todayISO(),
      payment_method: normalize(els.txPayment?.value) || null,
      comments: attachStatusMeta(baseComments, collectTxStatusMeta()),
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
          amount_paid: null,
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

      return "";
    }

    const items = getDraftItemsSanitized();

    if (!items.length) {
      return "Debes añadir al menos una línea con concepto e importe.";
    }

    const hasInvalid = items.some((item) => !item.concept);
    if (hasInvalid) {
      return "Cada línea debe tener concepto.";
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
        renderPendingRecords();
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

      if (!editingTxId) {
        const txForPdf = {
          id: txId,
          ...txPayload,
          created_at: new Date().toISOString(),
        };
        state.transactionItemsByTxId.set(
          txId,
          itemsPayload.map((item) => ({ concept: item.concept, amount: clampMoney(item.amount) }))
        );

        createAndAttachTransactionPdf(txForPdf)
          .then(async () => {
            if (state.currentDetailCustomerId === txPayload.customer_id) {
              await fetchAttachmentsForCustomer(txPayload.customer_id);
              renderAttachments();
            }
          })
          .catch((pdfError) => {
            console.error(pdfError);
            showToast("Registro guardado, pero no se pudo generar el PDF automático.", "warning", 4500);
          });
      }

      await fetchTransactionsFull();
      renderRegistryList();
      renderPendingRecords();
      renderHomeStats();
      renderClientHistory();
      renderAccountingYearOptions();
      renderAccountingView();
      renderFiscalPanel().catch(console.error);

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
        renderPendingRecords();
        renderHomeStats();
        renderClientHistory();
        renderAccountingYearOptions();
        renderAccountingView();
      renderFiscalPanel().catch(console.error);

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
      renderPendingRecords();
      renderHomeStats();
      renderClientHistory();
      renderAccountingYearOptions();
      renderAccountingView();
      renderFiscalPanel().catch(console.error);

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
    renderPendingRecords();
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

    return [...rows].sort(compareTransactionsForRegistry);
  }

  function renderRegistryList() {
    if (!els.txList) return;

    updateRegistrySortDirectionUI();

    const rows = getRegistryFilteredTransactions();

    setText(els.txListCount, `${rows.length} resultados`);
    setText(els.registryVisibleCount, String(rows.length));

    const visibleSum = rows.reduce((sum, tx) => {
      const amount =
        tx.kind === "nico"
          ? clampMoney(tx.total_amount || 0)
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
              ? clampMoney(tx.total_amount || 0)
              : clampMoney(tx.total_amount || 0);

          const statusMeta = extractStatusMeta(tx.comments);
          const code = getTransactionCode(tx);
          const cleanComments = stripStatusMeta(tx.comments);
          const concepts =
            items.length > 0
              ? items
                  .slice(0, 3)
                  .map((item) => item.concept)
                  .filter(Boolean)
                  .join(" · ")
              : cleanComments || "Sin detalle";

          const meta = [
            `<span class="pill primary">${escapeHtml(transactionKindLabel(tx.kind))}</span>`,
            `<span class="pill">${escapeHtml(formatDate(tx.tx_date))}</span>`,
            tx.payment_method
              ? `<span class="pill">${escapeHtml(paymentMethodLabel(tx.payment_method))}</span>`
              : "",
            `<span class="pill success">${escapeHtml(euro(total))}</span>`,
            `<span class="pill">${escapeHtml(code)}</span>`,
            `<span class="pill ${statusMeta.paidFull ? "success" : "danger"}">${statusMeta.paidFull ? "Pagado" : "Pago pendiente"}</span>`,
            `<span class="pill ${statusMeta.delivered ? "success" : "warning"}">${statusMeta.delivered ? "Entregado" : "Sin entregar"}</span>`,
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
                <div class="list-item-subtitle">${escapeHtml(cleanComments || "")}</div>
                <div class="list-item-meta">${meta}</div>
              </div>

              <div class="list-item-actions registry-item-actions">
                <button class="btn btn-ghost" type="button" data-open-tx="${escapeHtml(tx.id)}">Abrir</button>
                <button class="btn btn-primary" type="button" data-edit-tx="${escapeHtml(tx.id)}">Editar</button>
                <button class="btn btn-danger" type="button" data-delete-tx="${escapeHtml(tx.id)}">Eliminar</button>
                <button class="btn btn-ghost" type="button" data-open-tx-pdf="${escapeHtml(tx.id)}">PDF</button>
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
    const statusMeta = extractStatusMeta(tx.comments);
    if (els.txComments) els.txComments.value = stripStatusMeta(tx.comments);
    if (els.txPaidFull) els.txPaidFull.checked = !!statusMeta.paidFull;
    if (els.txDelivered) els.txDelivered.checked = !!statusMeta.delivered;
    if (els.txPaidAmount) els.txPaidAmount.value = statusMeta.paidAmount ?? "";
    updateTxPaidAmountState();

    if (tx.kind === "nico") {
      toggle(els.txNicoBox, true);
      toggle(els.txItemsBox, false);

      const items = state.transactionItemsByTxId.get(tx.id) || [];
      if (els.nicoConcept) els.nicoConcept.value = items[0]?.concept || "";
      if (els.nicoMaterial) els.nicoMaterial.value = tx.material_cost ?? "";
      if (els.nicoTotal) els.nicoTotal.value = tx.total_amount ?? "";
      if (els.nicoForNico) els.nicoForNico.value = tx.nico_amount ?? "";
      if (els.nicoForFlopitec) els.nicoForFlopitec.value = tx.flopitec_amount ?? "";
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
            ? clampMoney(tx.total_amount || 0)
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

      const openTxId = button.dataset.openTx;
      if (openTxId) {
        openEditTransaction(openTxId).catch(console.error);
        return;
      }

      const editTxId = button.dataset.editTx;
      if (editTxId) {
        openEditTransaction(editTxId).catch(console.error);
        return;
      }

      const deleteTxId = button.dataset.deleteTx;
      if (deleteTxId) {
        deleteTransaction(deleteTxId).catch(console.error);
        return;
      }

      const openTxPdfId = button.dataset.openTxPdf;
      if (openTxPdfId) {
        openTransactionPdf(openTxPdfId).catch(console.error);
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
      renderFiscalPanel().catch(console.error);
    } else if (panelName === "expenses") {
      renderExpensesPanel().catch(console.error);
    }
  };

  const previousNavigateTo = navigateTo;
  navigateTo = function patchedNavigateTo(panelName, options = {}) {
    showPanel(panelName, options);

    if (panelName === "search") {
      renderSearchResults();
    } else if (panelName === "create") {
      renderCustomerAzPanel();
    } else if (panelName === "home") {
      renderHomeStats();
    } else if (panelName === "detail") {
      renderDetailPanel();
    } else if (panelName === "fiscal") {
      renderFiscalPanel().catch(console.error);
    } else if (panelName === "expenses") {
      renderExpensesPanel().catch(console.error);
    } else if (panelName === "registry") {
      openRegistryPanel().catch(console.error);
    } else if (panelName === "accounting") {
      renderAccountingYearOptions();
      renderAccountingView();
      renderFiscalPanel().catch(console.error);
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

    const pendingField = target.dataset.togglePending;
    const pendingTxId = target.dataset.txId;
    if (pendingField && pendingTxId) {
      togglePendingField(pendingField, pendingTxId).catch(console.error);
      return;
    }

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
      renderFiscalPanel().catch(console.error);
    });

    els.btnNewTx?.addEventListener("click", () => {
      openNewTxForm(state.registry.currentKind);
    });

    els.btnToggleRegistryOrder?.addEventListener("click", () => {
      state.registry.sortDescending = !state.registry.sortDescending;
      renderRegistryList();
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
    els.txPaidFull?.addEventListener("change", () => {
      updateTxPaidAmountState();
    });

    els.btnAccountingExportPdf?.addEventListener("click", () => {
      exportAccountingQuarterPdf();
    });

    els.btnFiscalRefresh?.addEventListener("click", () => {
      fetchExpenses().then(() => renderFiscalPanel()).catch(console.error);
    });

    els.btnExpenseNew?.addEventListener("click", () => {
      resetExpenseForm({ keepOpen: true });
    });

    els.btnExpenseCancel?.addEventListener("click", () => {
      resetExpenseForm({ keepOpen: false });
    });

    els.btnExpenseReset?.addEventListener("click", () => {
      resetExpenseForm({ keepOpen: true });
    });

    els.btnExpenseSave?.addEventListener("click", () => {
      saveExpenseForm().catch(console.error);
    });

    els.btnExpenseDelete?.addEventListener("click", () => {
      deleteExpense().catch(console.error);
    });

    [els.expenseFilterYear, els.expenseFilterQuarter, els.expenseFilterCategory, els.expenseFilterDeductible]
      .filter(Boolean)
      .forEach((inputEl) => {
        const eventName = inputEl.tagName === "SELECT" ? "change" : "input";
        inputEl.addEventListener(eventName, () => {
          renderExpensesList();
        });
      });

    els.searchTabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.currentSearchMode = btn.dataset.searchtab || "cliente";
        renderSearchResults();
      });
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
    ].forEach((input) => {
      input?.addEventListener("input", () => {
        if (state.registry.currentKind === "nico") {
          setText(els.txTotal, euro(clampMoney(els.nicoTotal?.value || 0)));
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
      await Promise.all([fetchCustomersAndCompanies(), fetchTransactionsFull(), fetchExpenses()]);
      renderAllCoreViews();
      renderAccountingYearOptions();
      renderAccountingView();
      renderFiscalPanel().catch(console.error);
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
    renderPendingRecords();
    renderAccountingYearOptions();
    renderAccountingView();
  };

  function getKindPrefix(kind) {
    return { ticket: "TK", factura: "FC", otro: "OT", nico: "NC" }[kind] || "RG";
  }

  function loadTxCodeRegistry() {
    try {
      const raw = localStorage.getItem("txCodeRegistry:v1");
      const parsed = raw ? JSON.parse(raw) : null;
      state.txCodeRegistry.byTxId = new Map(Object.entries(parsed?.byTxId || {}));
      state.txCodeRegistry.counters = parsed?.counters || {};
    } catch {
      state.txCodeRegistry.byTxId = new Map();
      state.txCodeRegistry.counters = {};
    }
  }

  function persistTxCodeRegistry() {
    const payload = {
      byTxId: Object.fromEntries(state.txCodeRegistry.byTxId.entries()),
      counters: state.txCodeRegistry.counters,
    };
    localStorage.setItem("txCodeRegistry:v1", JSON.stringify(payload));
  }

  function buildCounterKey(kind, year) {
    return `${kind || "rg"}-${String(year || "00")}`;
  }

  function getTxYearSuffix(tx) {
    return String(new Date(tx.tx_date || tx.created_at || Date.now()).getFullYear()).slice(-2);
  }

  function extractSequenceFromCode(code, kind, year) {
    if (!code) return 0;
    const prefix = getKindPrefix(kind);
    const normalizedYear = String(year || "").padStart(2, "0");
    const match = String(code).match(new RegExp(`^${prefix}-(\\d{5})-${normalizedYear}$`));
    return match ? Number(match[1]) : 0;
  }

  function compareTransactionsChronologicalAsc(a, b) {
    const dateA = new Date(a?.tx_date || a?.created_at || 0).getTime();
    const dateB = new Date(b?.tx_date || b?.created_at || 0).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  }

  function syncTxCodeRegistryFromState() {
    const counters = {};
    const sortedTransactions = [...state.transactions].sort(compareTransactionsChronologicalAsc);
    let changed = false;

    for (const tx of sortedTransactions) {
      const year = getTxYearSuffix(tx);
      const key = buildCounterKey(tx.kind, year);
      const code = state.txCodeRegistry.byTxId.get(tx.id) || "";
      const sequence = extractSequenceFromCode(code, tx.kind, year);

      if (sequence > 0) {
        counters[key] = Math.max(Number(counters[key] || 0), sequence);
      }
    }

    for (const tx of sortedTransactions) {
      const year = getTxYearSuffix(tx);
      const key = buildCounterKey(tx.kind, year);
      const code = state.txCodeRegistry.byTxId.get(tx.id) || "";
      const sequence = extractSequenceFromCode(code, tx.kind, year);

      if (sequence > 0) continue;

      const next = Number(counters[key] || 0) + 1;
      const generatedCode = `${getKindPrefix(tx.kind)}-${String(next).padStart(5, "0")}-${year}`;
      state.txCodeRegistry.byTxId.set(tx.id, generatedCode);
      counters[key] = next;
      changed = true;
    }

    state.txCodeRegistry.counters = counters;
    if (changed) persistTxCodeRegistry();
  }

  function nextCodeFor(kind, year) {
    const key = buildCounterKey(kind, year);
    let maxSeen = Number(state.txCodeRegistry.counters[key] || 0);

    for (const tx of state.transactions) {
      const txYear = getTxYearSuffix(tx);
      if (tx.kind !== kind || txYear !== String(year)) continue;
      const knownCode = state.txCodeRegistry.byTxId.get(tx.id) || "";
      maxSeen = Math.max(maxSeen, extractSequenceFromCode(knownCode, kind, year));
    }

    const next = maxSeen + 1;
    state.txCodeRegistry.counters[key] = next;
    persistTxCodeRegistry();
    return next;
  }

  function getTransactionCode(tx) {
    const year = getTxYearSuffix(tx);
    if (state.txCodeRegistry.byTxId.has(tx.id)) {
      return state.txCodeRegistry.byTxId.get(tx.id);
    }

    const seq = nextCodeFor(tx.kind, year);
    const code = `${getKindPrefix(tx.kind)}-${String(seq).padStart(5, "0")}-${year}`;
    state.txCodeRegistry.byTxId.set(tx.id, code);
    persistTxCodeRegistry();
    return code;
  }

  function attachStatusMeta(comment, meta) {
    return `${stripStatusMeta(comment)} [[META:${JSON.stringify(meta)}]]`.trim();
  }

  function stripStatusMeta(comment) {
    return String(comment || "").replace(/\s*\[\[META:.*\]\]\s*$/,'').trim();
  }

  function extractStatusMeta(comment) {
    const text = String(comment || "");
    const match = text.match(/\[\[META:(.*)\]\]\s*$/);
    if (!match) return { paidFull: false, delivered: false, paidAmount: 0 };
    try {
      const parsed = JSON.parse(match[1]);
      return { paidFull: !!parsed.paidFull, delivered: !!parsed.delivered, paidAmount: clampMoney(parsed.paidAmount || 0) };
    } catch {
      return { paidFull: false, delivered: false, paidAmount: 0 };
    }
  }

  function collectTxStatusMeta() {
    const paidFull = !!els.txPaidFull?.checked;
    return {
      paidFull,
      delivered: !!els.txDelivered?.checked,
      paidAmount: paidFull ? 0 : clampMoney(els.txPaidAmount?.value),
    };
  }

  function updateTxPaidAmountState() {
    const disabled = !!els.txPaidFull?.checked;
    setDisabled(els.txPaidAmount, disabled);
    if (disabled && els.txPaidAmount) els.txPaidAmount.value = "";
  }

  function getPendingTransactions() {
    return state.transactions.filter((tx) => {
      const meta = extractStatusMeta(tx.comments);
      return !meta.paidFull || !meta.delivered;
    });
  }

  function renderPendingRecords() {
    if (!els.pendingRecordsList) return;
    const rows = sortByDateDesc(getPendingTransactions(), "tx_date");
    if (!rows.length) { setHTML(els.pendingRecordsList, ""); show(els.pendingRecordsEmpty); return; }
    hide(els.pendingRecordsEmpty);
    setHTML(els.pendingRecordsList, rows.map((tx) => {
      const customer = state.customerMap.get(tx.customer_id);
      const company = state.companyMapByCustomerId.get(tx.customer_id) || null;
      const meta = extractStatusMeta(tx.comments);
      return `<article class="list-item pending-record-item"><div class="list-item-main"><div class="list-item-title">${escapeHtml(customerDisplayName(customer, company))} · ${escapeHtml(getTransactionCode(tx))}</div><div class="list-item-subtitle">Total: ${escapeHtml(euro(tx.total_amount || 0))} · Pagado: <span style="color:#ff9b9b">${escapeHtml(euro(meta.paidAmount || 0))}</span></div></div><div class="list-item-actions pending-actions"><button class="btn ${meta.paidFull?"btn-primary":"btn-danger"}" data-toggle-pending="paid" data-tx-id="${escapeHtml(tx.id)}" type="button">Pagado</button><button class="btn ${meta.delivered?"btn-primary":"btn-ghost"}" data-toggle-pending="delivered" data-tx-id="${escapeHtml(tx.id)}" type="button">Entregado</button></div></article>`;
    }).join(""));
  }

  async function togglePendingField(field, txId) {
    const tx = state.transactions.find((r) => r.id === txId); if (!tx) return;
    const meta = extractStatusMeta(tx.comments);
    if (field === "paid") {
      meta.paidFull = true;
      meta.paidAmount = 0;
    }
    if (field === "delivered") meta.delivered = true;
    const payload = { comments: attachStatusMeta(stripStatusMeta(tx.comments), meta) };
    const { error } = await supabase.from("transactions").update(payload).eq("id", txId);
    if (error) throw error;
    tx.comments = payload.comments;

    if (state.registry.editingTxId === txId) {
      if (els.txPaidFull) els.txPaidFull.checked = !!meta.paidFull;
      if (els.txDelivered) els.txDelivered.checked = !!meta.delivered;
      if (els.txPaidAmount) els.txPaidAmount.value = meta.paidFull ? "" : meta.paidAmount;
      updateTxPaidAmountState();
    }

    renderRegistryList();
    renderPendingRecords();
  }

  function exportAccountingQuarterPdf() {
    const jspdf = window.jspdf?.jsPDF;
    if (!jspdf) { showToast("No se pudo cargar el generador PDF.", "error"); return; }
    const quarter = Number(els.accountingQuarter?.value || 1);
    const year = Number(state.accounting.year || new Date().getFullYear());
    const kind = state.accounting.kind;
    const rows = state.transactions.filter((tx) => {
      if (tx.kind !== kind || !tx.tx_date) return false;
      const parsed = parseISODate(tx.tx_date);
      return parsed && parsed.getFullYear() === year && getQuarterByMonth(parsed.getMonth()) === quarter;
    });
    const codeByTxId = new Map();
    [...rows]
      .sort((a, b) => String(a.tx_date || a.created_at || "").localeCompare(String(b.tx_date || b.created_at || "")))
      .forEach((tx) => {
        codeByTxId.set(tx.id, getTransactionCode(tx));
      });

    const doc = new jspdf({unit:"pt",format:"a4"});
    let y=40; doc.setFontSize(12); doc.text(`Exportación ${transactionKindLabel(kind)} · T${quarter} ${year}`,40,y); y+=24; doc.setFontSize(9);
    [...rows].sort((a, b) => compareTransactionsForPdfAsc(a, b, codeByTxId)).forEach((tx)=>{
      if(y>760){doc.addPage(); y=40;}
      const c=state.customerMap.get(tx.customer_id);
      const customerName = customerDisplayName(c,state.companyMapByCustomerId.get(tx.customer_id)||null);
      const concepts = getTransactionConceptText(tx) || "Sin concepto";
      const line = `${codeByTxId.get(tx.id) || getTransactionCode(tx)} | ${formatDate(tx.tx_date)} | ${customerName} | Concepto: ${concepts} | ${euro(tx.total_amount||0)}`;
      const wrappedLines = doc.splitTextToSize(line, 520);
      doc.text(wrappedLines,40,y);
      y += (wrappedLines.length * 12) + 6;
    });
    doc.save(`contabilidad-${kind}-T${quarter}-${year}-${Date.now()}.pdf`);
  }

  // =========================================
  // FINALIZE INIT
  // =========================================
  bindPart2Events();
  loadTxCodeRegistry();
  setRegistryKind("ticket");
  setAccountingKind("ticket");
  renderAccountingYearOptions();
  renderAccountingView();

})();
