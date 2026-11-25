// Mede a força dos três níveis do computador em partidas de 3 jogadores.
const E = require('../src/engine.js');
const NAMES = { 1: 'fácil', 2: 'médio', 3: 'difícil' };
function game(seed, levels) {
  const st = E.newGame({ seed, players: levels.map((level, i) => ({ name: 'J' + i, bot: true, level })) });
  let steps = 0;
  while (st.phase !== 'over') {
    E.apply(st, E.botAction(st));
    for (const p of st.players) for (const v of Object.values(p.res)) if (v < 0) throw new Error('recurso negativo');
    if (++steps > 80000 || st.turn > 2000) return null;
  }
  return st;
}
function table(label, base, N = 300) {
  const wins = {}, rounds = []; let timeouts = 0, errors = 0;
  for (let g = 0; g < N; g++) {
    const shift = g % base.length, levels = base.map((_, i) => base[(i + shift) % base.length]);
    try {
      const st = game(5000 + g, levels);
      if (!st) { timeouts++; continue; }
      const lv = levels[st.winner]; wins[lv] = (wins[lv] || 0) + 1; rounds.push(st.turn / levels.length);
    } catch (e) { errors++; if (errors < 3) console.log('ERRO', e.message); }
  }
  const n = rounds.length, avg = rounds.reduce((s, x) => s + x, 0) / n;
  const seats = {}; for (const l of base) seats[l] = (seats[l] || 0) + 1;
  const share = Object.keys(seats).map(l => `${NAMES[l]} ${(100 * (wins[l] || 0) / n / seats[l]).toFixed(0)}% por lugar`).join(' · ');
  console.log(`${label.padEnd(26)} ${share} | ${avg.toFixed(1)} rodadas | sem fim ${timeouts} | erros ${errors}`);
}
table('difícil x médio x médio', [3, 2, 2]);
table('fácil x médio x médio', [1, 2, 2]);
table('difícil x fácil x fácil', [3, 1, 1]);
table('difícil x difícil x médio', [3, 3, 2]);
table('três fáceis', [1, 1, 1], 150);
table('três difíceis', [3, 3, 3], 150);
