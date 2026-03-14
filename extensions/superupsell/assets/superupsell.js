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

  // ─── Helpers ───

  function isCartPage() {
    return /^\/cart\/?$/i.test(window.location.pathname);
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
      _superupsellInternal = true;
      var res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: parseInt(variantId, 10), quantity: 1 }],
        }),
      });
      _superupsellInternal = false;

      if (res.ok) {
        // Track conversion
        trackEvent("conversion", widget, { variantId: variantId });

        btn.innerHTML = "\u2713 Added";

        // On the cart page, reload so the cart table shows the new item
        if (isCartPage()) {
          setTimeout(function () { window.location.reload(); }, 600);
          return;
        }

        setTimeout(function () {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 1500);

        // Refresh cart UI (drawer / icon)
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
      _superupsellInternal = false;
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
      _superupsellInternal = true;
      var res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      });
      _superupsellInternal = false;

      if (res.ok) {
        trackEvent("conversion", widget);
        btn.textContent = "\u2713 Added";

        // On the cart page, reload so the cart table shows the new items
        if (isCartPage()) {
          setTimeout(function () { window.location.reload(); }, 600);
          return;
        }

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
      _superupsellInternal = false;
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

    var bulkBtns = container.querySelectorAll(".superupsell-bulk-add");
    bulkBtns.forEach(function (btn) {
      btn.addEventListener("click", handleBulkAdd);
    });

    // If checkbox mode, intercept native add-to-cart and buy-it-now buttons
    // to also add checked upsell items alongside the main product
    var hasCheckboxes = container.querySelectorAll(".superupsell-checkbox").length > 0;
    if (hasCheckboxes) {
      interceptNativeAddToCart(container);
    }
  }

  // ─── Native add-to-cart interception (checkbox mode) ───

  var _interceptWidgets = [];
  var _nativeInterceptBound = false;
  var _superupsellInternal = false;

  function normalizeVariantId(rawId) {
    if (rawId == null) return null;
    var str = String(rawId).trim();
    if (!str) return null;

    var direct = parseInt(str, 10);
    if (!isNaN(direct) && direct > 0) return direct;

    var match = str.match(/(\d+)(?!.*\d)/);
    if (!match) return null;

    var extracted = parseInt(match[1], 10);
    return !isNaN(extracted) && extracted > 0 ? extracted : null;
  }

  function getCheckedUpsellItems() {
    var items = [];
    _interceptWidgets.forEach(function (widget) {
      widget.querySelectorAll(".superupsell-checkbox:checked").forEach(function (cb) {
        var normalized = normalizeVariantId(cb.dataset.variantId);
        if (normalized) items.push({ id: normalized, quantity: 1 });
      });
    });
    return items;
  }

  /**
   * After adding upsell items, re-fetch cart drawer sections and update DOM.
   * Uses Section Rendering API so the drawer shows ALL items (main + upsell).
   * Also patches the checkout button to go straight to /checkout.
   */
  function refreshCartDrawer(originalFetch) {
    originalFetch("/?sections=cart-drawer,cart-icon-bubble")
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (sections) {
        if (!sections) return;
        for (var id in sections) {
          var el = document.getElementById("shopify-section-" + id);
          if (el) el.innerHTML = sections[id];
        }
        patchCheckoutButtons();
      })
      .catch(function () {});
  }

  /**
   * Make cart-drawer checkout buttons navigate directly to /checkout
   * instead of submitting a form to /cart (which shows the cart page first).
   */
  function patchCheckoutButtons() {
    var btns = document.querySelectorAll(
      'button[name="checkout"], .cart__checkout-button, [name="checkout"][type="submit"]'
    );
    btns.forEach(function (btn) {
      // Only patch buttons inside a cart drawer / cart sidebar
      if (!btn.closest('#CartDrawer, cart-drawer, .drawer, .cart-drawer, .sidebar-cart, [id*="cart-drawer"]')) return;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = "/checkout";
      });
    });
  }

  function interceptNativeAddToCart(widget) {
    _interceptWidgets.push(widget);

    if (_nativeInterceptBound) return;
    _nativeInterceptBound = true;

    var originalFetch = window.fetch;

    // 1. Monkey-patch fetch — let the original request go through unchanged,
    //    then add upsell items and refresh the cart drawer sections.
    window.fetch = function (url, options) {
      if (_superupsellInternal) return originalFetch.apply(this, arguments);

      var urlStr = typeof url === "string" ? url : (url instanceof Request ? url.url : "");
      if (urlStr.indexOf("/cart/add") === -1) return originalFetch.apply(this, arguments);

      var method = (options && options.method) ? options.method.toUpperCase() : (url instanceof Request ? url.method.toUpperCase() : "GET");
      if (method !== "POST") return originalFetch.apply(this, arguments);

      var upsellItems = getCheckedUpsellItems();
      if (upsellItems.length === 0) return originalFetch.apply(this, arguments);

      _interceptWidgets.forEach(function (w) { trackEvent("click", w); });

      // Let the theme's original request go through untouched
      return originalFetch.apply(this, arguments).then(function (res) {
        if (!res.ok) return res;

        var items = getCheckedUpsellItems();
        if (items.length === 0) return res;

        // Add upsell items in a follow-up call (don't block the response)
        _superupsellInternal = true;
        originalFetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: items }),
        }).then(function (upsellRes) {
          _superupsellInternal = false;
          if (upsellRes && upsellRes.ok) {
            _interceptWidgets.forEach(function (w) { trackEvent("conversion", w); });
            // Refresh the cart drawer so it shows ALL items and checkout works
            refreshCartDrawer(originalFetch);
          }
        }).catch(function () { _superupsellInternal = false; });

        return res;
      });
    };

    // 2. Intercept XMLHttpRequest (older themes)
    var origXHROpen = XMLHttpRequest.prototype.open;
    var origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function () {
      this._suMethod = (arguments[0] || "").toUpperCase();
      this._suUrl = String(arguments[1] || "");
      return origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (
        !_superupsellInternal &&
        this._suMethod === "POST" &&
        this._suUrl.indexOf("/cart/add") !== -1
      ) {
        var upsellItems = getCheckedUpsellItems();
        if (upsellItems.length > 0) {
          _interceptWidgets.forEach(function (w) { trackEvent("click", w); });
          var self = this;
          this.addEventListener("load", function () {
            if (!(self.status >= 200 && self.status < 300)) return;
            _superupsellInternal = true;
            originalFetch("/cart/add.js", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: upsellItems }),
            }).then(function (upsellRes) {
              _superupsellInternal = false;
              if (upsellRes && upsellRes.ok) {
                _interceptWidgets.forEach(function (w) { trackEvent("conversion", w); });
                refreshCartDrawer(originalFetch);
              }
            }).catch(function () { _superupsellInternal = false; });
          });
        }
      }
      return origXHRSend.apply(this, arguments);
    };

    // 3. Traditional form submissions (non-AJAX themes)
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || !form.action || form.action.indexOf("/cart/add") === -1) return;

      var upsellItems = getCheckedUpsellItems();
      if (upsellItems.length === 0) return;

      e.preventDefault();

      var items = [];
      var formData = new FormData(form);
      var normalizedFormId = normalizeVariantId(formData.get("id"));
      if (normalizedFormId) items.push({ id: normalizedFormId, quantity: parseInt(formData.get("quantity") || "1", 10) });
      items = items.concat(upsellItems);

      _interceptWidgets.forEach(function (w) { trackEvent("click", w); });

      _superupsellInternal = true;
      originalFetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      })
        .then(function (res) {
          _superupsellInternal = false;
          if (res.ok) {
            _interceptWidgets.forEach(function (w) { trackEvent("conversion", w); });
            window.location.href = "/cart";
          } else {
            form.submit();
          }
        })
        .catch(function () {
          _superupsellInternal = false;
          form.submit();
        });
    });

    // 4. "Buy it Now" / dynamic checkout buttons
    document.addEventListener("click", function (e) {
      if (_interceptWidgets.length === 0) return;

      var btn = e.target.closest(
        ".shopify-payment-button, [data-shopify='payment-button']"
      );
      if (!btn) return;

      var upsellItems = getCheckedUpsellItems();
      if (upsellItems.length === 0) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      var variantInput = document.querySelector(
        "form[action*='/cart/add'] [name='id'], product-form [name='id'], .product-form [name='id']"
      );
      var items = upsellItems.slice();
      if (variantInput) {
        var qtyInput = document.querySelector(
          "form[action*='/cart/add'] [name='quantity'], product-form [name='quantity']"
        );
        items.unshift({
          id: parseInt(variantInput.value, 10),
          quantity: parseInt((qtyInput && qtyInput.value) || "1", 10) || 1,
        });
      }

      _interceptWidgets.forEach(function (w) { trackEvent("click", w); });

      _superupsellInternal = true;
      originalFetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      })
        .then(function (res) {
          _superupsellInternal = false;
          if (res.ok) {
            _interceptWidgets.forEach(function (w) { trackEvent("conversion", w); });
            window.location.href = "/checkout";
          }
        })
        .catch(function () {
          _superupsellInternal = false;
        });
    }, true);
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
    patchCheckoutButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
