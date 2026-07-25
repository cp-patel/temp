/* MITRON MAYHEM — all artwork is drawn procedurally with canvas paths.
   Zero image assets: the whole game is a few kilobytes of vector maths.
   The caricature is deliberately cuddly-chibi: affectionate parody, not insult. */
(function (MM) {
  'use strict';

  const art = (MM.art = {});
  const C = MM.C;
  const d = MM.d;

  /* ------------------------------------------------------------------ NETAJI
     Draw the star of the show as a bust. (x, y) is the base of the torso.
     s = 1 gives a figure roughly 230px tall. */
  art.modi = function (g, x, y, s, o) {
    o = o || {};
    const mouth = o.mouth || 'smile';
    const eyes = o.eyes || 'open';
    const arms = o.arms || 'none';
    const kurta = o.kurta || C.saffron;
    const vest = o.vest || '#2b2f45';
    const t = o.t || 0;
    const breathe = Math.sin(t * 2.2) * 1.6;
    const tilt = o.tilt || 0;
    const LEG = o.legs ? 88 : 0; // when he has legs, (x,y) is the feet

    g.save();
    g.translate(x, y);
    g.scale(s * (o.flip ? -1 : 1), s);

    // ---- ground shadow
    g.save();
    g.globalAlpha = 0.22;
    d.ellipse(g, 0, 6, o.legs ? 54 : 92, 13, '#000');
    g.restore();

    // ---- churidar legs (only for the running round)
    if (o.legs) {
      const ph = o.legs === 'run' ? Math.sin(t * 9) : 0;
      [-1, 1].forEach((sg, i) => {
        const a = ph * (i ? -0.6 : 0.6);
        g.save();
        g.translate(sg * 21, -LEG + 10);
        g.rotate(a);
        d.fillRR(g, -13, 0, 26, LEG, 11, '#f2efe6'); // churidar
        g.save();
        g.globalAlpha = 0.12;
        d.fillRR(g, 4, 0, 9, LEG, 5, '#000');
        g.restore();
        d.fillRR(g, -16, LEG - 6, 34, 12, 6, '#5a4632'); // chappal
        g.restore();
      });
    }

    g.translate(0, -LEG);

    const hy = -168 + breathe; // head centre

    // ---- torso: kurta
    g.beginPath();
    g.moveTo(-46, -142 + breathe);
    g.quadraticCurveTo(-96, -122 + breathe, -104, 0);
    g.lineTo(104, 0);
    g.quadraticCurveTo(96, -122 + breathe, 46, -142 + breathe);
    g.closePath();
    g.fillStyle = kurta;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)';
    g.lineWidth = 3;
    g.stroke();

    // ---- the Modi jacket / sadri, half-open over the kurta
    g.fillStyle = vest;
    [-1, 1].forEach((sgn) => {
      g.beginPath();
      g.moveTo(sgn * 40, -140 + breathe);
      g.quadraticCurveTo(sgn * 92, -118 + breathe, sgn * 100, 0);
      g.lineTo(sgn * 26, 0);
      g.quadraticCurveTo(sgn * 20, -80 + breathe, sgn * 34, -136 + breathe);
      g.closePath();
      g.fill();
    });
    d.fillRR(g, -26, -150 + breathe, 52, 22, 8, C.white);

    // ---- arms, drawn IN FRONT of the torso so poses actually read
    // `ang` is measured OUTWARD from straight-down, so both arms mirror
    const sleeve = (sx, ang, len, hand) => {
      g.save();
      g.translate(sx * 0.86, -128 + breathe);
      g.rotate(-Math.sign(sx || 1) * ang);
      d.fillRR(g, -18, -8, 36, len, 18, kurta);
      g.save();
      g.globalAlpha = 0.14;
      d.fillRR(g, 3, -8, 15, len, 8, '#000');
      g.restore();
      if (hand !== false) {
        d.circle(g, 0, len - 2, 17, C.skin);
        d.circle(g, 0, len - 2, 17, null);
        g.strokeStyle = 'rgba(0,0,0,.18)';
        g.lineWidth = 2;
        g.stroke();
      }
      g.restore();
    };

    if (arms === 'hug') {
      const w = o.hugT === undefined ? 1 : o.hugT;
      const ha = MM.lerp(1.3, -0.42, w); // wide open → wrapped around
      sleeve(-62, ha, 96);
      sleeve(62, ha, 96);
    } else if (arms === 'namaste') {
      sleeve(-58, -0.72, 78, false);
      sleeve(58, -0.72, 78, false);
      g.save();
      g.translate(0, -172 + breathe);
      g.fillStyle = C.skin;
      g.beginPath();
      g.moveTo(-17, 30);
      g.quadraticCurveTo(-21, -14, 0, -28);
      g.quadraticCurveTo(21, -14, 17, 30);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,.22)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, -26);
      g.lineTo(0, 28);
      g.stroke();
      g.restore();
    } else if (arms === 'up') {
      sleeve(-58, 2.5, 96);
      sleeve(58, 2.5, 96);
    } else if (arms === 'wave') {
      sleeve(-58, 0.5, 86);
      sleeve(58, 2.3 + Math.sin(t * 9) * 0.3, 96);
    } else if (arms === 'point') {
      sleeve(-58, 0.45, 86);
      sleeve(58, 1.85 + Math.sin(t * 2) * 0.12, 100);
    } else if (arms === 'run') {
      sleeve(-58, 0.62 + Math.sin(t * 9) * 0.6, 84);
      sleeve(58, 0.62 - Math.sin(t * 9) * 0.6, 84);
    } else if (arms !== 'none') {
      sleeve(-58, 0.42, 88);
      sleeve(58, 0.42, 88);
    }

    // ---- neck
    g.fillStyle = C.skinShade;
    d.rr(g, -19, hy + 38, 38, 36, 12);
    g.fill();

    g.save();
    g.translate(0, hy);
    g.rotate(tilt);

    const ey = 2;

    // ---- ears
    d.ellipse(g, -57, ey + 6, 11, 16, C.skinShade);
    d.ellipse(g, 57, ey + 6, 11, 16, C.skinShade);

    // ---- head
    g.beginPath();
    g.moveTo(-55, -6);
    g.quadraticCurveTo(-58, -62, 0, -66);
    g.quadraticCurveTo(58, -62, 55, -6);
    g.quadraticCurveTo(52, 48, 0, 56);
    g.quadraticCurveTo(-52, 48, -55, -6);
    g.closePath();
    g.fillStyle = C.skin;
    g.fill();

    // ---- hair: full cap, then a skin-coloured forehead cut back over it,
    //      which reads instantly as the famous receding silver hairline
    g.fillStyle = C.hair;
    g.beginPath();
    g.moveTo(-56, ey + 4);
    g.quadraticCurveTo(-60, -64, 0, -68);
    g.quadraticCurveTo(60, -64, 56, ey + 4);
    g.quadraticCurveTo(46, -14, 0, -16);
    g.quadraticCurveTo(-46, -14, -56, ey + 4);
    g.closePath();
    g.fill();
    g.fillStyle = C.skin;
    g.beginPath();
    g.moveTo(-42, -22);
    g.quadraticCurveTo(0, -58, 42, -22);
    g.quadraticCurveTo(0, -34, -42, -22);
    g.closePath();
    g.fill();
    g.save(); // soft shading on the crown
    g.globalAlpha = 0.55;
    g.fillStyle = C.hairShade;
    g.beginPath();
    g.moveTo(-52, ey + 2);
    g.quadraticCurveTo(-52, -34, -30, -46);
    g.quadraticCurveTo(-40, -20, -40, ey + 2);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(52, ey + 2);
    g.quadraticCurveTo(52, -34, 30, -46);
    g.quadraticCurveTo(40, -20, 40, ey + 2);
    g.closePath();
    g.fill();
    g.restore();

    // ---- beard: frames the jaw and hangs below the chin
    g.fillStyle = C.hair;
    g.beginPath();
    g.moveTo(-55, ey + 4);
    g.quadraticCurveTo(-56, ey + 46, -30, ey + 62);
    g.quadraticCurveTo(0, ey + 74, 30, ey + 62);
    g.quadraticCurveTo(56, ey + 46, 55, ey + 4);
    g.quadraticCurveTo(40, ey + 22, 0, ey + 24);
    g.quadraticCurveTo(-40, ey + 22, -55, ey + 4);
    g.closePath();
    g.fill();
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = C.hairShade;
    g.beginPath();
    g.moveTo(-30, ey + 60);
    g.quadraticCurveTo(0, ey + 72, 30, ey + 60);
    g.quadraticCurveTo(0, ey + 62, -30, ey + 60);
    g.closePath();
    g.fill();
    g.restore();

    // ---- muzzle: skin patch so the mouth is never lost in the beard
    d.ellipse(g, 0, ey + 40, 27, 17, C.skin);

    // ---- moustache sits on top of the muzzle
    g.fillStyle = C.hair;
    g.beginPath();
    g.moveTo(-28, ey + 24);
    g.quadraticCurveTo(0, ey + 18, 28, ey + 24);
    g.quadraticCurveTo(14, ey + 34, 0, ey + 31);
    g.quadraticCurveTo(-14, ey + 34, -28, ey + 24);
    g.closePath();
    g.fill();

    // ---- mouth
    const my = ey + 42;
    g.save();
    if (mouth === 'talk') {
      const open = 3 + Math.abs(Math.sin(t * 13)) * 10;
      d.ellipse(g, 0, my + 1, 13, open, '#6b2530');
      d.ellipse(g, 0, my + 1 + open * 0.45, 8, open * 0.38, '#c8566a');
    } else if (mouth === 'o') {
      d.ellipse(g, 0, my, 11, 12, '#6b2530');
    } else if (mouth === 'grin') {
      g.fillStyle = '#6b2530';
      g.beginPath();
      g.moveTo(-21, my - 5);
      g.quadraticCurveTo(0, my + 15, 21, my - 5);
      g.closePath();
      g.fill();
      d.fillRR(g, -17, my - 5, 34, 7, 3, C.white);
    } else if (mouth === 'flat') {
      g.strokeStyle = '#6b2530';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-15, my);
      g.lineTo(15, my);
      g.stroke();
    } else if (mouth === 'sad') {
      g.strokeStyle = '#6b2530';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-16, my + 5);
      g.quadraticCurveTo(0, my - 7, 16, my + 5);
      g.stroke();
    } else {
      g.strokeStyle = '#6b2530';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-18, my - 3);
      g.quadraticCurveTo(0, my + 11, 18, my - 3);
      g.stroke();
    }
    g.restore();

    // ---- nose
    g.strokeStyle = C.skinShade;
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, ey + 4);
    g.quadraticCurveTo(5, ey + 18, -4, ey + 20);
    g.stroke();

    // ---- eyes
    if (eyes === 'closed') {
      g.strokeStyle = C.ink;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-32, ey);
      g.quadraticCurveTo(-22, ey + 8, -12, ey);
      g.moveTo(12, ey);
      g.quadraticCurveTo(22, ey + 8, 32, ey);
      g.stroke();
    } else {
      const rx = eyes === 'wide' ? 12 : 10;
      const ry = eyes === 'wide' ? 12 : 9;
      [-22, 22].forEach((ex, i) => {
        if (eyes === 'wink' && i === 1) {
          g.strokeStyle = C.ink;
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(ex - 10, ey);
          g.quadraticCurveTo(ex, ey + 8, ex + 10, ey);
          g.stroke();
          return;
        }
        d.ellipse(g, ex, ey, rx, ry, C.white);
        const look = o.look || 0;
        d.circle(g, ex + look * 4, ey + 1, ry * 0.55, C.ink);
        d.circle(g, ex + look * 4 - 2, ey - 2, 2.2, C.white);
      });
    }

    // ---- eyebrows
    g.strokeStyle = '#e9e6e0';
    g.lineWidth = 7;
    g.lineCap = 'round';
    const browY = o.brow === 'up' ? -20 : -14;
    g.beginPath();
    g.moveTo(-34, browY + 3);
    g.quadraticCurveTo(-22, browY - 5, -10, browY + 1);
    g.moveTo(34, browY + 3);
    g.quadraticCurveTo(22, browY - 5, 10, browY + 1);
    g.stroke();

    // ---- glasses
    g.strokeStyle = 'rgba(30,26,40,.9)';
    g.lineWidth = 3.5;
    d.rr(g, -38, ey - 13, 32, 26, 9);
    g.stroke();
    d.rr(g, 6, ey - 13, 32, 26, 9);
    g.stroke();
    g.beginPath();
    g.moveTo(-6, ey - 4);
    g.lineTo(6, ey - 4);
    g.moveTo(-38, ey - 7);
    g.lineTo(-54, ey - 12);
    g.moveTo(38, ey - 7);
    g.lineTo(54, ey - 12);
    g.stroke();
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = C.white;
    g.fillRect(-34, ey - 10, 9, 20);
    g.fillRect(10, ey - 10, 9, 20);
    g.restore();

    g.restore(); // head
    g.restore(); // figure
  };

  /* ------------------------------------------------------- VISHWA NETA (leader)
     Generic world-leader silhouettes for the hug / selfie rounds. */
  const LEADERS = [
    { name: 'PRESIDENT', suit: '#25314f', tie: '#c0392b', skin: '#f0c9a4', hair: '#5b4636' },
    { name: 'CHANCELLOR', suit: '#3a3f52', tie: '#2980b9', skin: '#f2d3b3', hair: '#d9d2c5' },
    { name: 'PM', suit: '#1f2a38', tie: '#f1c40f', skin: '#8d5a3b', hair: '#221a16' },
    { name: 'MONSIEUR', suit: '#2c2c3a', tie: '#8e44ad', skin: '#eec9a8', hair: '#3b2f2a' },
    { name: 'SENATOR', suit: '#37474f', tie: '#16a085', skin: '#c98d63', hair: '#6b6b6b' },
    { name: 'CEO SAHAB', suit: '#455a64', tie: '#ecf0f1', skin: '#f0d0b0', hair: '#4a3b2f' },
  ];
  art.LEADERS = LEADERS;

  art.leader = function (g, x, y, s, i, o) {
    o = o || {};
    const L = LEADERS[i % LEADERS.length];
    const t = o.t || 0;
    g.save();
    g.translate(x, y);
    g.scale(s * (o.flip ? -1 : 1), s);

    g.save();
    g.globalAlpha = 0.2;
    d.ellipse(g, 0, 6, 78, 14, '#000');
    g.restore();

    const bob = Math.sin(t * 6) * 2;
    // torso
    g.beginPath();
    g.moveTo(-40, -132 + bob);
    g.quadraticCurveTo(-84, -112 + bob, -90, 0);
    g.lineTo(90, 0);
    g.quadraticCurveTo(84, -112 + bob, 40, -132 + bob);
    g.closePath();
    g.fillStyle = L.suit;
    g.fill();
    // shirt + tie
    g.fillStyle = C.white;
    g.beginPath();
    g.moveTo(-20, -134 + bob);
    g.lineTo(20, -134 + bob);
    g.lineTo(12, -40 + bob);
    g.lineTo(-12, -40 + bob);
    g.closePath();
    g.fill();
    g.fillStyle = L.tie;
    g.beginPath();
    g.moveTo(-7, -128 + bob);
    g.lineTo(7, -128 + bob);
    g.lineTo(4, -52 + bob);
    g.lineTo(-4, -52 + bob);
    g.closePath();
    g.fill();
    // arms in front of the suit
    const armAng = o.arms === 'hug' ? 1.35 : 0.34;
    [-1, 1].forEach((sg) => {
      g.save();
      g.translate(sg * 52, -112 + bob);
      g.rotate(-sg * armAng);
      d.fillRR(g, -15, -8, 30, 88, 15, L.suit);
      d.circle(g, 0, 78, 14, L.skin);
      g.restore();
    });
    // head
    const hy = -160 + bob;
    d.ellipse(g, -46, hy + 6, 9, 13, L.skin);
    d.ellipse(g, 46, hy + 6, 9, 13, L.skin);
    d.ellipse(g, 0, hy, 46, 52, L.skin);
    g.fillStyle = L.hair;
    g.beginPath();
    g.moveTo(-47, hy - 8);
    g.quadraticCurveTo(0, hy - 66, 47, hy - 8);
    g.quadraticCurveTo(20, hy - 30, -47, hy - 8);
    g.closePath();
    g.fill();
    // face
    d.circle(g, -17, hy, 4.5, C.ink);
    d.circle(g, 17, hy, 4.5, C.ink);
    g.strokeStyle = '#8d4a4a';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    if (o.mood === 'shock') {
      g.moveTo(-8, hy + 26);
      g.quadraticCurveTo(0, hy + 14, 8, hy + 26);
    } else {
      g.moveTo(-14, hy + 20);
      g.quadraticCurveTo(0, hy + 32, 14, hy + 20);
    }
    g.stroke();
    g.restore();

    if (o.label !== false) {
      const ly = y - 232 * s;
      const w = MM.d.measure(g, L.name, 15) + 22;
      d.fillRR(g, x - w / 2, ly - 14, w, 26, 8, 'rgba(11,21,51,.8)');
      MM.d.text(g, L.name, x, ly, { size: 15, fill: C.white });
    }
  };

  /* --------------------------------------------------------------- PROPS */

  art.chai = function (g, x, y, s, fill, opt) {
    // kulhad of cutting chai; fill 0..1 (over 1 = spilling)
    s = s || 1;
    const o = opt || {};
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    // clay body
    g.fillStyle = '#b06a3e';
    g.beginPath();
    g.moveTo(-28, -40);
    g.lineTo(28, -40);
    g.lineTo(20, 22);
    g.quadraticCurveTo(0, 30, -20, 22);
    g.closePath();
    g.fill();
    g.save();
    g.globalAlpha = 0.22;
    g.fillStyle = '#000';
    g.beginPath();
    g.moveTo(10, -40);
    g.lineTo(28, -40);
    g.lineTo(20, 22);
    g.quadraticCurveTo(14, 26, 8, 27);
    g.closePath();
    g.fill();
    g.restore();
    // tea
    const f = MM.clamp(fill === undefined ? 0.7 : fill, 0, 1.12);
    if (f > 0) {
      const top = MM.lerp(20, -36, f);
      g.save();
      g.beginPath();
      g.moveTo(-27, -38);
      g.lineTo(27, -38);
      g.lineTo(19, 20);
      g.quadraticCurveTo(0, 27, -19, 20);
      g.closePath();
      g.clip();
      g.fillStyle = '#8a5322';
      g.fillRect(-30, top, 60, 70);
      d.ellipse(g, 0, top, 26, 5, '#c08a4e');
      g.restore();
    }
    // rim
    g.strokeStyle = '#8d4f28';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-28, -40);
    g.lineTo(28, -40);
    g.stroke();
    if (o.steam) {
      g.save();
      g.globalAlpha = 0.45;
      g.strokeStyle = C.white;
      g.lineWidth = 4;
      g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        const ph = (o.t || 0) * 2 + i;
        g.moveTo(i * 12, -46);
        g.quadraticCurveTo(i * 12 + Math.sin(ph) * 10, -66, i * 12 + Math.cos(ph) * 8, -84);
        g.stroke();
      }
      g.restore();
    }
    g.restore();
  };

  art.note = function (g, x, y, s, denom, rot) {
    const cols = { 2000: '#e75ba6', 500: '#9b8bbd', 1000: '#c0a0d0', 200: '#f0b45a', 10: '#c98d63' };
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);
    d.fillRR(g, -46, -24, 92, 48, 6, cols[denom] || '#bcd');
    d.strokeRR(g, -46, -24, 92, 48, 6, 'rgba(0,0,0,.35)', 2);
    g.save();
    g.globalAlpha = 0.35;
    d.circle(g, 24, 0, 15, '#fff');
    g.restore();
    MM.d.text(g, '₹' + denom, -8, 0, { size: 22, fill: '#2b1a2b', stroke: 'rgba(255,255,255,.6)', lw: 4 });
    g.restore();
  };

  art.diya = function (g, x, y, s, lit, t) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = '#8d4b25';
    g.beginPath();
    g.moveTo(-22, 0);
    g.quadraticCurveTo(0, 20, 22, 0);
    g.quadraticCurveTo(0, -8, -22, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#b96a37';
    d.ellipse(g, 0, -1, 20, 6, '#b96a37');
    if (lit) {
      const fl = 1 + Math.sin((t || 0) * 12) * 0.14;
      g.save();
      g.globalAlpha = 0.5;
      d.circle(g, 0, -20, 26 * fl, 'rgba(255,190,80,.5)');
      g.restore();
      g.fillStyle = C.gold;
      g.beginPath();
      g.moveTo(-7, -6);
      g.quadraticCurveTo(-8, -26 * fl, 0, -34 * fl);
      g.quadraticCurveTo(8, -26 * fl, 7, -6);
      g.closePath();
      g.fill();
      g.fillStyle = '#fff6d0';
      g.beginPath();
      g.moveTo(-3, -8);
      g.quadraticCurveTo(-3, -20 * fl, 0, -25 * fl);
      g.quadraticCurveTo(3, -20 * fl, 3, -8);
      g.closePath();
      g.fill();
    }
    g.restore();
  };

  art.thali = function (g, x, y, s, hit) {
    g.save();
    g.translate(x, y);
    g.scale(s * (hit ? 1.08 : 1), s * (hit ? 0.94 : 1));
    d.circle(g, 0, 0, 52, '#c9ccd4');
    d.circle(g, 0, 0, 42, '#e3e6ec');
    d.circle(g, 0, 0, 16, '#b9bcc6');
    g.strokeStyle = 'rgba(0,0,0,.2)';
    g.lineWidth = 3;
    d.circle(g, 0, 0, 52);
    g.stroke();
    g.restore();
  };

  art.broom = function (g, x, y, s, ang) {
    g.save();
    g.translate(x, y);
    g.rotate(ang || 0);
    g.scale(s, s);
    d.fillRR(g, -6, -110, 12, 110, 6, '#a9762f');
    g.fillStyle = '#d9b463';
    g.beginPath();
    g.moveTo(-10, 0);
    g.lineTo(10, 0);
    g.lineTo(26, 58);
    g.lineTo(-26, 58);
    g.closePath();
    g.fill();
    g.strokeStyle = '#b9954a';
    g.lineWidth = 2;
    for (let i = -5; i <= 5; i++) {
      g.beginPath();
      g.moveTo(i * 2, 4);
      g.lineTo(i * 5, 56);
      g.stroke();
    }
    d.fillRR(g, -12, -6, 24, 12, 5, '#7f5a22');
    g.restore();
  };

  art.trash = function (g, x, y, s, kind, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);
    if (kind === 0) {
      // crumpled paper
      g.fillStyle = '#efe9d8';
      g.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * MM.TAU;
        const r = 14 + MM.hash(i * 3.3) * 8;
        i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = '#c7bfa8';
      g.lineWidth = 2;
      g.stroke();
    } else if (kind === 1) {
      // banana peel
      g.strokeStyle = '#e9c94a';
      g.lineWidth = 9;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-16, 6);
      g.quadraticCurveTo(0, -14, 16, 6);
      g.stroke();
      g.strokeStyle = '#d3b03a';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(-10, 8);
      g.quadraticCurveTo(0, -6, 12, 8);
      g.stroke();
    } else {
      // plastic bottle
      d.fillRR(g, -8, -18, 16, 30, 6, 'rgba(160,220,255,.75)');
      d.fillRR(g, -5, -26, 10, 10, 3, '#4aa3d8');
    }
    g.restore();
  };

  art.plane = function (g, x, y, s, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);
    g.fillStyle = '#dfe6ee';
    g.beginPath();
    g.moveTo(46, 0);
    g.quadraticCurveTo(20, -14, -34, -10);
    g.lineTo(-46, -2);
    g.lineTo(-46, 6);
    g.quadraticCurveTo(0, 16, 46, 0);
    g.closePath();
    g.fill();
    g.fillStyle = C.saffron;
    g.beginPath();
    g.moveTo(6, -4);
    g.lineTo(-16, -34);
    g.lineTo(-2, -34);
    g.lineTo(18, -4);
    g.closePath();
    g.fill();
    g.fillStyle = C.green;
    g.beginPath();
    g.moveTo(6, 4);
    g.lineTo(-16, 30);
    g.lineTo(-2, 30);
    g.lineTo(18, 4);
    g.closePath();
    g.fill();
    d.ellipse(g, 26, -3, 8, 5, '#7fd8ff');
    g.restore();
  };

  art.cloud = function (g, x, y, s, alpha) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.globalAlpha = alpha === undefined ? 0.95 : alpha;
    g.fillStyle = '#f4f7fb';
    [
      [-48, 6, 30],
      [-14, -10, 40],
      [24, 2, 32],
      [54, 10, 24],
    ].forEach(([cx, cy, r]) => d.circle(g, cx, cy, r, '#f4f7fb'));
    g.fillStyle = 'rgba(190,205,225,.9)';
    [
      [-40, 20, 22],
      [-6, 24, 26],
      [30, 20, 20],
    ].forEach(([cx, cy, r]) => d.circle(g, cx, cy, r, 'rgba(205,216,232,.95)'));
    g.restore();
  };

  art.radio = function (g, x, y, s, dial, glow) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    d.fillRR(g, -130, -80, 260, 160, 18, '#7b4b25');
    d.fillRR(g, -118, -68, 236, 136, 12, '#8d5a2d');
    d.fillRR(g, -104, -52, 108, 104, 10, '#3b2617');
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 9; i++) g.fillRect(-100, -46 + i * 12, 100, 5);
    d.fillRR(g, 12, -52, 100, 46, 8, '#efe2c4');
    g.strokeStyle = '#5b3d20';
    g.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
      g.beginPath();
      g.moveTo(18 + i * 8.8, -48);
      g.lineTo(18 + i * 8.8, i % 5 === 0 ? -36 : -42);
      g.stroke();
    }
    g.strokeStyle = C.danger;
    g.lineWidth = 3;
    g.beginPath();
    const dx = 18 + MM.clamp(dial, 0, 1) * 88;
    g.moveTo(dx, -50);
    g.lineTo(dx, -12);
    g.stroke();
    d.circle(g, 62, 34, 24, '#c9a15e');
    d.circle(g, 62, 34, 16, '#a8823f');
    if (glow) {
      g.save();
      g.globalAlpha = 0.5 + Math.sin(glow * 10) * 0.3;
      d.circle(g, 62, 34, 30, 'rgba(120,255,140,.6)');
      g.restore();
    }
    g.restore();
  };

  art.pakoda = function (g, x, y, s, cook) {
    // cook: 0 raw → 1 golden → >1 burnt
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    const c = cook < 1 ? `hsl(${MM.lerp(52, 32, cook)},${MM.lerp(55, 82, cook)}%,${MM.lerp(72, 46, cook)}%)` : `hsl(20,30%,${MM.lerp(40, 14, MM.clamp(cook - 1, 0, 1))}%)`;
    g.fillStyle = c;
    g.beginPath();
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * MM.TAU;
      const r = 17 + MM.hash(i * 7.7) * 9;
      i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.save();
    g.globalAlpha = 0.35;
    d.circle(g, -5, -6, 5, '#fff');
    g.restore();
    g.restore();
  };

  art.kadhai = function (g, x, y, s, t) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.fillStyle = '#3d3d46';
    g.beginPath();
    g.ellipse(0, 0, 140, 46, 0, 0, Math.PI);
    g.closePath();
    g.fill();
    d.ellipse(g, 0, 0, 140, 30, '#4b4b56');
    d.ellipse(g, 0, 2, 128, 24, '#d9a03f');
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = '#f0c46a';
    for (let i = 0; i < 8; i++) {
      const ph = t * 3 + i;
      d.circle(g, Math.sin(ph) * 100, 2 + Math.cos(ph * 1.3) * 8, 3 + (Math.sin(ph * 2) + 1) * 2, '#f7dda0');
    }
    g.restore();
    g.restore();
  };

  art.lotus = function (g, x, y, s, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(s, s);
    for (let i = -2; i <= 2; i++) {
      g.save();
      g.rotate(i * 0.42);
      g.fillStyle = i === 0 ? '#ff9fc0' : '#ff7fa8';
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-16, -34, 0, -56);
      g.quadraticCurveTo(16, -34, 0, 0);
      g.closePath();
      g.fill();
      g.restore();
    }
    d.ellipse(g, 0, 2, 26, 9, '#f2c14e');
    g.restore();
  };

  /* Speech bubble with tail — used constantly for the meme captions. */
  art.bubble = function (g, x, y, w, h, text, opt) {
    const o = opt || {};
    g.save();
    d.fillRR(g, x - w / 2, y - h / 2, w, h, 18, o.bg || C.white);
    g.beginPath();
    const tx = x + (o.tailX === undefined ? 0 : o.tailX);
    g.moveTo(tx - 16, y + h / 2 - 2);
    g.lineTo(tx + 16, y + h / 2 - 2);
    g.lineTo(tx + (o.tailDx || 0), y + h / 2 + 26);
    g.closePath();
    g.fillStyle = o.bg || C.white;
    g.fill();
    d.strokeRR(g, x - w / 2, y - h / 2, w, h, 18, o.border || C.ink, 4);
    const lines = Array.isArray(text) ? text : [text];
    lines.forEach((ln, i) =>
      MM.d.text(g, ln, x, y - ((lines.length - 1) * (o.lh || 26)) / 2 + i * (o.lh || 26), {
        size: o.size || 24,
        fill: o.fg || C.ink,
      })
    );
    g.restore();
  };

  /* Stick-figure yoga asanas for the Simon-says round. */
  art.asana = function (g, x, y, s, pose, color) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.strokeStyle = color || C.white;
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const P = {
      up: [[0, -30, 0, 30], [0, -18, -26, -52], [0, -18, 26, -52], [0, 30, -18, 66], [0, 30, 18, 66]],
      down: [[0, -30, 0, 30], [0, -18, -30, 4], [0, -18, 30, 4], [0, 30, -22, 62], [0, 30, 22, 62]],
      left: [[0, -30, 0, 30], [0, -14, -44, -22], [0, -14, 14, -34], [0, 30, -20, 64], [0, 30, 20, 64]],
      right: [[0, -30, 0, 30], [0, -14, 44, -22], [0, -14, -14, -34], [0, 30, -20, 64], [0, 30, 20, 64]],
    }[pose] || [];
    P.forEach(([x1, y1, x2, y2]) => {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    });
    d.circle(g, 0, -46, 15, color || C.white);
    g.restore();
  };

  /* Arrow glyph, used for prompts. */
  art.arrow = function (g, x, y, s, dir, color) {
    const rot = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[dir] || 0;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(s, s);
    g.fillStyle = color || C.white;
    g.beginPath();
    g.moveTo(-14, -8);
    g.lineTo(2, -8);
    g.lineTo(2, -18);
    g.lineTo(20, 0);
    g.lineTo(2, 18);
    g.lineTo(2, 8);
    g.lineTo(-14, 8);
    g.closePath();
    g.fill();
    g.restore();
  };
})(window.MM);
