(function () {
  "use strict";

  // Prevent double-init
  if (window.__superupsell_init) return;
  window.__superupsell_init = true;

  /**
   * Add to cart via Shopify AJAX API.
   */
  async function handleAddToCart(e) {
    var btn = e.currentTarget;
    var variantId = btn.dataset.variantId;
    if (!variantId) return;

    var originalHTML = btn.innerHTML;
    btn.innerHTML = "Adding\u2026";
    btn.disabled = true;

    try {
      var res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: parseInt(variantId, 10), quantity: 1 }],
        }),
      });

      if (res.ok) {
        btn.innerHTML = "\u2713 Added";
        setTimeout(function () {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 1500);

        // Try to refresh cart UI
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

  /**
   * Bind add-to-cart buttons and variant selectors.
   */
  function bindButtons(container) {
    container.querySelectorAll(".superupsell-add-btn").forEach(function (btn) {
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

  /**
   * Init popup: move content to overlay and show after delay.
   */
  function initPopup() {
    var dataEl = document.getElementById("superupsell-popup-data");
    if (!dataEl) return;

    var delay = parseInt(dataEl.dataset.delay || "3", 10) * 1000;
    var content = dataEl.querySelector(".superupsell-popup-content");
    if (!content) return;

    setTimeout(function () {
      // Create overlay
      var overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;opacity:0;transition:opacity .3s;";

      // Create popup
      var popup = document.createElement("div");
      popup.style.cssText =
        "position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:20px;border-radius:12px 12px 0 0;transform:translateY(100%);transition:transform .3s ease;max-height:60vh;overflow-y:auto;box-shadow:0 -4px 20px rgba(0,0,0,0.15);";

      // Move server-rendered content into popup
      popup.appendChild(content.cloneNode(true));

      document.body.appendChild(overlay);
      document.body.appendChild(popup);

      // Bind events in the popup
      bindButtons(popup);

      // Animate in
      requestAnimationFrame(function () {
        overlay.style.opacity = "1";
        popup.style.transform = "translateY(0)";
      });

      // Close handler
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

  /**
   * Init on DOM ready.
   */
  function init() {
    // Bind add-to-cart on all inline widgets (product page, cart)
    document.querySelectorAll(".superupsell-widget").forEach(bindButtons);

    // Init popup
    initPopup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
