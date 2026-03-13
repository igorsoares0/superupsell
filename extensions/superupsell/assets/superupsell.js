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

  /** Track impressions with IntersectionObserver (once per page view per offer). */
  function trackImpressions() {
    if (!("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          trackEvent("impression", entry.target);
          observer.unobserve(entry.target);
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

  // ─── Bulk add (checkbox mode) ───

  async function handleBulkAdd(e) {
    var btn = e.currentTarget;
    var widget = btn.closest("[data-offer-id]");
    var checkboxes = widget
      ? widget.querySelectorAll(".superupsell-checkbox:checked")
      : [];
    if (checkboxes.length === 0) return;

    var items = [];
    checkboxes.forEach(function (cb) {
      var vid = cb.dataset.variantId;
      if (vid) items.push({ id: parseInt(vid, 10), quantity: 1 });
    });
    if (items.length === 0) return;

    var originalText = btn.textContent;
    btn.textContent = "Adding\u2026";
    btn.disabled = true;

    trackEvent("click", widget);

    try {
      var res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      });

      if (res.ok) {
        trackEvent("conversion", widget);
        btn.textContent = "\u2713 Added";
        setTimeout(function () {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1500);

        try {
          var cartRes = await fetch("/?sections=cart-drawer,cart-icon-bubble");
          if (cartRes.ok) {
            var sections = await cartRes.json();
            for (var id in sections) {
              var el = document.getElementById("shopify-section-" + id);
              if (el) el.innerHTML = sections[id];
            }
          }
        } catch (_) {}
      } else {
        btn.textContent = "Error";
        setTimeout(function () {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1500);
      }
    } catch (_) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  // ─── Checkbox card click (toggle checkbox when clicking anywhere on card) ───

  function bindCheckboxCards(container) {
    container.querySelectorAll(".superupsell-card").forEach(function (card) {
      var cb = card.querySelector(".superupsell-checkbox");
      if (!cb) return;

      card.addEventListener("click", function (e) {
        // Don't toggle if clicking checkbox itself or variant select
        if (e.target === cb || e.target.closest(".superupsell-variant-select")) return;
        cb.checked = !cb.checked;
      });
    });

    container.querySelectorAll(".superupsell-bulk-add").forEach(function (btn) {
      btn.addEventListener("click", handleBulkAdd);
    });
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
          // Also update checkbox variant id
          var cb = card.querySelector(".superupsell-checkbox");
          if (cb) cb.dataset.variantId = this.value;
        });
      });

    bindCheckboxCards(container);
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
      initSliders();

      requestAnimationFrame(function () {
        overlay.style.opacity = "1";
        popup.style.transform = "translateY(0)";
      });

      // Track popup impression
      var popupContent = popup.querySelector("[data-offer-id]");
      if (popupContent) {
        trackEvent("impression", popupContent);
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

  // ─── Slider arrows ───

  function initSliders() {
    document.querySelectorAll(".superupsell-slider").forEach(function (slider) {
      // Already initialized
      if (slider.dataset.sliderInit) return;
      slider.dataset.sliderInit = "1";

      var cards = slider.querySelectorAll(".superupsell-card");
      var total = cards.length;
      if (total <= 1) return;

      var index = 0;

      function update() {
        cards.forEach(function (card, i) {
          card.style.display = i === index ? "flex" : "none";
        });
        if (prevBtn) prevBtn.style.display = index > 0 ? "flex" : "none";
        if (nextBtn) nextBtn.style.display = index < total - 1 ? "flex" : "none";
        if (counter) counter.textContent = (index + 1) + " / " + total;
      }

      var arrowStyle =
        "position:absolute;top:50%;transform:translateY(-50%);z-index:2;" +
        "width:32px;height:32px;border-radius:50%;border:1px solid #ddd;" +
        "background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);cursor:pointer;" +
        "display:flex;align-items:center;justify-content:center;font-size:18px;color:#333;padding:0;";

      var prevBtn = document.createElement("button");
      prevBtn.setAttribute("aria-label", "Previous");
      prevBtn.style.cssText = arrowStyle + "left:-12px;";
      prevBtn.textContent = "\u2039";
      prevBtn.addEventListener("click", function () {
        if (index > 0) { index--; update(); }
      });

      var nextBtn = document.createElement("button");
      nextBtn.setAttribute("aria-label", "Next");
      nextBtn.style.cssText = arrowStyle + "right:-12px;";
      nextBtn.textContent = "\u203A";
      nextBtn.addEventListener("click", function () {
        if (index < total - 1) { index++; update(); }
      });

      var counter = document.createElement("div");
      counter.style.cssText = "text-align:center;margin-top:8px;font-size:12px;color:#888;";

      slider.style.position = "relative";
      slider.appendChild(prevBtn);
      slider.appendChild(nextBtn);
      slider.appendChild(counter);
      update();
    });
  }

  // ─── Init ───

  function init() {
    document.querySelectorAll(".superupsell-widget").forEach(bindButtons);
    trackImpressions();
    initSliders();
    initPopup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
