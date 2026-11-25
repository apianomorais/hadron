// Testes do motor: partidas completas com bots e com ações legais aleatórias.
const E = require('../src/engine.js');
const COLORS = ['#fff', '#f80', '#f5a', '#cf3'];

function invariants(st, tag) {
  const cards = st.deck.length + st.discard.length + st.players.reduce((s, p) => s + p.cards.length + p.points.length, 0);
  if (cards !== E.DECK_SIZE) throw new Error(`${tag}: cartas ${cards} != ${E.DECK_SIZE}`);
  for (const p of st.players) for (const [k, v] of Object.entries(p.res)) if (v < 0 || !Number.isInteger(v)) throw new Error(`${tag}: recurso ${k}=${v} de ${p.name}`);
  for (const [v, b] of Object.entries(st.buildings)) {
    for (const w of st.board.vertices[+v].adj) if (st.buildings[w]) throw new Error(`${tag}: regra de distância violada em ${v}/${w}`);
    if (!E.BUILD[b.type] || E.BUILD[b.type].tier === 3) throw new Error(`${tag}: tipo inválido ${b.type}`);
  }
  for (const r of Object.values(st.roads)) if (E.BUILD[r.type].tier !== 3) throw new Error(`${tag}: estrada inválida`);
  if (st.pending && !st.pending.options.length) throw new Error(`${tag}: pendência sem opções (${st.pending.kind})`);
  if (st.phase === 'play' && !st.pending && st.rolled === undefined) throw new Error(`${tag}: estado estranho`);
}

function play(seed, n, mode) {
  let st = E.newGame({ seed, players: Array.from({ length: n }, (_, i) => ({ name: 'J' + (i + 1), color: COLORS[i], bot: true })) });
  let steps = 0;
  const seen = new Set();
  while (st.phase !== 'over') {
    let a;
    if (mode === 'bot') a = E.botAction(st);
    else {
      const L = E.legal(st);
      if (!L.length) throw new Error('sem ações legais');
      const end = L.find(x => x.type === 'end');
      a = (end && Math.random() < 0.25) ? end : L[Math.floor(Math.random() * L.length)];
      if (!st.pending && st.rolled && Math.random() < 0.05) {
        const to = (st.current + 1) % n;
        a = { type: 'offer', to, give: { u: 1 }, get: { d: 1 } };
        if (st.players[st.current].res.u < 1) a = end;
      }
    }
    seen.add(a.type === 'card' ? 'card:' + a.id : a.type === 'pick' ? 'pick:' + st.pending.kind : a.type === 'build' ? 'build:' + a.kind : a.type);
    E.apply(st, a);
    invariants(st, `seed ${seed} passo ${steps}`);
    if (steps % 97 === 0) st = JSON.parse(JSON.stringify(st)); // estado precisa sobreviver a salvar/restaurar
    if (++steps > 60000 || st.turn > 1500) return { st, steps, seen, timeout: true };
  }
  return { st, steps, seen, timeout: false };
}

for (const mode of ['bot', 'fuzz']) {
  const N = mode === 'bot' ? 400 : 250;
  const rounds = [], allSeen = new Set(), src = {}; let timeouts = 0, err = 0;
  const firstWins = [0, 0, 0, 0], seatGames = [0, 0, 0, 0];
  for (let g = 0; g < N; g++) {
    const n = 3 + (g % 2);
    try {
      const r = play(1000 + g, n, mode);
      r.seen.forEach(x => allSeen.add(x));
      if (r.timeout) { timeouts++; continue; }
      rounds.push(r.st.turn / n);
      firstWins[r.st.winner]++; for (let i = 0; i < n; i++) seatGames[i]++;
      const b = E.vpBreak(r.st, r.st.winner);
      for (const k of Object.keys(b)) src[k] = (src[k] || 0) + b[k];
    } catch (e) { err++; if (err < 4) console.log(mode, 'ERRO', e.stack.split('\n').slice(0, 4).join(' | ')); }
  }
  rounds.sort((a, b) => a - b);
  const avg = rounds.reduce((s, x) => s + x, 0) / rounds.length;
  console.log(`\n[${mode}] partidas=${N} erros=${err} sem-fim=${timeouts}`);
  console.log(`rodadas até vencer: média ${avg.toFixed(1)} | mediana ${rounds[rounds.length >> 1]?.toFixed(1)} | p10 ${rounds[Math.floor(rounds.length * .1)]?.toFixed(1)} | p90 ${rounds[Math.floor(rounds.length * .9)]?.toFixed(1)}`);
  console.log('vitórias por posição:', firstWins.map((w, i) => seatGames[i] ? `${i + 1}º ${(100 * w / seatGames[i]).toFixed(0)}%` : '').join(' '));
  const tot = src.total || 1;
  console.log('pontos do vencedor por fonte:', Object.entries(src).filter(([k]) => k !== 'total').map(([k, v]) => `${k} ${(100 * v / tot).toFixed(0)}%`).join(', '));
  console.log('ações exercitadas:', [...allSeen].sort().join(' '));
}
