/* ============================================
   AI Weekly Digest — Sunday Natural
   Newsletter Landing Page Scripts
   ============================================ */

(function () {
  "use strict";

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
      var cleanUrl = window.location.origin + window.location.pathname;
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

  /**
   * Initialize everything on DOM ready.
   */
  function init() {
    setRedirectUrl();
    checkSubscriptionStatus();
    initFormValidation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
