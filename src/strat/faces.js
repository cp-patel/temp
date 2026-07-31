/* CHUNAV CHANAKYA — the cast, drawn as vector caricatures.
   One parametric portrait function; each character is a config of traits
   (hair, beard, glasses, attire, prop). Affectionate cartoon archetypes —
   nobody is depicted doing anything, they are campaign chess pieces. */
(function (root) {
  'use strict';

  const SG = (root.SG = root.SG || {});
  const d = root.MM.d;

  const FACES = {
    chief: { skin: '#e0a878', hair: 'recede', hairCol: '#f2f0ec', beard: 'full', beardCol: '#f2f0ec', glasses: 1, attire: 'kurta-vest', kurta: '#ff9933', vest: '#2b2f45' },
    yuvraj: { skin: '#dfa87c', hair: 'short', hairCol: '#3a3129', beard: 'trim', beardCol: '#6b5d4d', glasses: 0, attire: 'tee', kurta: '#f7f7f4' },
    muffler: { skin: '#dda878', hair: 'recede', hairCol: '#4a4038', beard: 'mous', beardCol: '#4a4038', glasses: 1, attire: 'muffler', kurta: '#8fa2b8', prop: 'muffler' },
    chanakya: { skin: '#dba774', hair: 'bald-side', hairCol: '#efeae2', beard: 'none', glasses: 0, attire: 'kurta', kurta: '#f6f4ef', vest: '#3a4055' },
    maharaj: { skin: '#e0ad80', hair: 'shaved', hairCol: '#c9a06a', beard: 'none', glasses: 0, attire: 'robe', kurta: '#ff7a2f', prop: 'mala' },
    suit: { skin: '#e3b183', hair: 'wave', hairCol: '#241d18', beard: 'stubble', beardCol: '#3a2f26', glasses: 1, attire: 'suit', kurta: '#25304a', tie: '#c94f6d' },
    didi: { skin: '#dda87e', hair: 'bob', hairCol: '#e9e6df', beard: 'none', glasses: 0, attire: 'saree', kurta: '#fbfbf7', border: '#3d6fd0', prop: 'chappal' },
    thesaurus: { skin: '#e2b489', hair: 'silver', hairCol: '#e4e1da', beard: 'mous', beardCol: '#dcd8cf', glasses: 0, attire: 'bandh', kurta: '#3d3f52', prop: 'book' },
    palti: { skin: '#dfa97c', hair: 'recede', hairCol: '#efeae2', beard: 'mous', beardCol: '#cfcbc2', glasses: 1, attire: 'kurta', kurta: '#f4f2ec', vest: '#7a6f5e', prop: 'switch' },
    khata: { skin: '#e0aa7f', hair: 'bun', hairCol: '#2c2620', beard: 'none', glasses: 1, attire: 'saree', kurta: '#e7d9c3', border: '#8a5a2a', prop: 'ledger' },
  };
  SG.FACES = FACES;

  /* (x, y) is the CENTRE of the head. s = 1 → about a 96px tall head. */
  SG.face = function (g, x, y, s, id, opt) {
    const f = FACES[id] || FACES.chief;
    const o = opt || {};
    g.save();
    g.translate(x, y);
    g.scale(s, s);

    // ---- shoulders / attire behind the head
    if (o.bust !== false) {
      g.save();
      g.translate(0, 62);
      const A = f.attire;
      if (A === 'suit' || A === 'bandh') {
        g.fillStyle = f.kurta;
        g.beginPath();
        g.moveTo(-30, -8);
        g.quadraticCurveTo(-62, 4, -68, 56);
        g.lineTo(68, 56);
        g.quadraticCurveTo(62, 4, 30, -8);
        g.closePath();
        g.fill();
        g.fillStyle = '#fbfbf8';
        g.beginPath();
        g.moveTo(-14, -8);
        g.lineTo(14, -8);
        g.lineTo(9, 40);
        g.lineTo(-9, 40);
        g.closePath();
        g.fill();
        if (A === 'suit') {
          g.fillStyle = f.tie || '#c0392b';
          g.beginPath();
          g.moveTo(-5, -6);
          g.lineTo(5, -6);
          g.lineTo(3, 38);
          g.lineTo(-3, 38);
          g.closePath();
          g.fill();
        } else {
          g.fillStyle = f.kurta;
          d.fillRR(g, -15, -10, 30, 16, 5, f.kurta);
          g.fillStyle = '#e0c060';
          [8, 20, 32].forEach((yy) => d.circle(g, 0, yy, 2.6, '#e0c060'));
        }
      } else if (A === 'saree') {
        g.fillStyle = f.kurta;
        g.beginPath();
        g.moveTo(-28, -8);
        g.quadraticCurveTo(-60, 4, -66, 56);
        g.lineTo(66, 56);
        g.quadraticCurveTo(60, 4, 28, -8);
        g.closePath();
        g.fill();
        g.strokeStyle = f.border || '#3d6fd0';
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(-24, -4);
        g.quadraticCurveTo(-6, 30, 26, 56);
        g.stroke();
      } else if (A === 'robe') {
        g.fillStyle = f.kurta;
        g.beginPath();
        g.moveTo(-28, -8);
        g.quadraticCurveTo(-60, 6, -66, 56);
        g.lineTo(66, 56);
        g.quadraticCurveTo(60, 6, 28, -8);
        g.closePath();
        g.fill();
        g.save();
        g.globalAlpha = 0.25;
        g.fillStyle = '#000';
        g.fillRect(10, -8, 16, 64);
        g.restore();
      } else if (A === 'muffler') {
        g.fillStyle = f.kurta;
        g.beginPath();
        g.moveTo(-30, -6);
        g.quadraticCurveTo(-62, 6, -68, 56);
        g.lineTo(68, 56);
        g.quadraticCurveTo(62, 6, 30, -6);
        g.closePath();
        g.fill();
        // the muffler itself
        g.fillStyle = '#c9443f';
        d.fillRR(g, -40, -14, 80, 22, 11, '#c9443f');
        d.fillRR(g, 16, 0, 20, 46, 9, '#b13a36');
      } else if (A === 'tee') {
        g.fillStyle = f.kurta;
        g.beginPath();
        g.moveTo(-30, -6);
        g.quadraticCurveTo(-62, 6, -66, 56);
        g.lineTo(66, 56);
        g.quadraticCurveTo(62, 6, 30, -6);
        g.closePath();
        g.fill();
        g.strokeStyle = '#d8d8d2';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(0, -10, 17, 0.25, Math.PI - 0.25);
        g.stroke();
      } else {
        // plain kurta, optional Modi-style waistcoat
        g.fillStyle = f.kurta;
        g.beginPath();
        g.moveTo(-30, -6);
        g.quadraticCurveTo(-62, 6, -68, 56);
        g.lineTo(68, 56);
        g.quadraticCurveTo(62, 6, 30, -6);
        g.closePath();
        g.fill();
        if (f.vest) {
          g.fillStyle = f.vest;
          [-1, 1].forEach((sg) => {
            g.beginPath();
            g.moveTo(sg * 26, -6);
            g.quadraticCurveTo(sg * 60, 6, sg * 66, 56);
            g.lineTo(sg * 18, 56);
            g.quadraticCurveTo(sg * 14, 20, sg * 22, -4);
            g.closePath();
            g.fill();
          });
        }
      }
      g.restore();
    }

    // ---- neck
    g.fillStyle = f.skin;
    d.fillRR(g, -13, 26, 26, 30, 9, f.skin);

    // ---- ears
    d.ellipse(g, -38, 6, 8, 11, f.skin);
    d.ellipse(g, 38, 6, 8, 11, f.skin);

    // ---- head
    g.beginPath();
    g.moveTo(-37, -6);
    g.quadraticCurveTo(-39, -44, 0, -47);
    g.quadraticCurveTo(39, -44, 37, -6);
    g.quadraticCurveTo(35, 32, 0, 38);
    g.quadraticCurveTo(-35, 32, -37, -6);
    g.closePath();
    g.fillStyle = f.skin;
    g.fill();

    // ---- hair
    g.fillStyle = f.hairCol;
    const H = f.hair;
    if (H === 'recede' || H === 'silver') {
      g.beginPath();
      g.moveTo(-38, 2);
      g.quadraticCurveTo(-41, -46, 0, -49);
      g.quadraticCurveTo(41, -46, 38, 2);
      g.quadraticCurveTo(31, -10, 0, -12);
      g.quadraticCurveTo(-31, -10, -38, 2);
      g.closePath();
      g.fill();
      g.fillStyle = f.skin;
      g.beginPath();
      g.moveTo(-28, -16);
      g.quadraticCurveTo(0, -40, 28, -16);
      g.quadraticCurveTo(0, -24, -28, -16);
      g.closePath();
      g.fill();
    } else if (H === 'bald-side') {
      g.beginPath();
      g.moveTo(-38, 4);
      g.quadraticCurveTo(-40, -26, -24, -34);
      g.quadraticCurveTo(-30, -14, -28, 4);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(38, 4);
      g.quadraticCurveTo(40, -26, 24, -34);
      g.quadraticCurveTo(30, -14, 28, 4);
      g.closePath();
      g.fill();
    } else if (H === 'shaved') {
      g.save();
      g.globalAlpha = 0.35;
      g.beginPath();
      g.moveTo(-37, -8);
      g.quadraticCurveTo(-39, -46, 0, -49);
      g.quadraticCurveTo(39, -46, 37, -8);
      g.quadraticCurveTo(0, -20, -37, -8);
      g.closePath();
      g.fill();
      g.restore();
      // tilak
      g.fillStyle = '#d9573f';
      d.fillRR(g, -3, -34, 6, 16, 3, '#d9573f');
    } else if (H === 'short' || H === 'stubbleHair') {
      g.beginPath();
      g.moveTo(-38, -2);
      g.quadraticCurveTo(-40, -48, 0, -50);
      g.quadraticCurveTo(40, -48, 38, -2);
      g.quadraticCurveTo(20, -26, 0, -24);
      g.quadraticCurveTo(-20, -26, -38, -2);
      g.closePath();
      g.fill();
    } else if (H === 'wave') {
      g.beginPath();
      g.moveTo(-38, -4);
      g.quadraticCurveTo(-42, -50, 2, -50);
      g.quadraticCurveTo(42, -50, 38, -4);
      g.quadraticCurveTo(26, -22, 6, -26);
      g.quadraticCurveTo(-16, -30, -38, -4);
      g.closePath();
      g.fill();
    } else if (H === 'bob') {
      g.beginPath();
      g.moveTo(-42, 18);
      g.quadraticCurveTo(-46, -50, 0, -50);
      g.quadraticCurveTo(46, -50, 42, 18);
      g.quadraticCurveTo(30, 4, 26, -14);
      g.quadraticCurveTo(0, -26, -26, -14);
      g.quadraticCurveTo(-30, 4, -42, 18);
      g.closePath();
      g.fill();
    } else if (H === 'bun') {
      g.beginPath();
      g.moveTo(-38, 0);
      g.quadraticCurveTo(-40, -48, 0, -50);
      g.quadraticCurveTo(40, -48, 38, 0);
      g.quadraticCurveTo(24, -24, 0, -22);
      g.quadraticCurveTo(-24, -24, -38, 0);
      g.closePath();
      g.fill();
      d.circle(g, 0, -52, 15, f.hairCol);
      g.save();
      g.globalAlpha = 0.3;
      d.circle(g, -4, -56, 6, '#fff');
      g.restore();
    }

    // ---- beard
    if (f.beard && f.beard !== 'none') {
      g.fillStyle = f.beardCol || '#eee';
      if (f.beard === 'full') {
        g.beginPath();
        g.moveTo(-36, 2);
        g.quadraticCurveTo(-37, 30, -20, 42);
        g.quadraticCurveTo(0, 50, 20, 42);
        g.quadraticCurveTo(37, 30, 36, 2);
        g.quadraticCurveTo(26, 16, 0, 17);
        g.quadraticCurveTo(-26, 16, -36, 2);
        g.closePath();
        g.fill();
        d.ellipse(g, 0, 26, 18, 11, f.skin);
      } else if (f.beard === 'trim') {
        g.save();
        g.globalAlpha = 0.9;
        g.beginPath();
        g.moveTo(-34, 6);
        g.quadraticCurveTo(-34, 28, -16, 37);
        g.quadraticCurveTo(0, 43, 16, 37);
        g.quadraticCurveTo(34, 28, 34, 6);
        g.quadraticCurveTo(24, 18, 0, 19);
        g.quadraticCurveTo(-24, 18, -34, 6);
        g.closePath();
        g.fill();
        g.restore();
        d.ellipse(g, 0, 25, 15, 9, f.skin);
      } else if (f.beard === 'stubble') {
        g.save();
        g.globalAlpha = 0.28;
        g.beginPath();
        g.moveTo(-33, 8);
        g.quadraticCurveTo(-32, 30, 0, 38);
        g.quadraticCurveTo(32, 30, 33, 8);
        g.quadraticCurveTo(0, 22, -33, 8);
        g.closePath();
        g.fill();
        g.restore();
      }
      // moustache for everyone who has one
      if (f.beard === 'mous' || f.beard === 'full' || f.beard === 'trim') {
        g.fillStyle = f.beardCol || '#eee';
        g.beginPath();
        g.moveTo(-17, 15);
        g.quadraticCurveTo(0, 10, 17, 15);
        g.quadraticCurveTo(8, 22, 0, 19);
        g.quadraticCurveTo(-8, 22, -17, 15);
        g.closePath();
        g.fill();
      }
    }

    // ---- eyes + brows
    const ey = -2;
    [-14, 14].forEach((ex) => {
      d.ellipse(g, ex, ey, 7, 6, '#fff');
      d.circle(g, ex + (o.look || 0) * 2, ey + 1, 3.2, '#1a1526');
      d.circle(g, ex - 1, ey - 1, 1.1, '#fff');
    });
    g.strokeStyle = f.hair === 'recede' || f.hair === 'silver' || f.hair === 'bald-side' ? '#e6e2da' : '#3a3129';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-22, ey - 11);
    g.quadraticCurveTo(-14, ey - 15, -7, ey - 11);
    g.moveTo(22, ey - 11);
    g.quadraticCurveTo(14, ey - 15, 7, ey - 11);
    g.stroke();

    // ---- glasses
    if (f.glasses) {
      g.strokeStyle = 'rgba(28,24,38,.9)';
      g.lineWidth = 2.6;
      d.rr(g, -25, ey - 9, 21, 17, 6);
      g.stroke();
      d.rr(g, 4, ey - 9, 21, 17, 6);
      g.stroke();
      g.beginPath();
      g.moveTo(-4, ey - 2);
      g.lineTo(4, ey - 2);
      g.moveTo(-25, ey - 4);
      g.lineTo(-36, ey - 8);
      g.moveTo(25, ey - 4);
      g.lineTo(36, ey - 8);
      g.stroke();
    }

    // ---- nose + mouth
    g.strokeStyle = 'rgba(0,0,0,.22)';
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(0, ey + 3);
    g.quadraticCurveTo(3, ey + 11, -2, ey + 13);
    g.stroke();
    g.strokeStyle = '#7d3a44';
    g.lineWidth = 3;
    g.beginPath();
    if (o.mood === 'flat') {
      g.moveTo(-9, 26);
      g.lineTo(9, 26);
    } else if (o.mood === 'sad') {
      g.moveTo(-9, 28);
      g.quadraticCurveTo(0, 22, 9, 28);
    } else {
      g.moveTo(-10, 24);
      g.quadraticCurveTo(0, 31, 10, 24);
    }
    g.stroke();

    // ---- signature prop
    const P = f.prop;
    if (P === 'book') {
      d.fillRR(g, 30, 66, 26, 20, 3, '#c9552f');
      d.fillRR(g, 33, 69, 20, 14, 2, '#f3ead2');
    } else if (P === 'ledger') {
      d.fillRR(g, 28, 64, 30, 22, 3, '#8a5a2a');
      d.fillRR(g, 31, 67, 24, 16, 2, '#f6efdd');
      g.strokeStyle = '#b09a72';
      g.lineWidth = 1;
      [71, 75, 79].forEach((yy) => {
        g.beginPath();
        g.moveTo(33, yy);
        g.lineTo(53, yy);
        g.stroke();
      });
    } else if (P === 'chappal') {
      g.save();
      g.translate(40, 74);
      g.rotate(-0.3);
      d.fillRR(g, -12, -5, 24, 11, 5, '#7a5a3a');
      g.strokeStyle = '#4a3728';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-6, -4);
      g.lineTo(2, 2);
      g.stroke();
      g.restore();
    } else if (P === 'switch') {
      d.fillRR(g, 30, 66, 24, 18, 4, '#2f3a4a');
      d.fillRR(g, 33, 69, 8, 12, 2, '#7de08a');
      d.fillRR(g, 43, 69, 8, 12, 2, '#e07d7d');
    } else if (P === 'mala') {
      g.strokeStyle = '#b07a3a';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 46, 26, 0.35, Math.PI - 0.35);
      g.stroke();
      for (let i = 0; i < 7; i++) {
        const a = 0.45 + (i / 6) * (Math.PI - 0.9);
        d.circle(g, Math.cos(a) * 26, 46 + Math.sin(a) * 26, 3, '#8a5a2a');
      }
    }

    g.restore();
  };

  /* Small chip used in the HUD: portrait + nick + ability name. */
  SG.leaderChip = function (g, x, y, w, h, id, opt) {
    const o = opt || {};
    const L = SG.leaderById(id);
    if (!L) return;
    d.fillRR(g, x, y, w, h, 10, o.bg || 'rgba(255,255,255,.07)');
    if (o.hot) d.strokeRR(g, x, y, w, h, 10, o.hotColor || '#ffd447', 2.5);
    g.save();
    g.beginPath();
    d.rr(g, x + 4, y + 4, h - 8, h - 8, 8);
    g.clip();
    g.fillStyle = 'rgba(255,255,255,.09)';
    g.fillRect(x + 4, y + 4, h - 8, h - 8);
    SG.face(g, x + h / 2, y + h * 0.52, (h - 8) / 116, id, { bust: true });
    g.restore();
    d.text(g, L.nick, x + h + 6, y + h * 0.34, { size: 13, align: 'left', fill: '#fff' });
    d.text(g, o.sub || L.action.name, x + h + 6, y + h * 0.66, {
      size: 11,
      weight: 700,
      align: 'left',
      fill: o.subColor || 'rgba(255,255,255,.62)',
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SG;
})(typeof window !== 'undefined' ? window : globalThis);
