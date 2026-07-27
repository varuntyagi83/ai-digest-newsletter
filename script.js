/* ============================================
   AI Weekly Digest — Sunday Natural
   Newsletter Landing Page Scripts
   ============================================ */

(function () {
  "use strict";

  var SUBSCRIBERS_URL = "https://n8n.varuntyagi.net/webhook/nl-subscribers";
  var UNSUBSCRIBE_URL = "https://n8n.varuntyagi.net/webhook/nl-unsubscribe";
  var BACKUP_URL = "https://n8n.varuntyagi.net/webhook/nl-backup";

  var subscribers = [];

  // The admin key is held in memory for the life of the page only. It is
  // deliberately never written to sessionStorage, localStorage, a cookie or
  // the URL, so it survives nothing: not a reload, not a new tab, not history.
  var adminKey = null;

  /* --------------------------------------------
     Shared helpers
     -------------------------------------------- */

  /**
   * Set the hidden redirect_url field to the current page URL (without query params).
   */
  function setRedirectUrl() {
    var field = document.getElementById("redirect-url");
    if (field) {
      var base = window.location.origin + window.location.pathname;
      field.value = base;
    }
  }

  /**
   * Show a toast notification.
   * @param {string} message - Text to display.
   * @param {"success"|"info"|"error"} type - Toast variant.
   */
  function showToast(message, type) {
    var container = document.getElementById("toast-container");
    if (!container) return;

    var toast = document.createElement("div");
    toast.className = "toast toast--" + type;
    toast.textContent = message;
    container.appendChild(toast);

    // Auto-dismiss after 5 seconds
    setTimeout(function () {
      toast.classList.add("toast-out");
      toast.addEventListener("animationend", function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      });
    }, 5000);
  }

  /**
   * Check URL query params for subscription status and show appropriate toast.
   */
  function checkSubscriptionStatus() {
    var params = new URLSearchParams(window.location.search);
    var status = params.get("status");

    if (status === "subscribed") {
      showToast("You're subscribed! Watch your inbox.", "success");
    } else if (status === "already") {
      showToast("You're already subscribed!", "info");
    } else if (status === "error") {
      showToast("Something went wrong. Please try again.", "error");
    }

    // Clean up the URL bar by removing query params
    if (status) {
      var cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  /**
   * Validate email format.
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  }

  /**
   * Attach form validation to the subscribe form.
   */
  function initFormValidation() {
    var form = document.getElementById("subscribe-form");
    var emailInput = document.getElementById("email-input");

    if (!form || !emailInput) return;

    form.addEventListener("submit", function (e) {
      var email = emailInput.value.trim();

      if (!email || !isValidEmail(email)) {
        e.preventDefault();
        emailInput.focus();
        showToast("Please enter a valid email address.", "error");
        return;
      }
    });
  }

  /* --------------------------------------------
     Tabs
     -------------------------------------------- */

  /**
   * Show one panel and mark its tab active.
   * @param {"public"|"admin"} name
   */
  function activateTab(name) {
    var tabs = document.querySelectorAll(".tab");
    var i;

    for (i = 0; i < tabs.length; i++) {
      var isMatch = tabs[i].getAttribute("data-tab") === name;
      tabs[i].classList.toggle("is-active", isMatch);
      tabs[i].setAttribute("aria-selected", isMatch ? "true" : "false");
    }

    var panels = document.querySelectorAll(".panel");
    for (i = 0; i < panels.length; i++) {
      var show = panels[i].id === "panel-" + name;
      panels[i].classList.toggle("is-active", show);
      panels[i].hidden = !show;
    }

    if (name === "admin" && !adminKey) {
      var input = document.getElementById("admin-key");
      if (input) input.focus();
    }
  }

  function initTabs() {
    var tabs = document.querySelectorAll(".tab");

    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", function () {
        var name = this.getAttribute("data-tab");
        activateTab(name);
        var hash = name === "admin" ? "#admin" : "";
        window.history.replaceState({}, document.title,
          window.location.origin + window.location.pathname + hash);
      });
    }

    if (window.location.hash === "#admin") {
      activateTab("admin");
    }
  }

  /* --------------------------------------------
     Admin: data access
     -------------------------------------------- */

  /**
   * Parse the subscriber list HTML returned by the n8n webhook.
   * @param {string} html
   * @returns {{ok: boolean, rows: Array<{email: string, date: string}>}}
   */
  function parseSubscribers(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var rows = doc.querySelectorAll("tbody tr");
    var out = [];

    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].querySelectorAll("td");
      if (cells.length >= 3) {
        var email = cells[1].textContent.trim();
        if (email) {
          out.push({ email: email, date: cells[2].textContent.trim() });
        }
      }
    }

    // A rejected key comes back as a "403 Forbidden" body with no table.
    var forbidden = !out.length && /forbidden/i.test(doc.body ? doc.body.textContent : "");

    return { ok: !forbidden, rows: out };
  }

  /**
   * Fetch the subscriber list with the given key and render it.
   * @param {string} key
   */
  function loadSubscribers(key) {
    var loginError = document.getElementById("login-error");
    var loginBtn = document.getElementById("login-btn");
    var countEl = document.getElementById("dash-count");

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = "Checking…";
    }
    if (countEl && subscribers.length) countEl.textContent = "Refreshing…";

    return fetch(SUBSCRIBERS_URL + "?key=" + encodeURIComponent(key), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (html) {
        var parsed = parseSubscribers(html);

        if (!parsed.ok) {
          adminKey = null;
          showLogin("That admin key was rejected.");
          return;
        }

        adminKey = key;
        subscribers = parsed.rows;
        showDashboard();
        renderTable();
      })
      .catch(function () {
        showLogin("Could not reach the subscriber service. Check your connection and try again.");
      })
      .then(function () {
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.textContent = "Unlock";
        }
        if (loginError && !loginError.textContent) loginError.hidden = true;
      });
  }

  /**
   * Remove one address from the list.
   * The backend decodes the email from base64, exactly as the unsubscribe
   * links in the welcome email do. Sending it in plain text removes nobody
   * while still reporting success, so the encoding here is required.
   * @param {string} email
   * @returns {Promise}
   */
  function unsubscribeOne(email) {
    var encoded = btoa(email);
    var url = UNSUBSCRIBE_URL + "?email=" + encodeURIComponent(encoded);

    // Subscribers unsubscribe with their own per person token. An admin has no
    // token, so the key authorises the removal instead.
    if (adminKey) {
      url += "&key=" + encodeURIComponent(adminKey);
    }

    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      });
  }

  /* --------------------------------------------
     Admin: views
     -------------------------------------------- */

  function showLogin(message) {
    var login = document.getElementById("admin-login");
    var dash = document.getElementById("admin-dash");
    var err = document.getElementById("login-error");

    if (login) login.hidden = false;
    if (dash) dash.hidden = true;

    if (err) {
      err.textContent = message || "";
      err.hidden = !message;
    }

    var input = document.getElementById("admin-key");
    if (input) {
      input.value = "";
      input.focus();
    }
  }

  function showDashboard() {
    var login = document.getElementById("admin-login");
    var dash = document.getElementById("admin-dash");
    var err = document.getElementById("login-error");

    if (login) login.hidden = true;
    if (dash) dash.hidden = false;
    if (err) {
      err.textContent = "";
      err.hidden = true;
    }
  }

  /**
   * Currently checked email addresses.
   * @returns {string[]}
   */
  function getSelected() {
    var boxes = document.querySelectorAll(".row-check:checked");
    var out = [];
    for (var i = 0; i < boxes.length; i++) {
      out.push(boxes[i].getAttribute("data-email"));
    }
    return out;
  }

  function updateBulkButton() {
    var btn = document.getElementById("bulk-btn");
    if (!btn) return;

    var count = getSelected().length;
    btn.disabled = count === 0;
    btn.textContent = count ? "Unsubscribe selected (" + count + ")" : "Unsubscribe selected";
  }

  /**
   * Render the subscriber table, honouring the current filter.
   */
  function renderTable() {
    var tbody = document.getElementById("sub-tbody");
    var countEl = document.getElementById("dash-count");
    var emptyEl = document.getElementById("dash-empty");
    var filterEl = document.getElementById("filter-input");
    var checkAll = document.getElementById("check-all");

    if (!tbody) return;

    var term = filterEl ? filterEl.value.trim().toLowerCase() : "";
    var visible = subscribers.filter(function (s) {
      return !term || s.email.toLowerCase().indexOf(term) !== -1;
    });

    tbody.textContent = "";

    visible.forEach(function (sub, index) {
      var tr = document.createElement("tr");

      var tdCheck = document.createElement("td");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.className = "row-check";
      box.setAttribute("data-email", sub.email);
      box.setAttribute("aria-label", "Select " + sub.email);
      box.addEventListener("change", updateBulkButton);
      tdCheck.appendChild(box);

      var tdNum = document.createElement("td");
      tdNum.className = "col-num";
      tdNum.textContent = String(index + 1);

      var tdEmail = document.createElement("td");
      tdEmail.className = "cell-email";
      tdEmail.textContent = sub.email;

      var tdDate = document.createElement("td");
      tdDate.className = "col-date cell-date";
      tdDate.textContent = sub.date;

      var tdAction = document.createElement("td");
      tdAction.className = "col-action";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-remove";
      btn.textContent = "Unsubscribe";
      btn.addEventListener("click", function () {
        removeAddresses([sub.email]);
      });
      tdAction.appendChild(btn);

      tr.appendChild(tdCheck);
      tr.appendChild(tdNum);
      tr.appendChild(tdEmail);
      tr.appendChild(tdDate);
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });

    if (countEl) {
      var total = subscribers.length;
      var label = total === 1 ? "1 subscriber" : total + " subscribers";
      countEl.textContent = term ? visible.length + " of " + label + " shown" : label;
    }

    if (emptyEl) emptyEl.hidden = visible.length > 0;
    if (checkAll) checkAll.checked = false;
    updateBulkButton();
  }

  /**
   * Confirm, then unsubscribe one or more addresses and reload the list.
   * @param {string[]} emails
   */
  function removeAddresses(emails) {
    if (!emails.length) return;

    var question = emails.length === 1
      ? "Unsubscribe " + emails[0] + "?"
      : "Unsubscribe these " + emails.length + " addresses?\n\n" + emails.join("\n");

    if (!window.confirm(question)) return;

    // The backend returns its "Unsubscribed" page whether or not anything was
    // actually removed, so its response proves nothing. Reload the list and
    // check the addresses are really gone before reporting success.
    Promise.all(emails.map(unsubscribeOne))
      .then(function () {
        return loadSubscribers(adminKey);
      })
      .then(function () {
        var remaining = emails.filter(function (email) {
          return subscribers.some(function (s) { return s.email === email; });
        });

        if (!remaining.length) {
          showToast(emails.length === 1
            ? "Unsubscribed " + emails[0]
            : "Unsubscribed " + emails.length + " addresses", "success");
        } else {
          showToast(remaining.length + " of " + emails.length +
            " could not be removed and are still subscribed.", "error");
        }
      })
      .catch(function () {
        showToast("The removal could not be confirmed. Refresh to check.", "error");
        if (adminKey) loadSubscribers(adminKey);
      });
  }

  /* --------------------------------------------
     Admin: wiring
     -------------------------------------------- */

  function initAdmin() {
    var loginForm = document.getElementById("login-form");
    var filterEl = document.getElementById("filter-input");
    var refreshBtn = document.getElementById("refresh-btn");
    var backupBtn = document.getElementById("backup-btn");
    var lockBtn = document.getElementById("lock-btn");
    var bulkBtn = document.getElementById("bulk-btn");
    var checkAll = document.getElementById("check-all");

    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = document.getElementById("admin-key");
        var key = input ? input.value.trim() : "";
        if (!key) return;
        loadSubscribers(key);
      });
    }

    if (filterEl) {
      filterEl.addEventListener("input", renderTable);
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        if (adminKey) loadSubscribers(adminKey);
      });
    }

    if (backupBtn) {
      backupBtn.addEventListener("click", function () {
        if (!adminKey) return;

        backupBtn.disabled = true;
        backupBtn.textContent = "Backing up…";

        fetch(BACKUP_URL + "?key=" + encodeURIComponent(adminKey), { cache: "no-store" })
          .then(function (res) {
            // A rejected key comes back as 403 with a JSON body.
            return res.json().catch(function () { return { ok: false }; });
          })
          .then(function (result) {
            if (result && result.ok) {
              showToast("Backed up " + result.count +
                (result.count === 1 ? " subscriber" : " subscribers") +
                " to Drive as " + result.file, "success");
            } else {
              showToast("Backup failed. The admin key was refused.", "error");
            }
          })
          .catch(function () {
            showToast("Backup failed. Could not reach the backup service.", "error");
          })
          .then(function () {
            backupBtn.disabled = false;
            backupBtn.textContent = "Back up to Drive";
          });
      });
    }

    if (lockBtn) {
      lockBtn.addEventListener("click", function () {
        adminKey = null;
        subscribers = [];

        // Wipe the rendered addresses too, so no subscriber data is left
        // sitting in the DOM once the list is locked again.
        if (filterEl) filterEl.value = "";
        renderTable();

        showLogin("");
      });
    }

    if (bulkBtn) {
      bulkBtn.addEventListener("click", function () {
        removeAddresses(getSelected());
      });
    }

    if (checkAll) {
      checkAll.addEventListener("change", function () {
        var boxes = document.querySelectorAll(".row-check");
        for (var i = 0; i < boxes.length; i++) {
          boxes[i].checked = checkAll.checked;
        }
        updateBulkButton();
      });
    }
  }

  /**
   * Initialize everything on DOM ready.
   */
  function init() {
    setRedirectUrl();
    checkSubscriptionStatus();
    initFormValidation();
    initTabs();
    initAdmin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
