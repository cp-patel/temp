/* ============================================================
   Block renderer — turns chapter body data into DOM
   ============================================================ */
(function (global) {
  "use strict";

  var R = {};
  var el = U.el;
  var esc = U.esc;
  var md = U.md;

  var NOTE_META = {
    insight: { icon: "bulb", label: "Insight" },
    pitfall: { icon: "alert", label: "Pitfall" },
    warn: { icon: "alert", label: "Watch out" },
    pro: { icon: "spark", label: "Pro tip" },
    money: { icon: "dollar", label: "Economics" },
  };

  var RES_ICON = {
    docs: "doc",
    paper: "doc",
    pdf: "doc",
    article: "doc",
    guide: "book",
    video: "video",
    repo: "code",
    tool: "beaker",
    research: "graph",
  };

  /* ---------------- code block ---------------- */

  function codeBlock(b) {
    var wrap = el("div", "codeblock");
    var bar = el("div", "codeblock__bar");
    bar.innerHTML =
      '<span class="codeblock__lang">' +
      esc(b.lang || "text") +
      "</span>" +
      (b.caption
        ? '<span class="codeblock__cap">' + esc(b.caption) + "</span>"
        : "");
    var copy = el("button", "codeblock__copy");
    copy.type = "button";
    copy.innerHTML = Icons.get("copy", 12) + " Copy";
    copy.onclick = function () {
      U.copy(b.code).then(function () {
        copy.innerHTML = Icons.get("check", 12) + " Copied";
        copy.classList.add("is-ok");
        setTimeout(function () {
          copy.innerHTML = Icons.get("copy", 12) + " Copy";
          copy.classList.remove("is-ok");
        }, 1600);
      });
    };
    bar.appendChild(copy);

    var pre = el("pre");
    var code = el("code");
    code.innerHTML = U.highlight(b.code);
    pre.appendChild(code);

    wrap.appendChild(bar);
    wrap.appendChild(pre);
    return wrap;
  }

  /* ---------------- inline knowledge check ---------------- */

  function checkBlock(b, chapterId) {
    var wrap = el("div", "check");
    wrap.innerHTML =
      '<div class="check__h">' +
      Icons.get("target", 15) +
      " Check your understanding</div>" +
      '<div class="check__q">' +
      md(b.q) +
      "</div>";

    var opts = el("div", "opts");
    var answered = Store.getCheck(chapterId, b.key) !== undefined;
    var why = null;

    b.options.forEach(function (text, i) {
      var btn = el("button", "opt");
      btn.type = "button";
      btn.innerHTML =
        '<span class="opt__k">' +
        String.fromCharCode(65 + i) +
        "</span>" +
        "<span>" +
        md(text) +
        "</span>";
      btn.onclick = function () {
        if (btn.disabled) return;
        var correct = i === b.answer;
        Store.saveCheck(chapterId, b.key, correct);
        reveal(i);
      };
      opts.appendChild(btn);
    });

    function reveal(picked) {
      var buttons = U.qa(".opt", opts);
      buttons.forEach(function (btn, i) {
        btn.disabled = true;
        btn.querySelector(".opt__k").innerHTML =
          i === b.answer
            ? Icons.get("check", 12)
            : i === picked
              ? Icons.get("x", 12)
              : String.fromCharCode(65 + i);
        if (i === b.answer) btn.classList.add("is-right");
        else if (i === picked) btn.classList.add("is-wrong");
        else btn.classList.add("is-muted");
      });
      if (!why) {
        why = el("div", "why");
        why.innerHTML =
          '<div class="why__ic">' +
          Icons.get("bulb", 16) +
          "</div><div><b>" +
          (picked === b.answer ? "Correct. " : "Not quite. ") +
          "</b>" +
          md(b.why) +
          "</div>";
        wrap.appendChild(why);
      }
    }

    wrap.appendChild(opts);
    if (answered) {
      // restore state without re-awarding XP; we only know correctness
      var wasRight = Store.getCheck(chapterId, b.key);
      reveal(wasRight ? b.answer : -1);
    }
    return wrap;
  }

  /* ---------------- other blocks ---------------- */

  function noteBlock(b) {
    var meta = NOTE_META[b.kind] || NOTE_META.insight;
    var n = el("div", "callout callout--" + (b.kind || "insight"));
    n.innerHTML =
      '<div class="callout__ic">' +
      Icons.get(meta.icon, 16) +
      "</div>" +
      '<div><div class="callout__t">' +
      esc(b.title || meta.label) +
      "</div>" +
      '<div class="callout__b">' +
      md(b.text) +
      "</div></div>";
    return n;
  }

  function tableBlock(b) {
    /* Two elements: an outer box that owns the border, the radius and the edge
       fades, and an inner scroller. The fades can't live on the scroller itself
       — a pseudo-element of a scroll container scrolls with its content, and the
       background-attachment trick is painted over by the table's own cells.

       These tables compare values across columns, so they scroll rather than
       reflow into stacked cards; that keeps them useful on a phone, but a
       clipped column with no affordance reads as broken content rather than as
       "there is more this way". */
    var box = el("div", "tablebox");
    var wrap = el("div", "tablewrap");
    var html = "<table><thead><tr>";
    b.head.forEach(function (h) {
      html += "<th>" + md(h) + "</th>";
    });
    html += "</tr></thead><tbody>";
    b.rows.forEach(function (row) {
      html += "<tr>";
      row.forEach(function (c) {
        html += "<td>" + md(c) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
    box.appendChild(wrap);

    /* Which fades to show. The listener is on the scroller, so it is collected
       with the element on navigation — nothing to clean up. */
    function edges() {
      var slack = wrap.scrollWidth - wrap.clientWidth;
      if (slack < 4) {
        box.dataset.edge = "none";
        return;
      }
      var atStart = wrap.scrollLeft < 4;
      var atEnd = wrap.scrollLeft > slack - 4;
      box.dataset.edge = atStart ? "end" : atEnd ? "start" : "both";
    }
    wrap.addEventListener("scroll", edges, { passive: true });
    // Widths aren't known until layout; check on the next frame and on resize.
    requestAnimationFrame(edges);
    if (global.ResizeObserver) new global.ResizeObserver(edges).observe(wrap);
    return box;
  }

  function stepsBlock(b) {
    var wrap = el("div", "steps");
    b.items.forEach(function (it, i) {
      var s = el("div", "step");
      s.innerHTML =
        '<div class="step__n">' +
        (i + 1) +
        "</div>" +
        '<div><div class="step__t">' +
        md(it.title) +
        "</div>" +
        '<div class="step__b">' +
        md(it.text) +
        "</div></div>";
      wrap.appendChild(s);
    });
    return wrap;
  }

  function compareBlock(b) {
    var wrap = el("div", "compare");
    [b.left, b.right].forEach(function (col, idx) {
      if (!col) return;
      var kind = col.kind || (idx === 0 ? "good" : "bad");
      var c = el("div", "cmpcol cmpcol--" + kind);
      var items = col.items
        .map(function (i) {
          return "<li>" + md(i) + "</li>";
        })
        .join("");
      c.innerHTML =
        '<div class="cmpcol__h">' +
        Icons.get(kind === "good" ? "checkCircle" : "xCircle", 16) +
        " " +
        esc(col.title) +
        "</div><ul>" +
        items +
        "</ul>";
      wrap.appendChild(c);
    });
    return wrap;
  }

  function flowBlock(b) {
    var wrap = el("div", "flow");
    var row = el("div", "flow__row");
    b.nodes.forEach(function (n, i) {
      if (i > 0) {
        var a = el("div", "flow__arrow");
        a.innerHTML = Icons.get("arrowRight", 18);
        row.appendChild(a);
      }
      var node = el("div", "flow__node" + (n.c ? " flow__node--" + n.c : ""));
      node.innerHTML =
        "<b>" +
        esc(n.b) +
        "</b>" +
        (n.s ? "<span>" + esc(n.s) + "</span>" : "");
      row.appendChild(node);
    });
    wrap.appendChild(row);
    if (b.cap) wrap.appendChild(el("div", "flow__cap", md(b.cap)));
    return wrap;
  }

  function listBlock(b) {
    var tag = b.ordered ? "ol" : "ul";
    var n = el(tag);
    b.items.forEach(function (i) {
      n.appendChild(el("li", null, md(i)));
    });
    return n;
  }

  /* ---------------- main body renderer ---------------- */

  R.body = function (blocks, chapterId) {
    var frag = document.createDocumentFragment();
    var headings = [];

    blocks.forEach(function (b) {
      var node = null;
      switch (b.t) {
        case "h":
          var id = "s-" + U.slug(b.text);
          node = el("h2", null, md(b.text));
          node.id = id;
          headings.push({ id: id, text: b.text, sub: false });
          break;
        case "h3":
          var id3 = "s-" + U.slug(b.text);
          node = el("h3", null, md(b.text));
          node.id = id3;
          headings.push({ id: id3, text: b.text, sub: true });
          break;
        case "p":
          node = el("p", null, md(b.text));
          break;
        case "code":
          node = codeBlock(b);
          break;
        case "note":
          node = noteBlock(b);
          break;
        case "table":
          node = tableBlock(b);
          break;
        case "steps":
          node = stepsBlock(b);
          break;
        case "compare":
          node = compareBlock(b);
          break;
        case "flow":
          node = flowBlock(b);
          break;
        case "list":
          node = listBlock(b);
          break;
        case "quote":
          node = el(
            "blockquote",
            null,
            md(b.text) + (b.by ? "<cite>" + esc(b.by) + "</cite>" : "")
          );
          break;
        case "check":
          node = checkBlock(b, chapterId);
          break;
        case "lab":
          node = el("div");
          Labs.mount(b.id, node);
          break;
        default:
          node = null;
      }
      if (node) frag.appendChild(node);
    });

    return { frag: frag, headings: headings };
  };

  /* ---------------- takeaways ---------------- */

  R.takeaways = function (items) {
    var wrap = el("div", "takeaways");
    wrap.innerHTML =
      "<h3>" +
      Icons.get("spark", 17) +
      " Key takeaways</h3><ol>" +
      items
        .map(function (i) {
          return "<li><span>" + md(i) + "</span></li>";
        })
        .join("") +
      "</ol>";
    return wrap;
  };

  /* ---------------- quiz ---------------- */

  R.quiz = function (ch) {
    var wrap = el("div", "quiz");
    var prev = (Store.state().progress[ch.id] || {}).quiz;

    var head = el("div", "quiz__head");
    head.innerHTML =
      '<div class="quiz__ic">' +
      Icons.get("trophy", 18) +
      "</div>" +
      '<div class="u-grow"><h3>Chapter quiz</h3><p>' +
      U.plural(ch.quiz.length, "question") +
      " · " +
      (Store.XP.quizItem * ch.quiz.length + Store.XP.perfect) +
      " XP available</p></div>" +
      '<div class="quiz__score"></div>';
    var scoreSlot = head.querySelector(".quiz__score");

    function paintScore(right, total) {
      scoreSlot.innerHTML =
        '<div class="ring" style="--pct:' +
        (right / total) * 100 +
        '">' +
        '<span class="ring__label">' +
        right +
        "/" +
        total +
        "</span></div>";
    }
    if (prev) paintScore(prev.right, prev.total);

    var body = el("div", "quiz__body");
    var picked = {};

    ch.quiz.forEach(function (q, qi) {
      var item = el("div", "qitem");
      item.innerHTML =
        '<div class="qitem__n">Question ' +
        (qi + 1) +
        "</div>" +
        '<div class="qitem__q">' +
        md(q.q) +
        "</div>";
      var opts = el("div", "opts");

      q.options.forEach(function (text, i) {
        var btn = el("button", "opt");
        btn.type = "button";
        btn.innerHTML =
          '<span class="opt__k">' +
          String.fromCharCode(65 + i) +
          "</span>" +
          "<span>" +
          md(text) +
          "</span>";
        btn.onclick = function () {
          if (picked[qi] !== undefined) return;
          picked[qi] = i;
          var buttons = U.qa(".opt", opts);
          buttons.forEach(function (b2, j) {
            b2.disabled = true;
            b2.querySelector(".opt__k").innerHTML =
              j === q.answer
                ? Icons.get("check", 12)
                : j === i
                  ? Icons.get("x", 12)
                  : String.fromCharCode(65 + j);
            if (j === q.answer) b2.classList.add("is-right");
            else if (j === i) b2.classList.add("is-wrong");
            else b2.classList.add("is-muted");
          });
          var why = el("div", "why");
          why.innerHTML =
            '<div class="why__ic">' +
            Icons.get("bulb", 16) +
            "</div><div><b>" +
            (i === q.answer ? "Correct. " : "Not quite. ") +
            "</b>" +
            md(q.why) +
            "</div>";
          item.appendChild(why);
          maybeFinish();
        };
        opts.appendChild(btn);
      });

      item.appendChild(opts);
      body.appendChild(item);
    });

    var footer = el("div", "quiz__foot");
    var bar = el("div", "resultbar");
    footer.appendChild(bar);
    bar.innerHTML =
      '<div class="resultbar__msg u-dim">Answer all ' +
      ch.quiz.length +
      " questions to record your score.</div>";

    function maybeFinish() {
      var answered = Object.keys(picked).length;
      if (answered < ch.quiz.length) {
        bar.innerHTML =
          '<div class="resultbar__msg u-dim">' +
          answered +
          " of " +
          ch.quiz.length +
          " answered.</div>";
        return;
      }
      var right = 0;
      ch.quiz.forEach(function (q, i) {
        if (picked[i] === q.answer) right++;
      });
      Store.saveQuiz(ch.id, right, ch.quiz.length);
      paintScore(right, ch.quiz.length);

      var pct = right / ch.quiz.length;
      var msg =
        pct === 1
          ? "<b>Perfect.</b> You've got this chapter."
          : pct >= 0.7
            ? "<b>" +
              right +
              " of " +
              ch.quiz.length +
              ".</b> Solid — reread the explanations you missed."
            : "<b>" +
              right +
              " of " +
              ch.quiz.length +
              ".</b> Worth another pass through the chapter before moving on.";

      bar.innerHTML = '<div class="resultbar__msg">' + msg + "</div>";
      var retry = el("button", "btn btn--outline btn--sm");
      retry.innerHTML = Icons.get("reset", 14) + " Retry";
      retry.onclick = function () {
        App.go("#/chapter/" + ch.id, true);
      };
      bar.appendChild(retry);
    }

    wrap.appendChild(head);
    wrap.appendChild(body);
    wrap.appendChild(footer);
    return wrap;
  };

  /* ---------------- resources ---------------- */

  R.resources = function (items) {
    var wrap = el("div", "reslist");
    wrap.appendChild(el("h3", null, "Go deeper"));
    items.forEach(function (r) {
      var a = el("a", "res");
      a.href = r.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML =
        '<span class="res__ic">' +
        Icons.get(RES_ICON[r.kind] || "link", 13) +
        "</span>" +
        '<span class="res__t">' +
        esc(r.title) +
        "</span>" +
        '<span class="res__k">' +
        esc(r.kind) +
        "</span>" +
        Icons.get("ext", 14);
      wrap.appendChild(a);
    });
    return wrap;
  };

  global.Render = R;
})(window);
