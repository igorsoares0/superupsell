(function () {
  "use strict";

  // Prevent double-init
  if (window.__superupsell_init) return;
  window.__superupsell_init = true;

  // ─── Analytics ───

  var TRACK_URL = "/apps/superupsell/events";

  function trackEvent(eventType, widget, extra) {
    if (!widget) return;
    var offerId = widget.dataset.offerId;
    var surface = widget.dataset.surface;
    if (!offerId || !surface) return;

    var payload = {
      eventType: eventType,
      offerId: offerId,
      surface: surface,
    };
    if (extra) {
      if (extra.productId) payload.productId = extra.productId;
      if (extra.variantId) payload.variantId = extra.variantId;
    }

    var json = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        TRACK_URL,
        new Blob([json], { type: "application/json" })
      );
    } else {
      fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
        keepalive: true,
      }).catch(function () {});
    }
  }

  /** Track impressions with IntersectionObserver (once per session per offer). */
  function trackImpressions() {
    if (!("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var key = "su_imp_" + (el.dataset.offerId || "");

          // Deduplicate per session
          try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, "1");
          } catch (_) {}

          trackEvent("impression", el);
          observer.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );

    document
      .querySelectorAll(".superupsell-widget[data-offer-id]")
      .forEach(function (widget) {
        observer.observe(widget);
      });
  }

  // ─── Add to cart ───

  function getWidget(btn) {
    return btn.closest("[data-offer-id]");
  }

  async function handleAddToCart(e) {
    var btn = e.currentTarget;
    var variantId = btn.dataset.variantId;
    if (!variantId) return;

    var widget = getWidget(btn);
    var originalHTML = btn.innerHTML;
    btn.innerHTML = "Adding\u2026";
    btn.disabled = true;

    // Track click
    trackEvent("click", widget, { variantId: variantId });

    try {
      var res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: parseInt(variantId, 10), quantity: 1 }],
        }),
      });

      if (res.ok) {
        // Track conversion
        trackEvent("conversion", widget, { variantId: variantId });

        btn.innerHTML = "\u2713 Added";
        setTimeout(function () {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 1500);

        // Refresh cart UI
        try {
          var cartRes = await fetch(
            "/?sections=cart-drawer,cart-icon-bubble"
          );
          if (cartRes.ok) {
            var sections = await cartRes.json();
            for (var id in sections) {
              var el = document.getElementById("shopify-section-" + id);
              if (el) el.innerHTML = sections[id];
            }
          }
        } catch (_) {}
      } else {
        btn.innerHTML = "Error";
        setTimeout(function () {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 1500);
      }
    } catch (_) {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  // ─── Bind buttons ───

  function bindButtons(container) {
    container
      .querySelectorAll(".superupsell-add-btn")
      .forEach(function (btn) {
        btn.addEventListener("click", handleAddToCart);
      });

    container
      .querySelectorAll(".superupsell-variant-select")
      .forEach(function (sel) {
        sel.addEventListener("change", function () {
          var card = this.closest(".superupsell-card");
          if (!card) return;
          var btn = card.querySelector(".superupsell-add-btn");
          if (btn) btn.dataset.variantId = this.value;
        });
      });
  }

  // ─── Popup ───

  function initPopup() {
    var dataEl = document.getElementById("superupsell-popup-data");
    if (!dataEl) return;

    var delay = parseInt(dataEl.dataset.delay || "3", 10) * 1000;
    var content = dataEl.querySelector(".superupsell-popup-content");
    if (!content) return;

    setTimeout(function () {
      var overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;opacity:0;transition:opacity .3s;";

      var popup = document.createElement("div");
      popup.style.cssText =
        "position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:20px;border-radius:12px 12px 0 0;transform:translateY(100%);transition:transform .3s ease;max-height:60vh;overflow-y:auto;box-shadow:0 -4px 20px rgba(0,0,0,0.15);";

      popup.appendChild(content.cloneNode(true));
      document.body.appendChild(overlay);
      document.body.appendChild(popup);

      bindButtons(popup);

      requestAnimationFrame(function () {
        overlay.style.opacity = "1";
        popup.style.transform = "translateY(0)";
      });

      // Track popup impression
      var popupContent = popup.querySelector("[data-offer-id]");
      if (popupContent) {
        var key = "su_imp_" + popupContent.dataset.offerId;
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            trackEvent("impression", popupContent);
          }
        } catch (_) {}
      }

      function close() {
        popup.style.transform = "translateY(100%)";
        overlay.style.opacity = "0";
        setTimeout(function () {
          popup.remove();
          overlay.remove();
        }, 300);
      }

      overlay.addEventListener("click", close);
      var closeBtn = popup.querySelector(".superupsell-popup-close");
      if (closeBtn) closeBtn.addEventListener("click", close);
    }, delay);
  }

  // ─── Init ───

  function init() {
    document.querySelectorAll(".superupsell-widget").forEach(bindButtons);
    trackImpressions();
    initPopup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
