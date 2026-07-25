/* MITRON MAYHEM — collectible "Meme Cards".
   Winning a microgame for the first time unlocks its card; a few extras are
   awarded for feats. The gallery is the game's long-term hook. */
(function (MM) {
  'use strict';

  const C = MM.C;
  const d = MM.d;
  const art = MM.art;

  const cards = (MM.cards = [
    {
      id: 'mitron',
      name: 'MITRON',
      quote: '"Mitron…" — 1.4 billion people brace themselves.',
      rar: 'common',
      icon: (g, x, y, s) => art.modi(g, x, y + 48 * s, 0.42 * s, { mouth: 'talk', arms: 'up', t: 1 }),
    },
    {
      id: 'notebandi',
      name: 'NOTEBANDI',
      quote: 'Aaj raat 12 baje se… your wallet is a museum.',
      rar: 'rare',
      icon: (g, x, y, s) => {
        art.note(g, x - 14 * s, y - 6 * s, 0.7 * s, 500, -0.3);
        art.note(g, x + 14 * s, y + 12 * s, 0.7 * s, 2000, 0.25);
      },
    },
    {
      id: 'jhappi',
      name: 'VISHWA JHAPPI',
      quote: 'No world leader escapes the hug radius.',
      rar: 'rare',
      icon: (g, x, y, s) => {
        art.leader(g, x + 32 * s, y + 48 * s, 0.3 * s, 0, { arms: 'hug', label: false });
        art.modi(g, x - 20 * s, y + 48 * s, 0.36 * s, { arms: 'hug', hugT: 1, mouth: 'grin', eyes: 'closed' });
      },
    },
    {
      id: 'chai',
      name: 'CUTTING CHAI',
      quote: 'From chai stall to centre stage. One pour at a time.',
      rar: 'common',
      icon: (g, x, y, s) => art.chai(g, x, y + 10 * s, 1.1 * s, 0.75, { steam: true, t: 1 }),
    },
    {
      id: 'yoga',
      name: 'YOGA DAY',
      quote: 'Official flexibility influencer of the republic.',
      rar: 'common',
      icon: (g, x, y, s) => art.asana(g, x, y, 0.75 * s, 'up', C.saffron),
    },
    {
      id: 'jhaadu',
      name: 'SWACHH SQUAD',
      quote: 'One photo-op, one broom, one clean India.',
      rar: 'common',
      icon: (g, x, y, s) => art.broom(g, x, y + 6 * s, 0.6 * s, -0.4),
    },
    {
      id: 'radar',
      name: 'CLOUD COVER',
      quote: 'Radar? Never heard of baadal, bhai?',
      rar: 'epic',
      icon: (g, x, y, s) => {
        art.cloud(g, x, y + 12 * s, 0.6 * s, 1);
        art.plane(g, x, y - 14 * s, 0.65 * s, -0.15);
      },
    },
    {
      id: 'taali',
      name: 'THALI SYMPHONY',
      quote: '9 baje, 9 minute. The whole gully in concert.',
      rar: 'rare',
      icon: (g, x, y, s) => art.thali(g, x, y, 0.7 * s, false),
    },
    {
      id: 'selfie',
      name: 'SELFIE DIPLOMACY',
      quote: 'Foreign policy, but with a front camera.',
      rar: 'rare',
      icon: (g, x, y, s) => {
        g.save();
        g.strokeStyle = C.white;
        g.lineWidth = 5 * s;
        d.rr(g, x - 40 * s, y - 30 * s, 80 * s, 60 * s, 8 * s);
        g.stroke();
        g.restore();
        art.modi(g, x - 18 * s, y + 26 * s, 0.2 * s, { mouth: 'grin', eyes: 'wink', arms: 'up' });
        art.leader(g, x + 22 * s, y + 26 * s, 0.16 * s, 2, { label: false });
      },
    },
    {
      id: 'degree',
      name: 'ENTIRE POLITICAL SCIENCE',
      quote: 'Not partial. Not semi. ENTIRE.',
      rar: 'epic',
      icon: (g, x, y, s) => {
        d.fillRR(g, x - 40 * s, y - 26 * s, 80 * s, 54 * s, 6 * s, '#f3ead2');
        d.text(g, 'ENTIRE', x, y - 8 * s, { size: 15 * s, fill: '#5b3d20' });
        d.text(g, 'DEGREE', x, y + 12 * s, { size: 13 * s, fill: '#8a6a3a' });
        d.circle(g, x + 26 * s, y + 20 * s, 10 * s, C.danger);
      },
    },
    {
      id: 'pakoda',
      name: 'PAKODA ECONOMY',
      quote: 'Employment generated, one crispy batch at a time.',
      rar: 'rare',
      icon: (g, x, y, s) => {
        art.pakoda(g, x - 16 * s, y + 4 * s, 0.9 * s, 0.95);
        art.pakoda(g, x + 14 * s, y - 8 * s, 0.8 * s, 0.8);
        art.pakoda(g, x + 6 * s, y + 20 * s, 0.7 * s, 1.05);
      },
    },
    {
      id: 'achhedin',
      name: 'ACHHE DIN',
      quote: 'Coming soon. Since 2014. ETA loading…',
      rar: 'epic',
      icon: (g, x, y, s) => {
        d.fillRR(g, x - 46 * s, y - 24 * s, 92 * s, 44 * s, 8 * s, C.saffron);
        d.text(g, 'ACHHE', x, y - 8 * s, { size: 17 * s, fill: C.ink });
        d.text(g, 'DIN', x, y + 10 * s, { size: 17 * s, fill: C.ink });
      },
    },
    {
      id: 'diya',
      name: 'DIYA JALAO',
      quote: 'Lights off, diyas on, memes forever.',
      rar: 'common',
      icon: (g, x, y, s) => art.diya(g, x, y + 14 * s, 1.1 * s, true, 1),
    },
    {
      id: 'mannkibaat',
      name: 'MANN KI BAAT',
      quote: 'Sunday morning. Radio on. Nation listening.',
      rar: 'rare',
      icon: (g, x, y, s) => art.radio(g, x, y, 0.32 * s, 0.6, 1),
    },
    {
      id: 'boss',
      name: 'THE 8 PM ADDRESS',
      quote: 'He appeared at 8 PM. The nation held its breath.',
      rar: 'legendary',
      icon: (g, x, y, s) => {
        d.circle(g, x, y, 34 * s, '#1b1030');
        d.text(g, '8:00', x, y - 4 * s, { size: 20 * s, fill: C.gold });
        d.text(g, 'PM', x, y + 16 * s, { size: 14 * s, fill: C.white });
      },
    },
    {
      id: 'combo',
      name: '56 INCH COMBO',
      quote: 'Awarded for a 6-round streak of pure meme dominance.',
      rar: 'legendary',
      icon: (g, x, y, s) => {
        d.text(g, '56"', x, y, { size: 34 * s, fill: C.gold, stroke: C.ink, lw: 6 * s });
      },
    },
    {
      id: 'fakir',
      name: 'MAIN FAKIR HOON',
      quote: 'Jhola uthake chal padunga — after this high score.',
      rar: 'legendary',
      icon: (g, x, y, s) => {
        g.save();
        g.fillStyle = '#3f7d3a';
        g.beginPath();
        g.moveTo(x - 26 * s, y - 20 * s);
        g.quadraticCurveTo(x - 22 * s, y + 22 * s, x, y + 26 * s);
        g.quadraticCurveTo(x + 22 * s, y + 22 * s, x + 26 * s, y - 20 * s);
        g.closePath();
        g.fill();
        g.restore();
        d.text(g, 'JHOLA', x, y + 4 * s, { size: 13 * s, fill: 'rgba(255,255,255,.9)' });
      },
    },
    {
      id: 'vishwaguru',
      name: 'VISHWAGURU',
      quote: 'You have completed the entire meme multiverse. Respect.',
      rar: 'legendary',
      icon: (g, x, y, s) => art.lotus(g, x, y + 28 * s, 0.6 * s),
    },
  ]);

  MM.cardById = (id) => cards.find((c) => c.id === id);

  MM.RAR = {
    common: { c: '#9fb2c7', label: 'COMMON' },
    rare: { c: '#4ec9f5', label: 'RARE' },
    epic: { c: '#c77dff', label: 'EPIC' },
    legendary: { c: '#ffd447', label: 'LEGENDARY' },
  };

  /* Draw one card face (or its locked silhouette). */
  MM.drawCard = function (g, card, x, y, w, h, unlocked, t) {
    const r = MM.RAR[card.rar];
    g.save();
    d.fillRR(g, x, y, w, h, 14, unlocked ? 'rgba(255,255,255,.94)' : 'rgba(255,255,255,.10)');
    if (unlocked) {
      const gr = g.createLinearGradient(x, y, x, y + h);
      gr.addColorStop(0, r.c + '55');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      d.rr(g, x, y, w, h, 14);
      g.fillStyle = gr;
      g.fill();
    }
    d.strokeRR(g, x, y, w, h, 14, unlocked ? r.c : 'rgba(255,255,255,.25)', unlocked ? 4 : 2);
    const cx = x + w / 2;
    if (unlocked) {
      g.save();
      d.rr(g, x + 6, y + 6, w - 12, 74, 10);
      g.clip();
      g.fillStyle = 'rgba(11,21,51,.10)';
      g.fillRect(x, y, w, h);
      card.icon(g, cx, y + 42, Math.min(0.92, w / 200));
      g.restore();
      d.text(g, card.name, cx, y + 96, { size: Math.min(16, (w / card.name.length) * 1.85), fill: C.ink });
      // wrap the quote into two short lines
      const words = card.quote.split(' ');
      const mid = Math.ceil(words.length / 2);
      [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].forEach((ln, i) =>
        d.text(g, ln, cx, y + 114 + i * 14, { size: 10.5, weight: 600, fill: '#4a5568' })
      );
      d.text(g, r.label, cx, y + h - 12, { size: 10.5, fill: r.c === '#ffd447' ? '#a07800' : '#3d5670' });
    } else {
      d.text(g, '?', cx, y + 46, { size: 46, fill: 'rgba(255,255,255,.3)' });
      d.text(g, 'LOCKED', cx, y + 100, { size: 15, fill: 'rgba(255,255,255,.45)' });
      d.text(g, 'win the round', cx, y + 122, { size: 11, weight: 600, fill: 'rgba(255,255,255,.3)' });
    }
    g.restore();
  };
})(window.MM);
