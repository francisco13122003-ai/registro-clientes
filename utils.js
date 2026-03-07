window.AppUtils = {
  $(id) {
    return document.getElementById(id);
  },

  byId(id) {
    return document.getElementById(id);
  },

  normalize(value) {
    return (value ?? "").toString().trim();
  },

  normalizeLower(value) {
  return (value ?? "").toString().trim().toLowerCase();
},

  toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  },

  clampMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(",", "."));
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return Number(safe.toFixed(2));
},

  euro(value) {
  if (value === null || value === undefined || value === "") return "0.00 €";
  const parsed = Number(String(value).replace(",", "."));
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return `${safe.toFixed(2)} €`;
},

  uuidLike() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
      .toString(16)
      .slice(2)}`;
  },

  escapeHtml(str) {
    return (str ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  debounce(fn, delay = 250) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  async withTimeout(promise, ms = 12000, label = "Tiempo de espera agotado") {
    let timeoutId;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(label)), ms);
      });
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  },

  todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },

  formatDate(value) {
    if (!value) return "—";
    try {
      const parts = value.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString("es-ES");
    } catch {
      return String(value);
    }
  },

  formatDateTime(value) {
    if (!value) return "—";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString("es-ES");
    } catch {
      return String(value);
    }
  },

  sortByDateDesc(items, field = "created_at") {
    return [...items].sort((a, b) => {
      const ad = new Date(a?.[field] || 0).getTime();
      const bd = new Date(b?.[field] || 0).getTime();
      return bd - ad;
    });
  },

  sortByTextAsc(items, selector) {
  return [...items].sort((a, b) => {
    const av = (selector(a) ?? "").toString().trim().toLowerCase();
    const bv = (selector(b) ?? "").toString().trim().toLowerCase();
    return av.localeCompare(bv, "es");
  });
},

  uniqueBy(items, keyFn) {
    const map = new Map();
    for (const item of items || []) {
      const key = keyFn(item);
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return [...map.values()];
  },

  isNonEmpty(value) {
  return (value ?? "").toString().trim() !== "";
},

  safeArray(value) {
    return Array.isArray(value) ? value : [];
  },

  setText(el, value) {
    if (el) el.textContent = value ?? "";
  },

  setHTML(el, value) {
    if (el) el.innerHTML = value ?? "";
  },

  show(el) {
    if (el) el.classList.remove("hidden");
  },

  hide(el) {
    if (el) el.classList.add("hidden");
  },

  toggle(el, visible) {
    if (!el) return;
    el.classList.toggle("hidden", !visible);
  },

  setDisabled(el, disabled) {
    if (el) el.disabled = !!disabled;
  },

  addClass(el, className) {
    if (el) el.classList.add(className);
  },

  removeClass(el, className) {
    if (el) el.classList.remove(className);
  },

  toggleClass(el, className, enabled) {
    if (el) el.classList.toggle(className, !!enabled);
  },

  getQuarterByMonth(monthIndexZeroBased) {
    if (monthIndexZeroBased <= 2) return 1;
    if (monthIndexZeroBased <= 5) return 2;
    if (monthIndexZeroBased <= 8) return 3;
    return 4;
  },

  parseISODate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  },

  buildSearchHaystack(parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part))
    .join(" ")
    .trim()
    .toLowerCase();
},

  toPhoneComparable(value) {
  return (value ?? "").toString().trim().replace(/\s+/g, "");
},

  getClientRequestId(prefix = "op") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  },
};