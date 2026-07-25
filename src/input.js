/* MITRON MAYHEM — unified input: keyboard, mouse, touch, on-screen pad.
   Microgames only ever ask three things:
     I.down('left')      held this frame
     I.hit('action')     pressed since last frame (edge)
     I.p                 pointer position in logical canvas coords (+ .down/.hit) */
(function (MM) {
  'use strict';

  const I = (MM.input = {});

  const MAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    Space: 'action',
    Enter: 'action',
    NumpadEnter: 'action',
    KeyJ: 'action',
    Escape: 'pause',
    KeyP: 'pause',
    KeyM: 'mute',
  };

  const held = {};
  const edge = {};
  const consumed = {};

  I.p = { x: MM.W / 2, y: MM.H / 2, down: false, hit: false, moved: false };
  I.anyRecent = 0; // seconds since any input, used by attract mode

  I.down = (k) => !!held[k];
  I.hit = function (k) {
    if (edge[k] && !consumed[k]) {
      consumed[k] = true;
      return true;
    }
    return false;
  };
  I.anyHit = () => I.hit('action') || I.hit('left') || I.hit('right') || I.hit('up') || I.hit('down') || I.pHit();
  I.pHit = function () {
    if (I.p.hit && !consumed.__p) {
      consumed.__p = true;
      return true;
    }
    return false;
  };

  I.press = function (k) {
    if (!held[k]) edge[k] = true;
    held[k] = true;
    delete consumed[k];
    I.anyRecent = 0;
  };
  I.release = function (k) {
    held[k] = false;
  };

  /* Called once per frame at the end of the loop. */
  I.endFrame = function () {
    for (const k in edge) edge[k] = false;
    for (const k in consumed) delete consumed[k];
    I.p.hit = false;
    I.p.moved = false;
  };

  I.clear = function () {
    for (const k in held) held[k] = false;
    for (const k in edge) edge[k] = false;
    I.p.down = false;
  };

  let canvas = null;
  let scale = 1;
  let ox = 0;
  let oy = 0;

  I.setTransform = function (s, x, y) {
    scale = s;
    ox = x;
    oy = y;
  };

  function toLogical(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return {
      x: MM.clamp((cx - r.left - ox) / scale, 0, MM.W),
      y: MM.clamp((cy - r.top - oy) / scale, 0, MM.H),
    };
  }

  I.attach = function (cv) {
    canvas = cv;

    addEventListener(
      'keydown',
      (e) => {
        const k = MAP[e.code];
        if (k) {
          e.preventDefault();
          I.press(k);
        }
        // let games read raw digits for the quiz rounds
        if (/^Digit[1-4]$/.test(e.code)) I.press('num' + e.code.slice(5));
      },
      { passive: false }
    );

    addEventListener('keyup', (e) => {
      const k = MAP[e.code];
      if (k) I.release(k);
      if (/^Digit[1-4]$/.test(e.code)) I.release('num' + e.code.slice(5));
    });

    addEventListener('blur', I.clear);

    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      const p = toLogical(e.clientX, e.clientY);
      I.p.x = p.x;
      I.p.y = p.y;
      I.p.down = true;
      I.p.hit = true;
      delete consumed.__p;
      I.anyRecent = 0;
      touchStart = { x: p.x, y: p.y, t: performance.now() };
      I.press('action'); // tap doubles as the action button
    });

    cv.addEventListener('pointermove', (e) => {
      const p = toLogical(e.clientX, e.clientY);
      I.p.x = p.x;
      I.p.y = p.y;
      I.p.moved = true;
      if (I.p.down && touchStart) swipeCheck(p);
    });

    const up = () => {
      I.p.down = false;
      I.release('action');
      I.release('left');
      I.release('right');
      I.release('up');
      I.release('down');
      touchStart = null;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    /* Swipes map onto the d-pad so every microgame is playable on a phone. */
    let touchStart = null;
    function swipeCheck(p) {
      const dx = p.x - touchStart.x;
      const dy = p.y - touchStart.y;
      if (Math.hypot(dx, dy) < 40) return;
      if (Math.abs(dx) > Math.abs(dy)) I.press(dx > 0 ? 'right' : 'left');
      else I.press(dy > 0 ? 'down' : 'up');
      touchStart = { x: p.x, y: p.y, t: performance.now() };
    }
  };

  /* Hook up the DOM on-screen buttons (mobile). */
  I.bindButton = function (el, key) {
    const down = (e) => {
      e.preventDefault();
      I.press(key);
    };
    const up = (e) => {
      e.preventDefault();
      I.release(key);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  };
})(window.MM);
