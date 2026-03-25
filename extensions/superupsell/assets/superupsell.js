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
      if (extra.amount) payload.amount = extra.amount;
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

  function shouldBundleWithMain(widget) {
    if (!widget) return false;
    return widget.dataset.bundleWithMain === "true";
  }

  function getCardPrice(el) {
    var card = el.closest(".superupsell-card");
    if (!card) return 0;
    var p = parseInt(card.dataset.price || "0", 10);
    return isNaN(p) ? 0 : p / 100;
  }

  function getMainVariantId(widget) {
    if (!widget) return null;
    var id = widget.dataset.mainVariantId;
    if (!id) return null;
    var parsed = parseInt(id, 10);
    return (!isNaN(parsed) && parsed > 0) ? parsed : null;
  }

  // ─── Cart sections & drawer ───

  var CART_SECTIONS = "cart-drawer,cart-icon-bubble,cart-notification-product,cart-notification-button";

  /** Render section HTML returned by /cart/add.js into the DOM. */
  function renderSections(sections) {
    if (!sections) return;
    for (var id in sections) {
      // 1. Standard Shopify section wrapper (cart-drawer, cart-icon-bubble)
      var el = document.getElementById("shopify-section-" + id);
      if (el) {
        el.innerHTML = sections[id];
        continue;
      }
      // 2. Dawn cart-notification uses direct IDs like #cart-notification-product
      el = document.getElementById(id);
      if (el) {
        // Parse the returned section HTML and extract inner content
        var tmp = document.createElement("div");
        tmp.innerHTML = sections[id];
        var inner = tmp.querySelector("#" + id);
        el.innerHTML = inner ? inner.innerHTML : sections[id];
      }
    }
  }

  /** Try to open the theme's native cart drawer or notification.
   *  Returns true if a native element was found, false otherwise. */
  function tryOpenNativeCart() {
    // 1. Dawn cart-notification custom element
    var cartNotificationEl = document.querySelector("cart-notification");
    if (cartNotificationEl) {
      if (typeof cartNotificationEl.open === "function") {
        try { cartNotificationEl.open(); return true; } catch (_) {}
      }
      var inner = document.getElementById("cart-notification");
      if (inner) {
        inner.classList.add("animate", "active");
        setTimeout(function () {
          inner.classList.remove("active");
          setTimeout(function () { inner.classList.remove("animate"); }, 400);
        }, 5000);
        return true;
      }
    }

    // 2. Dawn cart-drawer (<details> based)
    var cartDrawer = document.querySelector("cart-drawer");
    if (cartDrawer) {
      if (typeof cartDrawer.open === "function") {
        try { cartDrawer.open(); return true; } catch (_) {}
      }
      var details = cartDrawer.querySelector("details");
      if (details) { details.open = true; return true; }
    }

    // 3. Generic drawer: toggle common class names used by popular themes
    var drawer = document.querySelector(
      "#CartDrawer, .cart-drawer, .drawer--cart, .sidebar-cart, [data-cart-drawer]"
    );
    if (drawer) {
      drawer.classList.add("active", "is-open", "open");
      drawer.removeAttribute("hidden");
      drawer.setAttribute("aria-hidden", "false");
      return true;
    }

    return false;
  }

  // ─── Fallback toast notification ───

  var _toastStyleInjected = false;
  var _toastTimeout = null;

  function injectToastStyles() {
    if (_toastStyleInjected) return;
    _toastStyleInjected = true;
    var style = document.createElement("style");
    style.textContent =
      "@keyframes su-toast-in{from{transform:translate(-50%,-20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}" +
      "@keyframes su-toast-out{from{transform:translate(-50%,0);opacity:1}to{transform:translate(-50%,-20px);opacity:0}}" +
      ".su-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;" +
        "background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.15);padding:16px 20px;" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-width:280px;max-width:400px;" +
        "animation:su-toast-in .3s ease}" +
      ".su-toast.su-toast--closing{animation:su-toast-out .25s ease forwards}" +
      ".su-toast-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}" +
      ".su-toast-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#1a1a1a}" +
      ".su-toast-check{width:20px;height:20px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center}" +
      ".su-toast-close{background:none;border:none;font-size:20px;color:#888;cursor:pointer;padding:0 2px;line-height:1}" +
      ".su-toast-close:hover{color:#333}" +
      ".su-toast-actions{display:flex;gap:8px}" +
      ".su-toast-btn{flex:1;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;text-align:center;" +
        "text-decoration:none;cursor:pointer;transition:opacity .15s}" +
      ".su-toast-btn:hover{opacity:.85}" +
      ".su-toast-btn--outline{background:#fff;color:#1a1a1a;border:1px solid #d0d0d0}" +
      ".su-toast-btn--primary{background:#1a1a1a;color:#fff;border:1px solid #1a1a1a}";
    document.head.appendChild(style);
  }

  function showFallbackToast() {
    injectToastStyles();

    // Remove existing toast if any
    var existing = document.querySelector(".su-toast");
    if (existing) existing.remove();
    if (_toastTimeout) { clearTimeout(_toastTimeout); _toastTimeout = null; }

    var toast = document.createElement("div");
    toast.className = "su-toast";
    toast.innerHTML =
      '<div class="su-toast-header">' +
        '<span class="su-toast-title">' +
          '<span class="su-toast-check"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5.5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
          'Added to cart' +
        '</span>' +
        '<button class="su-toast-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="su-toast-actions">' +
        '<a href="/cart" class="su-toast-btn su-toast-btn--outline">View cart</a>' +
        '<a href="/checkout" class="su-toast-btn su-toast-btn--primary">Check out</a>' +
      '</div>';

    document.body.appendChild(toast);

    function close() {
      toast.classList.add("su-toast--closing");
      setTimeout(function () { toast.remove(); }, 250);
      if (_toastTimeout) { clearTimeout(_toastTimeout); _toastTimeout = null; }
    }

    toast.querySelector(".su-toast-close").addEventListener("click", close);
    _toastTimeout = setTimeout(close, 5000);
  }

  /** Open the theme's cart drawer/notification, or show our fallback toast. */
  function openCartDrawer() {
    if (!tryOpenNativeCart()) {
      showFallbackToast();
    }
  }

  /**
   * After a successful /cart/add.js call, render the returned sections
   * and open the cart drawer/notification so the user sees confirmation.
   */
  function renderSectionsAndOpenDrawer(res) {
    if (isCartPage()) return; // cart page reloads instead
    res.json().then(function (data) {
      if (data && data.sections) {
        renderSections(data.sections);
      }
      openCartDrawer();
      patchCheckoutButtons();
    }).catch(function () {
      // Fallback: fetch sections separately if parsing fails
      fetch("/?sections=" + CART_SECTIONS)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (sections) {
          renderSections(sections);
          openCartDrawer();
          patchCheckoutButtons();
        })
        .catch(function () {});
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
      var items = [{ id: parseInt(variantId, 10), quantity: 1 }];
      if (shouldBundleWithMain(widget)) {
        var mainVid = getMainVariantId(widget);
        if (mainVid) {
          items.unshift({ id: mainVid, quantity: 1 });
        }
      }

      _superupsellInternal = true;
      var res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items, sections: CART_SECTIONS }),
      });
      _superupsellInternal = false;

      if (res.ok) {
        var amount = getCardPrice(btn);
        trackEvent("add_to_cart", widget, { variantId: variantId, amount: amount });
        btn.innerHTML = "\u2713 Added";

        if (isCartPage()) {
          setTimeout(function () { window.location.reload(); }, 600);
          return;
        }

        setTimeout(function () {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 1500);

        renderSectionsAndOpenDrawer(res);
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
    var variantIds = [];
    var totalAmount = 0;
    checkboxes.forEach(function (cb) {
      var vid = cb.dataset.variantId;
      if (vid) {
        items.push({ id: parseInt(vid, 10), quantity: 1 });
        variantIds.push(vid);
        totalAmount += getCardPrice(cb);
      }
    });
    if (items.length === 0) return;

    var originalText = btn.textContent;
    btn.textContent = "Adding\u2026";
    btn.disabled = true;

    trackEvent("click", widget, { variantId: variantIds.join(",") });

    try {
      _superupsellInternal = true;
      var res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items, sections: CART_SECTIONS }),
      });
      _superupsellInternal = false;

      if (res.ok) {
        trackEvent("add_to_cart", widget, { variantId: variantIds.join(","), amount: totalAmount });
        btn.textContent = "\u2713 Added";

        if (isCartPage()) {
          setTimeout(function () { window.location.reload(); }, 600);
          return;
        }

        setTimeout(function () {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 1500);

        renderSectionsAndOpenDrawer(res);
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

  // ─── Instant add on checkbox (when no bulk button) ───

  async function handleCheckboxInstantAdd(cb) {
    var variantId = cb.dataset.variantId;
    if (!variantId) return;

    var card = cb.closest(".superupsell-card");
    var widget = cb.closest("[data-offer-id]");

    cb.disabled = true;
    if (card) card.style.opacity = "0.6";

    trackEvent("click", widget, { variantId: variantId });

    try {
      var items = [{ id: parseInt(variantId, 10), quantity: 1 }];
      if (shouldBundleWithMain(widget)) {
        var mainVid = getMainVariantId(widget);
        if (mainVid) items.unshift({ id: mainVid, quantity: 1 });
      }

      _superupsellInternal = true;
      var res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items, sections: CART_SECTIONS }),
      });
      _superupsellInternal = false;

      if (res.ok) {
        var amount = getCardPrice(cb);
        trackEvent("add_to_cart", widget, { variantId: variantId, amount: amount });

        if (isCartPage()) {
          setTimeout(function () { window.location.reload(); }, 600);
          return;
        }

        if (card) card.style.opacity = "1";
        setTimeout(function () {
          cb.checked = false;
          cb.disabled = false;
        }, 1500);

        renderSectionsAndOpenDrawer(res);
      } else {
        cb.checked = false;
        cb.disabled = false;
        if (card) card.style.opacity = "1";
      }
    } catch (_) {
      _superupsellInternal = false;
      cb.checked = false;
      cb.disabled = false;
      if (card) card.style.opacity = "1";
    }
  }

  // ─── Checkbox card click (toggle checkbox when clicking anywhere on card) ───

  function bindCheckboxCards(container) {
    var hasBulkBtn = !!container.querySelector(".superupsell-bulk-add");

    container.querySelectorAll(".superupsell-card").forEach(function (card) {
      var cb = card.querySelector(".superupsell-checkbox");
      if (!cb) return;

      card.addEventListener("click", function (e) {
        // Don't toggle if clicking checkbox itself or variant select
        if (e.target === cb || e.target.closest(".superupsell-variant-select")) return;
        cb.checked = !cb.checked;
        // Instant add when no bulk button exists
        if (!hasBulkBtn && cb.checked) {
          handleCheckboxInstantAdd(cb);
        }
      });

      // Direct checkbox clicks (native toggle already happened)
      if (!hasBulkBtn) {
        cb.addEventListener("change", function () {
          if (cb.checked) {
            handleCheckboxInstantAdd(cb);
          }
        });
      }
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
    var totalPrice = 0;
    var variantIds = [];
    _interceptWidgets.forEach(function (widget) {
      widget.querySelectorAll(".superupsell-checkbox:checked").forEach(function (cb) {
        var normalized = normalizeVariantId(cb.dataset.variantId);
        if (normalized) {
          items.push({ id: normalized, quantity: 1 });
          variantIds.push(String(normalized));
          totalPrice += getCardPrice(cb);
        }
      });
    });
    items._totalPrice = totalPrice;
    items._variantIds = variantIds;
    return items;
  }

  /**
   * After adding upsell items, re-fetch cart drawer sections and update DOM.
   * Uses Section Rendering API so the drawer shows ALL items (main + upsell).
   * Also patches the checkout button to go straight to /checkout.
   */
  function refreshCartDrawer(originalFetch) {
    originalFetch("/?sections=" + CART_SECTIONS)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (sections) {
        renderSections(sections);
        openCartDrawer();
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

      var upsellVids = upsellItems._variantIds.join(",");
      var upsellAmount = upsellItems._totalPrice;
      _interceptWidgets.forEach(function (w) { trackEvent("click", w, { variantId: upsellVids }); });

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
            _interceptWidgets.forEach(function (w) { trackEvent("add_to_cart", w, { variantId: upsellVids, amount: upsellAmount }); });
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
          var xhrVids = upsellItems._variantIds.join(",");
          var xhrAmount = upsellItems._totalPrice;
          _interceptWidgets.forEach(function (w) { trackEvent("click", w, { variantId: xhrVids }); });
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
                _interceptWidgets.forEach(function (w) { trackEvent("add_to_cart", w, { variantId: xhrVids, amount: xhrAmount }); });
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

      var formVids = upsellItems._variantIds.join(",");
      var formAmount = upsellItems._totalPrice;
      var items = [];
      var formData = new FormData(form);
      var normalizedFormId = normalizeVariantId(formData.get("id"));
      if (normalizedFormId) items.push({ id: normalizedFormId, quantity: parseInt(formData.get("quantity") || "1", 10) });
      items = items.concat(upsellItems);

      _interceptWidgets.forEach(function (w) { trackEvent("click", w, { variantId: formVids }); });

      _superupsellInternal = true;
      originalFetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      })
        .then(function (res) {
          _superupsellInternal = false;
          if (res.ok) {
            _interceptWidgets.forEach(function (w) { trackEvent("add_to_cart", w, { variantId: formVids, amount: formAmount }); });
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

      var buyVids = upsellItems._variantIds.join(",");
      var buyAmount = upsellItems._totalPrice;
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

      _interceptWidgets.forEach(function (w) { trackEvent("click", w, { variantId: buyVids }); });

      _superupsellInternal = true;
      originalFetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items }),
      })
        .then(function (res) {
          _superupsellInternal = false;
          if (res.ok) {
            _interceptWidgets.forEach(function (w) { trackEvent("add_to_cart", w, { variantId: buyVids, amount: buyAmount }); });
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

    var content = dataEl.querySelector(".superupsell-popup-content");
    if (!content) return;

    var popupShown = false;

    function showPopup() {
      if (popupShown) return;
      popupShown = true;

      var overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;opacity:0;transition:opacity .3s;";

      var popup = document.createElement("div");
      popup.style.cssText =
        "position:fixed;top:50%;left:50%;z-index:9999;padding:24px;border-radius:16px;transform:translate(-50%,-50%) scale(0.9);opacity:0;transition:transform .3s ease,opacity .3s ease;width:92%;max-width:480px;max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);box-sizing:border-box;";

      popup.appendChild(content.cloneNode(true));
      document.body.appendChild(overlay);
      document.body.appendChild(popup);

      bindButtons(popup);
      initSliders();

      requestAnimationFrame(function () {
        overlay.style.opacity = "1";
        popup.style.transform = "translate(-50%,-50%) scale(1)";
        popup.style.opacity = "1";
      });

      var popupContent = popup.querySelector("[data-offer-id]");
      if (popupContent) {
        trackEvent("impression", popupContent);
      }

      function close() {
        popup.style.transform = "translate(-50%,-50%) scale(0.9)";
        popup.style.opacity = "0";
        overlay.style.opacity = "0";
        setTimeout(function () {
          popup.remove();
          overlay.remove();
        }, 300);
      }

      overlay.addEventListener("click", close);
      var closeBtn = popup.querySelector(".superupsell-popup-close");
      if (closeBtn) closeBtn.addEventListener("click", close);
    }

    // Show popup after a successful NATIVE add-to-cart (skip our own calls)
    var _popupPrevFetch = window.fetch;
    window.fetch = function (url, options) {
      if (_superupsellInternal) return _popupPrevFetch.apply(this, arguments);

      var urlStr = typeof url === "string" ? url : (url instanceof Request ? url.url : "");
      if (urlStr.indexOf("/cart/add") === -1) return _popupPrevFetch.apply(this, arguments);

      var method = (options && options.method) ? options.method.toUpperCase() : (url instanceof Request ? url.method.toUpperCase() : "GET");
      if (method !== "POST") return _popupPrevFetch.apply(this, arguments);

      return _popupPrevFetch.apply(this, arguments).then(function (res) {
        if (res.ok && !popupShown) {
          setTimeout(showPopup, 500);
        }
        return res;
      });
    };
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
