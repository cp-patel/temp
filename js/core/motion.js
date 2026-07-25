/* ============================================================
   Motion — scroll reveal, count-up, kinetic type, progress animation.

   All of it is progressive enhancement: if this file fails to load, nothing is
   hidden and nothing is broken. That is why the reveal class is applied from
   here rather than authored into the markup — content is visible by default and
   only becomes animatable once we know we can animate it back in.
   ============================================================ */
(function (global) {
  "use strict";

  var M = {};

  var reduced =
    global.matchMedia &&
    global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------- */

  /* Deliberately a geometry predicate re-evaluated on scroll, not an
     IntersectionObserver.

     IO is edge-triggered: it fires when intersection *changes*. Observe an
     element that is below the fold, then jump straight past it — an anchor
     link, a restored scroll position, a flick on a trackpad — and it goes from
     not-intersecting to not-intersecting. No callback fires, and the element
     stays at opacity 0 for the life of the page. Scrolling back up shows blank
     space where a section should be. That is how scroll reveal turns into a
     content-loss bug, and no rootMargin fixes it because the problem is the
     missing event, not the threshold.

     Asking "is this element at or above the reveal line?" every frame the page
     scrolls cannot miss, and the listener detaches as soon as the last pending
     element has been revealed. */

  var pending = [];
  var listening = false;
  var queued = false;

  /* Transition duration in styles/motion.css. Each element also carries its own
     stagger delay, so "finished" is per-element — a fixed timeout fires early
     for later items, and dropping will-change mid-transition hands the layer
     back to the main thread and leaves opacity a fraction short. */
  var RV_MS = 620;

  function markDone(el) {
    var delay = parseFloat(el.style.getPropertyValue("--rv-delay")) || 0;
    setTimeout(
      function () {
        el.classList.add("is-done");
      },
      delay + RV_MS + 120
    );
  }

  function show(el) {
    el.classList.add("is-in");
    markDone(el);
  }

  function sweep() {
    queued = false;
    var line = global.innerHeight * 0.92;
    var still = [];
    for (var i = 0; i < pending.length; i++) {
      var el = pending[i];
      // Dropped from the DOM by a re-render: stop tracking it.
      if (!el.isConnected) continue;
      var box = el.getBoundingClientRect();
      if (box.top < line) show(el);
      else still.push(el);
    }
    pending = still;
    if (!pending.length) stopListening();
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(sweep);
  }

  function startListening() {
    if (listening) return;
    listening = true;
    global.addEventListener("scroll", onScroll, { passive: true });
    global.addEventListener("resize", onScroll, { passive: true });
  }

  function stopListening() {
    if (!listening) return;
    listening = false;
    global.removeEventListener("scroll", onScroll);
    global.removeEventListener("resize", onScroll);
  }

  /**
   * Reveal a set of elements on scroll, staggered in DOM order.
   *
   * @param {Element|Element[]|NodeList} target  container or explicit list
   * @param {Object} [opts]
   *   selector  {string} children to reveal (when target is a container)
   *   step      {number} ms between siblings (default 55)
   *   max       {number} ms cap on the stagger, so long lists don't crawl
   */
  M.reveal = function (target, opts) {
    opts = opts || {};
    var step = opts.step == null ? 55 : opts.step;
    var max = opts.max == null ? 380 : opts.max;

    var items;
    if (!target) return;
    if (target.length !== undefined && !target.tagName) {
      items = Array.prototype.slice.call(target);
    } else if (opts.selector) {
      items = Array.prototype.slice.call(
        target.querySelectorAll(opts.selector)
      );
    } else {
      items = [target];
    }
    if (!items.length) return;

    // Reduced motion: leave everything visible and never touch it.
    if (reduced) return;

    var line = global.innerHeight * 0.92;
    var added = false;

    items.forEach(function (el, i) {
      if (!el || el.dataset.rv) return;
      el.dataset.rv = "1";
      el.style.setProperty("--rv-delay", Math.min(i * step, max) + "ms");
      el.classList.add("rv");
      if (el.getBoundingClientRect().top < line) {
        // Two frames: one to apply the initial state, one to transition out of it.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            show(el);
          });
        });
      } else {
        pending.push(el);
        added = true;
      }
    });

    if (added) startListening();
  };

  /** Drop pending elements — called on navigation so views don't leak. */
  M.reset = function () {
    pending = [];
    stopListening();
  };

  /* ---------------------------------------------------------
     Count-up
     --------------------------------------------------------- */

  /**
   * Animate a number from 0 to its value. Uses an eased ramp so it decelerates
   * into the final figure instead of stopping dead.
   */
  M.countUp = function (el, to, opts) {
    opts = opts || {};
    var ms = opts.ms == null ? 900 : opts.ms;
    var fmt =
      opts.format ||
      function (v) {
        return String(Math.round(v));
      };

    if (reduced || !to || ms <= 0) {
      el.textContent = fmt(to);
      return;
    }

    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / ms);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * eased);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = fmt(to);
    }
    el.textContent = fmt(0);
    requestAnimationFrame(frame);
  };

  /** Count up every [data-count] in a container once it scrolls into view. */
  M.counters = function (root) {
    var nodes = Array.prototype.slice.call(
      root.querySelectorAll("[data-count]")
    );
    if (!nodes.length) return;

    function run(el) {
      if (el.dataset.counted) return;
      el.dataset.counted = "1";
      var to = parseFloat(el.dataset.count);
      var suffix = el.dataset.countSuffix || "";
      var decimals = parseInt(el.dataset.countDecimals || "0", 10);
      M.countUp(el, to, {
        format: function (v) {
          var n = decimals ? v.toFixed(decimals) : Math.round(v);
          if (!decimals && to >= 1000) {
            n = String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          }
          return n + suffix;
        },
      });
    }

    if (reduced || !global.IntersectionObserver) {
      nodes.forEach(run);
      return;
    }

    var io = new global.IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            run(e.target);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });
  };

  /* ---------------------------------------------------------
     Kinetic headline
     --------------------------------------------------------- */

  /* Gradient-clipped text and per-word masks are fundamentally at odds.
     `background-clip: text` paints the gradient across one element's box, but a
     word mask needs each word to be its own inline-block — so the words inherit
     the transparent text fill and lose the gradient entirely (they paint
     nothing at all). Giving every word its own gradient isn't the fix either:
     the ramp would restart on each word and read as stripes.

     So we resolve the gradient into per-character colours instead. The stops
     are read back from the computed style, which keeps this in sync with
     --grad-text across both themes rather than hardcoding a second copy, and
     mapping each character to its index across the phrase gives a ramp that is
     monotonic through the whole line and survives wrapping. */

  /** Parse a computed linear-gradient into rgb stops positioned 0..1. */
  function parseRamp(image) {
    if (!image || image.indexOf("gradient") === -1) return null;
    var re = /rgba?\(([^)]+)\)(?:\s+([\d.]+)%)?/g;
    var stops = [];
    var m;
    while ((m = re.exec(image))) {
      var nums = m[1].split(",").map(function (v) {
        return parseFloat(v);
      });
      if (nums.length < 3 || isNaN(nums[0])) return null;
      stops.push({
        rgb: [nums[0], nums[1], nums[2]],
        at: m[2] === undefined ? null : parseFloat(m[2]) / 100,
      });
    }
    if (stops.length < 2) return null;

    // Implicit positions are distributed evenly between the explicit ones.
    if (stops[0].at === null) stops[0].at = 0;
    if (stops[stops.length - 1].at === null) stops[stops.length - 1].at = 1;
    for (var a = 0; a < stops.length; a++) {
      if (stops[a].at !== null) continue;
      var prev = a - 1;
      var next = a;
      while (stops[next].at === null) next++;
      var gap = next - prev;
      for (var k = prev + 1; k < next; k++) {
        stops[k].at =
          stops[prev].at +
          ((stops[next].at - stops[prev].at) * (k - prev)) / gap;
      }
    }
    return stops;
  }

  /** Sample the ramp at 0..1, linearly interpolating between bracketing stops. */
  function rampAt(stops, p) {
    if (p <= stops[0].at) return stops[0].rgb;
    for (var k = 1; k < stops.length; k++) {
      if (p > stops[k].at) continue;
      var a = stops[k - 1];
      var b = stops[k];
      var t = (p - a.at) / (b.at - a.at || 1);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t),
      ];
    }
    return stops[stops.length - 1].rgb;
  }

  /** True when an element paints its text through a gradient background. */
  function isClipped(node) {
    if (!global.getComputedStyle) return false;
    var cs = global.getComputedStyle(node);
    var fill = cs.webkitTextFillColor || cs.textFillColor || cs.color || "";
    var clear =
      fill === "transparent" || /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(fill);
    return clear && /gradient/.test(cs.backgroundImage || "");
  }

  /**
   * Wrap each word of an element in a rising mask. Preserves inline <em> and
   * <br> because the hero headline uses both, and resolves gradient-clipped
   * runs into per-character colours so the gradient survives the wrapping.
   */
  M.kinetic = function (el, opts) {
    if (!el || reduced) return;
    opts = opts || {};
    var step = opts.step == null ? 62 : opts.step;
    var delay = opts.delay == null ? 60 : opts.delay;
    var i = 0;

    /* Split one text node into masked words. `paint` is either null (inherit
       colour as authored) or a function mapping a character to a colour. */
    function splitText(node, child, paint) {
      var frag = document.createDocumentFragment();
      child.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          if (paint) paint.skip(part.length);
          return;
        }
        var mask = document.createElement("span");
        mask.className = "kin";
        var word = document.createElement("span");
        word.className = "kin__w";
        word.style.setProperty("--kin-delay", delay + i * step + "ms");
        if (paint) {
          for (var c = 0; c < part.length; c++) {
            var glyph = document.createElement("span");
            glyph.style.color = paint.next();
            glyph.textContent = part.charAt(c);
            word.appendChild(glyph);
          }
        } else {
          word.textContent = part;
        }
        mask.appendChild(word);
        frag.appendChild(mask);
        i++;
      });
      node.replaceChild(frag, child);
    }

    function walk(node, paint) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          splitText(node, child, paint);
          return;
        }
        if (child.nodeType !== 1 || child.tagName === "BR") return;
        if (paint || !isClipped(child)) {
          walk(child, paint);
          return;
        }
        var stops = parseRamp(global.getComputedStyle(child).backgroundImage);
        // Couldn't read the ramp: leave the element alone. A missing animation
        // is a far smaller defect than invisible words.
        if (!stops) return;
        walk(child, painter(child, stops));
      });
    }

    /* Hands out the colour for each successive character of an element, and
       swaps the element's own clip for a normal fill so those colours show.
       Inline styles because the stylesheet rule that set up the clip is more
       specific than any class we could add here. */
    function painter(node, stops) {
      var total = node.textContent.length;
      var seen = 0;
      node.style.background = "none";
      node.style.color = "inherit";
      node.style.webkitTextFillColor = "currentColor";
      return {
        next: function () {
          var p = total > 1 ? seen / (total - 1) : 0;
          seen++;
          return "rgb(" + rampAt(stops, p).join(",") + ")";
        },
        skip: function (n) {
          seen += n;
        },
      };
    }

    walk(el, null);
  };

  /* ---------------------------------------------------------
     Progress
     --------------------------------------------------------- */

  /**
   * Animate every .bar__fill and .ring in a container from zero, and mark
   * genuinely-empty bars so they render as a ghost track rather than looking
   * like a bar that failed to draw.
   */
  M.progress = function (root) {
    var bars = Array.prototype.slice.call(root.querySelectorAll(".bar"));
    bars.forEach(function (bar) {
      var fill = bar.querySelector(".bar__fill");
      if (!fill) return;
      var target = fill.style.width || "0%";
      var pct = parseFloat(target) || 0;
      if (pct <= 0.01) {
        bar.setAttribute("data-empty", "1");
        return;
      }
      bar.removeAttribute("data-empty");
      if (reduced) return;
      fill.style.width = "0%";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          fill.style.width = target;
        });
      });
    });

    if (reduced) return;
    var rings = Array.prototype.slice.call(root.querySelectorAll(".ring"));
    rings.forEach(function (ring) {
      var target = ring.style.getPropertyValue("--pct");
      if (!target) return;
      ring.style.setProperty("--pct", "0");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          ring.style.setProperty("--pct", target);
        });
      });
    });
  };

  /* ---------------------------------------------------------
     Page enter
     --------------------------------------------------------- */

  /** Standard per-view treatment: reveal sections, count numbers, run bars. */
  M.enterView = function (root, opts) {
    opts = opts || {};
    M.progress(root);
    M.counters(root);
    if (opts.reveal) {
      M.reveal(root, { selector: opts.reveal, step: opts.step, max: opts.max });
    }
  };

  M.reduced = reduced;

  global.Motion = M;
})(window);
