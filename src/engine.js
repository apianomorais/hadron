/* HADRON — motor do jogo (lógica pura, sem DOM).
   Todo o estado é JSON simples: pode ser salvo e restaurado a qualquer momento. */
const HadronEngine = (() => {
'use strict';

// ---------------------------------------------------------------- constantes
const Q = ['u', 'd', 'c', 's', 't', 'b'];
const LIGHT = ['u', 'd'];
const QN = { u: 'Up', d: 'Down', c: 'Charm', s: 'Strange', t: 'Top', b: 'Bottom', e: 'Energia' };
const WIN = 12, HAND = 7, LONG_MIN = 5;
const LIMIT = { 1: 6, 2: 5, 3: 15 };
const FIELDS = ['decay', 'higgs', 'fusion'];
const FIELD_NAME = { decay: 'Campo de Decaimento', higgs: 'Campo de Higgs', fusion: 'Campo de Fusão' };
const TOKEN_SYM = { decay: 'W±', higgs: 'H⁰', fusion: 'g' };

// Distribuição definida na conversa: 16 hexágonos produtivos + 3 campos.
const TILE_SET = [
  { kind: 'u', num: 6 }, { kind: 'u', num: 8 }, { kind: 'u', num: 9 },
  { kind: 'd', num: 4 }, { kind: 'd', num: 6 }, { kind: 'd', num: 8 },
  { kind: 'c', num: 3 }, { kind: 'c', num: 5 }, { kind: 'c', num: 9 }, { kind: 'c', num: 10 },
  { kind: 's', num: 4 }, { kind: 's', num: 5 }, { kind: 's', num: 10 }, { kind: 's', num: 11 },
  { kind: 't', num: 11 }, { kind: 'b', num: 3 },
  { kind: 'decay', num: 2 }, { kind: 'higgs', num: 7 }, { kind: 'fusion', num: 12 },
];
const TILE_NAME = {
  u: 'Acelerador Linear', d: 'Acelerador Linear', c: 'Síncrotron', s: 'Colisor de Íons',
  t: 'Grande Colisor', b: 'Grande Colisor', decay: 'Campo de Decaimento', higgs: 'Campo de Higgs', fusion: 'Campo de Fusão',
};
const isProd = k => Q.includes(k);
const prob = n => (n >= 2 && n <= 12) ? (6 - Math.abs(7 - n)) / 36 : 0;

const BUILD = {
  proton:    { tier: 1, name: 'Próton', sym: 'p', cost: { u: 2, d: 1 }, vp: 1, baryon: true, text: 'Bárion uud. Produz 1 recurso por hexágono vizinho sorteado.' },
  neutron:   { tier: 1, name: 'Nêutron', sym: 'n', cost: { u: 1, d: 2 }, vp: 1, baryon: true, text: 'Bárion udd. Produz 1 recurso por hexágono vizinho sorteado.' },
  lambda:    { tier: 1, name: 'Lambda', sym: 'Λ', cost: { u: 1, d: 1, s: 1 }, vp: 1, baryon: true, text: 'Bárion uds. Pesca 1 carta ao ser construído e pode virar núcleo como um Próton (hipernúcleo).' },
  pion:      { tier: 1, name: 'Píon', sym: 'π', cost: { u: 1, d: 1, e: 2 }, vp: 1, meson: true, text: 'Méson u + anti-d. Suas trocas com o banco passam a ser 2:1.' },
  kaon:      { tier: 1, name: 'Káon', sym: 'K', cost: { u: 1, s: 1, e: 2 }, vp: 1, meson: true, text: 'Méson u + anti-s. Imune ao Campo de Higgs: não é bloqueado e você não pode ser roubado.' },
  deuterium: { tier: 2, name: 'Deutério', sym: '²H', vp: 2, from: ['proton', 'neutron', 'lambda'], text: 'Próton + nêutron. Evolui de um Próton, Nêutron ou Lambda seu; paga só o núcleon que falta. Produz 2.' },
  helium:    { tier: 2, name: 'Hélio-4', sym: '⁴He', cost: { u: 3, d: 3 }, vp: 2, from: ['deuterium'], text: 'Evolui de um Deutério (+1 próton +1 nêutron). Produz 2, +1 Energia por turno seu e 1 carta a cada 3 turnos.' },
  lithium:   { tier: 2, name: 'Lítio-7', sym: '⁷Li', cost: { u: 4, d: 5 }, vp: 2, from: ['helium'], text: 'Evolui de um Hélio-4 (+1 próton +2 nêutrons). Produz 2. Fusão Nuclear: 1 vez por turno, 1 Up + 1 Down → 1 Top ou 1 Bottom.' },
  carbon:    { tier: 2, name: 'Carbono-12', sym: '¹²C', cost: { e: 2 }, vp: 3, from: ['helium'], text: 'Evolui de um Hélio-4 (+2 Energias). Produz 2, imune a todos os campos; pesca 1 carta ao fim do seu turno se o dado não ativou campo.' },
  drift:     { tier: 3, name: 'Tubo de Deriva', sym: '', cost: { c: 1, s: 1 }, len: 1, text: 'Conexão básica entre construções.' },
  magnet:    { tier: 3, name: 'Ímã Supercondutor', sym: '', cost: { t: 1, e: 2 }, len: 2, text: 'Conexão resistente: vale 2 na maior cadeia e não pode ser aniquilada.' },
  detector:  { tier: 3, name: 'Detector', sym: '', cost: { b: 1, e: 1 }, len: 1, text: 'Conexão que pesca 1 carta ao ser construída.' },
};
const NUCLEI = ['deuterium', 'helium', 'lithium', 'carbon'];

const CARDS = {
  forte:       { name: 'Força Nuclear Forte', group: 'basic', n: 3, text: 'O próximo bárion (Próton, Nêutron ou Lambda) que você construir neste turno custa 1 Up a menos.' },
  fraca:       { name: 'Força Nuclear Fraca', group: 'basic', n: 3, text: 'Decaimento controlado: descarte 1 quark à sua escolha e ganhe 2 Energias.' },
  em:          { name: 'Força Eletromagnética', group: 'basic', n: 3, text: 'Mova um dos três Campos Quânticos para qualquer hexágono (sem roubo).' },
  gravidade:   { name: 'Gravidade', group: 'basic', n: 3, text: 'Escolha uma construção sua: receba 1 quark de cada hexágono produtivo vizinho a ela.' },
  gauge:       { name: 'Simetria Gauge', group: 'protect', n: 2, text: 'Uma construção sua fica imune a campos e cartas de ataque até o seu próximo turno.' },
  blindagem:   { name: 'Blindagem Nuclear', group: 'protect', n: 2, text: 'Seus recursos não podem ser roubados nem fundidos até o seu próximo turno.' },
  estab:       { name: 'Estabilização Quântica', group: 'protect', n: 2, text: 'Reação: quando um campo ativado pelos dados atingir você, cancele o efeito. Usada fora do seu turno.' },
  unificada:   { name: 'Força Unificada', group: 'protect', n: 2, text: 'Mova qualquer Campo Quântico para onde quiser. Se for o de Higgs, roube 1 quark como num 7.' },
  fusao:       { name: 'Fusão Nuclear', group: 'reaction', n: 2, cost: { e: 1 }, text: 'Custa 1 Energia. Com dois Deutérios seus, um vira Hélio-4 e o outro volta ao hádron de origem.' },
  fissao:      { name: 'Fissão Nuclear', group: 'reaction', n: 2, cost: { e: 1 }, text: 'Custa 1 Energia. Um Hélio-4 ou Lítio-7 de oponente volta a ser Deutério; os vizinhos dele ganham 1 quark leve cada.' },
  aniquilacao: { name: 'Aniquilação', group: 'reaction', n: 2, text: 'Pague um par partícula/antipartícula (2 quarks iguais + 2 Energias): remova um hádron simples ou um Tubo/Detector de oponente e pesque 1 carta.' },
  descoberta:  { name: 'Descoberta Científica', group: 'reaction', n: 2, cost: { e: 1 }, text: 'Custa 1 Energia. Pesque 2 cartas.' },
  colaboracao: { name: 'Colaboração Acadêmica', group: 'reaction', n: 2, cost: { e: 1 }, text: 'Custa 1 Energia. Troque 1 carta aleatória sua por 1 carta aleatória de um oponente.' },
  nobel:       { name: 'Prêmio Nobel', group: 'point', n: 2, text: '1 ponto de estabilidade. Revelada assim que é pescada.' },
  nature:      { name: 'Publicação na Nature', group: 'point', n: 2, text: '1 ponto de estabilidade. Revelada assim que é pescada.' },
};
const UNI = ['forte', 'fraca', 'em', 'gravidade'];
const DECK_SIZE = Object.values(CARDS).reduce((s, c) => s + c.n, 0);

// ---------------------------------------------------------------- utilidades
function rnd(st) { // mulberry32, estado guardado no próprio jogo
  let t = st.rng = (st.rng + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (st, n) => Math.floor(rnd(st) * n);
function shuffle(st, a) { for (let i = a.length - 1; i > 0; i--) { const j = ri(st, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pn = (st, i) => st.players[i].name;
const qCount = p => Q.reduce((s, k) => s + p.res[k], 0);
function fmtRes(r) { const s = Object.entries(r).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${QN[k]}`).join(', '); return s || 'nada'; }
function log(st, txt, p) { st.log.push({ n: st.turn, txt, p: p ?? null }); if (st.log.length > 400) st.log.splice(0, st.log.length - 400); }
const hasRes = (p, r) => Object.entries(r).every(([k, v]) => p.res[k] >= v);
function addRes(p, r, sign = 1) { for (const [k, v] of Object.entries(r)) p.res[k] += sign * v; }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const entriesB = st => Object.entries(st.buildings).map(([v, b]) => [+v, b]);
const others = (st, pi) => st.players.map((_, i) => i).filter(i => i !== pi);

// ---------------------------------------------------------------- tabuleiro
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function okLayout(coords, tiles) {
  const idx = new Map(coords.map(([q, r], i) => [q + ',' + r, i]));
  const red = i => tiles[i].num === 6 || tiles[i].num === 8;
  for (let i = 0; i < coords.length; i++) {
    if (!red(i)) continue;
    const [q, r] = coords[i];
    for (const [dq, dr] of DIRS) { const j = idx.get((q + dq) + ',' + (r + dr)); if (j !== undefined && red(j)) return false; }
  }
  return true;
}
function makeBoard(st) {
  const coords = [];
  for (let q = -2; q <= 2; q++) for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) coords.push([q, r]);
  let tiles = null;
  for (let k = 0; k < 500; k++) { tiles = shuffle(st, TILE_SET.map(t => ({ ...t }))); if (okLayout(coords, tiles)) break; }
  const S3 = Math.sqrt(3);
  const hexes = coords.map(([q, r], i) => ({ id: i, q, r, x: S3 * (q + r / 2), y: 1.5 * r, kind: tiles[i].kind, num: tiles[i].num, verts: [], edges: [] }));
  const vmap = new Map(), emap = new Map(), vertices = [], edges = [];
  const key = (x, y) => Math.round(x * 100) + ',' + Math.round(y * 100);
  for (const h of hexes) {
    const ids = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 30), x = h.x + Math.cos(a), y = h.y + Math.sin(a), k = key(x, y);
      let id = vmap.get(k);
      if (id === undefined) { id = vertices.length; vmap.set(k, id); vertices.push({ id, x, y, hexes: [], adj: [], edges: [] }); }
      vertices[id].hexes.push(h.id); ids.push(id);
    }
    h.verts = ids;
    for (let i = 0; i < 6; i++) {
      const a = ids[i], b = ids[(i + 1) % 6], k = Math.min(a, b) + '-' + Math.max(a, b);
      let id = emap.get(k);
      if (id === undefined) {
        id = edges.length; emap.set(k, id); edges.push({ id, v: [a, b], hexes: [] });
        vertices[a].adj.push(b); vertices[b].adj.push(a); vertices[a].edges.push(id); vertices[b].edges.push(id);
      }
      edges[id].hexes.push(h.id); h.edges.push(id);
    }
  }
  return { hexes, vertices, edges };
}

// ---------------------------------------------------------------- consultas
const ownVerts = (st, pi) => entriesB(st).filter(([, b]) => b.owner === pi).map(([v]) => v);
const ownOfType = (st, pi, t) => entriesB(st).filter(([, b]) => b.owner === pi && b.type === t).map(([v]) => v);
const owns = (st, pi, t) => Object.values(st.buildings).some(b => b.owner === pi && b.type === t);
function countTier(st, pi, t) {
  if (t === 3) return Object.values(st.roads).filter(r => r.owner === pi).length;
  return Object.values(st.buildings).filter(b => b.owner === pi && BUILD[b.type].tier === t).length;
}
const immuneBlock = b => b.type === 'kaon' || b.type === 'carbon' || !!b.shield;
const stealImmune = (st, i) => st.players[i].blind || owns(st, i, 'kaon');
const distanceOK = (st, v) => !st.buildings[v] && st.board.vertices[v].adj.every(w => !st.buildings[w]);
function setupVertices(st) {
  return st.board.vertices.filter(V => distanceOK(st, V.id)
    && new Set(V.hexes.map(h => st.board.hexes[h].kind).filter(isProd)).size >= 2
    && V.edges.some(e => !st.roads[e])).map(V => V.id);
}
function touchesOwn(st, pi, v, exceptE) {
  const b = st.buildings[v];
  if (b) return b.owner === pi;
  return st.board.vertices[v].edges.some(e => e !== exceptE && st.roads[e] && st.roads[e].owner === pi);
}
function buildSpots(st, pi, kind) {
  const B = BUILD[kind];
  if (B.tier === 3) {
    if (countTier(st, pi, 3) >= LIMIT[3]) return [];
    return st.board.edges.filter(E => !st.roads[E.id] && E.v.some(v => touchesOwn(st, pi, v, E.id))).map(E => E.id);
  }
  if (B.tier === 1) {
    if (countTier(st, pi, 1) >= LIMIT[1]) return [];
    return st.board.vertices.filter(V => distanceOK(st, V.id) && V.edges.some(e => st.roads[e] && st.roads[e].owner === pi)).map(V => V.id);
  }
  if (kind === 'deuterium' && countTier(st, pi, 2) >= LIMIT[2]) return [];
  return entriesB(st).filter(([, b]) => b.owner === pi && B.from.includes(b.type)).map(([v]) => v);
}
function costOf(st, pi, kind, at) {
  let c;
  if (kind === 'deuterium') { const b = at != null ? st.buildings[at] : null; c = (b && b.type === 'neutron') ? { u: 2, d: 1 } : { u: 1, d: 2 }; }
  else c = { ...BUILD[kind].cost };
  if (BUILD[kind].baryon && st.flags && st.flags.discount && pi === st.current && c.u) c.u--;
  return c;
}
function payPlan(p, cost) {
  let miss = 0, missK = null;
  for (const [k, n] of Object.entries(cost)) { if (k === 'e') continue; const m = Math.max(0, n - p.res[k]); if (m) { miss += m; missK = k; } }
  const e = cost.e || 0;
  if (miss === 0 && p.res.e >= e) return { ok: true, useE: null };
  if (miss === 1 && p.res.e >= e + 1) return { ok: true, useE: missK }; // Energia acelera: substitui 1 partícula
  return { ok: false };
}
function pay(p, cost, plan) {
  for (const [k, n] of Object.entries(cost)) { if (k === plan.useE) { p.res[k] -= n - 1; p.res.e -= 1; } else p.res[k] -= n; }
}
const bankRatio = (st, pi) => owns(st, pi, 'pion') ? 2 : 4;
function gravityHexes(st, v) {
  const b = st.buildings[v];
  return st.board.vertices[v].hexes.filter(h => isProd(st.board.hexes[h].kind) && (st.tokens.higgs !== h || immuneBlock(b)));
}
const gravityOptions = (st, pi) => ownVerts(st, pi).filter(v => gravityHexes(st, v).length > 0);
const fissionOptions = (st, pi) => entriesB(st).filter(([, b]) => b.owner !== pi && (b.type === 'helium' || b.type === 'lithium') && !b.shield).map(([v]) => v);
function annihilationTargets(st, pi) {
  const out = [];
  for (const [v, b] of entriesB(st)) if (b.owner !== pi && BUILD[b.type].tier === 1 && !b.shield) out.push({ k: 'v', id: v });
  for (const [e, r] of Object.entries(st.roads)) if (r.owner !== pi && r.type !== 'magnet') out.push({ k: 'e', id: +e });
  return out;
}
const canUnify = (st, pi) => !st.players[pi].unified && UNI.every(c => st.players[pi].cards.includes(c));

// ---------------------------------------------------------------- pontos
function chainLen(st, pi) {
  const own = Object.entries(st.roads).filter(([, r]) => r.owner === pi).map(([e]) => +e);
  if (!own.length) return 0;
  const ownSet = new Set(own), used = new Set();
  const blocked = v => { const b = st.buildings[v]; return !!b && b.owner !== pi; };
  let best = 0;
  const dfs = (v, len, start) => {
    if (len > best) best = len;
    if (!start && blocked(v)) return;
    for (const e of st.board.vertices[v].edges) {
      if (!ownSet.has(e) || used.has(e)) continue;
      used.add(e);
      const E = st.board.edges[e], w = E.v[0] === v ? E.v[1] : E.v[0];
      dfs(w, len + BUILD[st.roads[e].type].len, false);
      used.delete(e);
    }
  };
  const starts = new Set(); for (const e of own) for (const v of st.board.edges[e].v) starts.add(v);
  for (const v of starts) dfs(v, 0, true);
  return best;
}
function updateLongest(st) {
  const lens = st.players.map((_, i) => chainLen(st, i));
  st.chains = lens;
  let holder = st.longest ? st.longest.owner : null;
  const max = Math.max(...lens);
  if (holder !== null && lens[holder] >= LONG_MIN && lens[holder] === max) { st.longest = { owner: holder, len: max }; return; }
  if (max < LONG_MIN) { if (st.longest) log(st, 'Ninguém mais tem a Maior Cadeia de Aceleradores.'); st.longest = null; return; }
  const tops = lens.map((l, i) => l === max ? i : -1).filter(i => i >= 0);
  if (tops.length === 1) {
    if (holder !== tops[0]) log(st, `${pn(st, tops[0])} conquista a Maior Cadeia de Aceleradores (${max}).`, tops[0]);
    st.longest = { owner: tops[0], len: max };
  } else { if (st.longest) log(st, 'Empate: ninguém fica com a Maior Cadeia de Aceleradores.'); st.longest = null; }
}
function vpBreak(st, pi) {
  const p = st.players[pi];
  const mine = Object.values(st.buildings).filter(b => b.owner === pi);
  const r = {
    builds: mine.reduce((s, b) => s + BUILD[b.type].vp, 0),
    longest: st.longest && st.longest.owner === pi ? 2 : 0,
    cards: p.points.length,
    collab: p.collab,
    unified: p.unified ? 2 : 0,
    higgs: NUCLEI.every(t => mine.some(b => b.type === t)) ? 3 : 0,
    susy: mine.filter(b => BUILD[b.type].meson).length >= 3 ? 2 : 0,
  };
  r.total = r.builds + r.longest + r.cards + r.collab + r.unified + r.higgs + r.susy;
  return r;
}
const vp = (st, pi) => vpBreak(st, pi).total;

// ---------------------------------------------------------------- cartas
function drawCards(st, pi, k) {
  const p = st.players[pi]; let got = 0;
  for (let i = 0; i < k; i++) {
    if (!st.deck.length) {
      if (!st.discard.length) { log(st, 'Não há mais cartas para pescar.'); break; }
      st.deck = shuffle(st, st.discard); st.discard = []; log(st, 'O descarte foi reembaralhado como novo baralho.');
    }
    const c = st.deck.pop();
    if (CARDS[c].group === 'point') { p.points.push(c); log(st, `${p.name} revela ${CARDS[c].name}: +1 ponto.`, pi); }
    else { p.cards.push(c); got++; }
  }
  if (got) log(st, `${p.name} pesca ${got} carta${got > 1 ? 's' : ''}.`, pi);
}
function cardPlayable(st, pi, id) {
  if (st.phase !== 'play' || st.pending || !st.rolled || pi !== st.current || st.flags.cardPlayed) return false;
  const p = st.players[pi];
  if (!p.cards.includes(id)) return false;
  const C = CARDS[id];
  if (C.cost && p.res.e < C.cost.e) return false;
  switch (id) {
    case 'forte': return !st.flags.discount;
    case 'fraca': return qCount(p) > 0;
    case 'em': case 'unificada': return true;
    case 'gravidade': return gravityOptions(st, pi).length > 0;
    case 'gauge': return ownVerts(st, pi).length > 0;
    case 'blindagem': return !p.blind;
    case 'fusao': return ownOfType(st, pi, 'deuterium').length >= 2;
    case 'fissao': return fissionOptions(st, pi).length > 0;
    case 'aniquilacao': return p.res.e >= 2 && Q.some(k => p.res[k] >= 2) && annihilationTargets(st, pi).length > 0;
    case 'descoberta': return st.deck.length + st.discard.length > 0;
    case 'colaboracao': return others(st, pi).some(i => st.players[i].cards.length > 0);
    default: return false; // estab é reação; pontos são automáticas
  }
}
function whyNotCard(st, pi, id) {
  if (st.flags.cardPlayed) return 'Você já jogou uma carta neste turno.';
  if (!st.rolled) return 'Role os dados primeiro.';
  const C = CARDS[id], p = st.players[pi];
  if (id === 'estab') return 'Só é usada como reação, fora do seu turno.';
  if (C.cost && p.res.e < C.cost.e) return 'Precisa de 1 Energia.';
  return 'Sem alvo válido agora.';
}

// ---------------------------------------------------------------- jogo
function newGame(opts) {
  const st = {
    v: 1, rng: (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
    players: [], buildings: {}, roads: {}, tokens: {}, deck: [], discard: [],
    current: 0, turn: 0, rolled: false, dice: null, pending: null, log: [], winner: null,
    phase: 'setup', setupStep: 0, setupOrder: [], flags: {}, longest: null, chains: [], rolls: Array(13).fill(0),
  };
  st.board = makeBoard(st);
  st.players = opts.players.map(p => ({ name: p.name, color: p.color, bot: !!p.bot, res: { u: 0, d: 0, c: 0, s: 0, t: 0, b: 0, e: 0 }, cards: [], points: [], collab: 0, unified: false, blind: false }));
  for (const k of FIELDS) st.tokens[k] = st.board.hexes.find(h => h.kind === k).id;
  for (const [id, c] of Object.entries(CARDS)) for (let i = 0; i < c.n; i++) st.deck.push(id);
  shuffle(st, st.deck);
  const n = st.players.length;
  st.setupOrder = [...Array(n).keys(), ...[...Array(n).keys()].reverse()];
  st.chains = Array(n).fill(0);
  log(st, `Nova partida com ${n} jogadores. Cada um recebe 2 Cartas de Interação.`);
  st.players.forEach((_, i) => drawCards(st, i, 2));
  beginSetupStep(st);
  return st;
}
function beginSetupStep(st) {
  const i = st.setupOrder[st.setupStep], n = st.players.length, type = st.setupStep < n ? 'proton' : 'neutron';
  st.current = i;
  st.pending = { who: i, kind: 'setupHadron', pick: 'vertex', options: setupVertices(st), data: { type },
    prompt: `Posicione seu ${BUILD[type].name} grátis numa intersecção que toque pelo menos 2 tipos de quark.` };
}
function startTurn(st) {
  const pi = st.current, p = st.players[pi];
  st.turn++; st.rolled = false; st.dice = null;
  st.flags = { cardPlayed: false, discount: false, liUsed: false, offers: 0, botTrades: 0 };
  p.blind = false;
  for (const b of Object.values(st.buildings)) if (b.owner === pi) b.shield = false;
  let e = 0;
  for (const b of Object.values(st.buildings)) {
    if (b.owner !== pi || b.type !== 'helium') continue;
    e++; b.heCount = (b.heCount || 0) + 1;
    if (b.heCount >= 3) { b.heCount = 0; log(st, `Hélio-4 de ${p.name} gera uma carta.`, pi); drawCards(st, pi, 1); }
  }
  if (e) { p.res.e += e; log(st, `Hélio-4: ${p.name} recebe ${e} Energia.`, pi); }
  checkWin(st);
}
function checkWin(st) {
  if (st.phase !== 'play') return;
  const v = vp(st, st.current);
  if (v >= WIN) { st.winner = st.current; st.phase = 'over'; st.pending = null; log(st, `${pn(st, st.current)} alcança ${v} pontos de estabilidade e vence!`, st.current); }
}
function moveToken(st, tok, hex) {
  st.tokens[tok] = hex;
  if (FIELDS.some(k => k !== tok && st.tokens[k] === hex)) {
    log(st, 'Unificação Eletrofraca! Dois campos no mesmo hexágono: todos pescam 1 carta.');
    st.players.forEach((_, i) => drawCards(st, i, 1));
  }
}
function produce(st, sum) {
  const gains = st.players.map(() => ({}));
  for (const h of st.board.hexes) {
    if (h.num !== sum || !isProd(h.kind)) continue;
    const blocked = st.tokens.higgs === h.id;
    for (const v of h.verts) {
      const b = st.buildings[v];
      if (!b || (blocked && !immuneBlock(b))) continue;
      const n = BUILD[b.type].tier === 2 ? 2 : 1;
      st.players[b.owner].res[h.kind] += n;
      gains[b.owner][h.kind] = (gains[b.owner][h.kind] || 0) + n;
    }
  }
  let any = false;
  gains.forEach((g, i) => { if (Object.keys(g).length) { any = true; log(st, `${pn(st, i)} recebe ${fmtRes(g)}.`, i); } });
  if (!any) log(st, 'Nenhuma construção produziu.');
}
function doRoll(st, forced) {
  const d1 = forced ? forced[0] : 1 + ri(st, 6), d2 = forced ? forced[1] : 1 + ri(st, 6), s = d1 + d2;
  st.dice = [d1, d2]; st.rolled = true; st.rolls[s]++;
  log(st, `${pn(st, st.current)} rola ${d1} + ${d2} = ${s}.`, st.current);
  if (s === 7) {
    log(st, 'Campo de Higgs ativado!');
    st.pending = { who: st.current, kind: 'higgsHex', pick: 'hex', options: st.board.hexes.map(h => h.id).filter(h => h !== st.tokens.higgs), data: { viaCard: false },
      prompt: 'Campo de Higgs: escolha o hexágono que fica sem produção. Depois você rouba 1 quark de quem estiver nele.' };
  } else if (s === 2) startDecay(st);
  else if (s === 12) startFusion(st);
  else produce(st, s);
}
function stealCandidates(st, hex, thief) {
  const set = new Set();
  for (const v of st.board.hexes[hex].verts) { const b = st.buildings[v]; if (b && b.owner !== thief) set.add(b.owner); }
  return [...set].filter(i => qCount(st.players[i]) > 0 && !stealImmune(st, i));
}
function steal(st, thief, victim) {
  const p = st.players[victim], n = qCount(p);
  if (!n) return;
  let r = ri(st, n);
  for (const k of Q) {
    if (r < p.res[k]) { p.res[k]--; st.players[thief].res[k]++; log(st, `${pn(st, thief)} rouba 1 ${QN[k]} de ${p.name}.`, thief); return; }
    r -= p.res[k];
  }
}
function loseRandom(st, pi) {
  const p = st.players[pi], n = qCount(p);
  if (!n) return null;
  let r = ri(st, n);
  for (const k of Q) { if (r < p.res[k]) { p.res[k]--; return k; } r -= p.res[k]; }
  return null;
}
function afterHiggsHex(st, hex, viaCard) {
  moveToken(st, 'higgs', hex);
  const c = stealCandidates(st, hex, st.current);
  if (!c.length) { log(st, 'Ninguém para roubar nesse hexágono.'); return; }
  if (c.length === 1) return targetSteal(st, c[0], viaCard);
  st.pending = { who: st.current, kind: 'higgsSteal', pick: 'player', options: c, data: { viaCard }, prompt: 'Escolha de quem roubar 1 quark aleatório.' };
}
function targetSteal(st, victim, viaCard) {
  if (!viaCard && askReact(st, victim, { field: 'higgs' })) return;
  steal(st, st.current, victim);
}
function askReact(st, victim, data) {
  if (!st.players[victim].cards.includes('estab')) return false;
  st.pending = { who: victim, kind: 'react', pick: 'yesno', options: [true, false], data: { ...data, victim },
    prompt: `${FIELD_NAME[data.field]} atinge você. Usar Estabilização Quântica para cancelar?` };
  return true;
}
function applyField(st, d) {
  if (d.field === 'higgs') steal(st, st.current, d.victim);
  else if (d.field === 'decay') { moveToken(st, 'decay', st.board.vertices[d.v].hexes[0]); stepDown(st, d.v, 'decai'); }
  else if (d.field === 'fusion') applyFusion(st, d.a, d.b);
}
function startDecay(st) {
  log(st, 'Campo de Decaimento ativado (força fraca)!');
  const c = entriesB(st).filter(([, b]) => b.owner !== st.current && ['deuterium', 'helium', 'lithium'].includes(b.type) && !b.shield).map(([v]) => v);
  if (!c.length) { st.players[st.current].res.e++; log(st, `Nenhum núcleo pode decair. ${pn(st, st.current)} recebe 1 Energia.`, st.current); return; }
  st.pending = { who: st.current, kind: 'decayPick', pick: 'vertex', options: c, prompt: 'Campo de Decaimento: escolha o núcleo de um oponente que perde um nível.' };
}
function stepDown(st, v, verb, toType) {
  const b = st.buildings[v], before = BUILD[b.type].name;
  b.type = toType || (b.type === 'lithium' ? 'helium' : b.type === 'helium' ? 'deuterium' : (b.base || 'proton'));
  b.heCount = 0;
  log(st, `O ${before} de ${pn(st, b.owner)} ${verb} e vira ${BUILD[b.type].name}.`, b.owner);
  const set = new Set();
  for (const h of st.board.vertices[v].hexes) for (const w of st.board.hexes[h].verts) {
    if (w === v) continue; const o = st.buildings[w]; if (o && o.owner !== b.owner) set.add(o.owner);
  }
  for (const i of set) { const k = LIGHT[ri(st, 2)]; st.players[i].res[k]++; log(st, `${pn(st, i)} captura 1 ${QN[k]} liberado.`, i); }
}
function startFusion(st) {
  log(st, 'Campo de Fusão ativado (força forte)!');
  const opp = others(st, st.current);
  if (opp.length === 2) return continueFusion(st, { field: 'fusion', a: opp[0], b: opp[1], stage: 0 });
  st.pending = { who: st.current, kind: 'fusionPick1', pick: 'player', options: opp, prompt: 'Campo de Fusão: escolha o primeiro jogador que será forçado a fundir recursos.' };
}
function continueFusion(st, d) {
  while (d.stage < 2) { const victim = d.stage === 0 ? d.a : d.b; d.stage++; if (askReact(st, victim, d)) return; }
  applyFusion(st, d.a, d.b);
}
function applyFusion(st, a, b) {
  const A = st.players[a], B = st.players[b];
  if (A.blind || B.blind) { log(st, 'A Blindagem Nuclear impediu a fusão.'); return; }
  if (qCount(A) < 2 || qCount(B) < 2) { log(st, `Fusão falhou: ${A.name} e ${B.name} precisam de 2 quarks cada.`); return; }
  for (const i of [a, b]) for (let k = 0; k < 2; k++) loseRandom(st, i);
  A.collab++; B.collab++;
  log(st, `${A.name} e ${B.name} fundem 2 quarks cada num Núcleo Colaborativo: +1 ponto para cada.`);
}
function endTurn(st) {
  const pi = st.current, p = st.players[pi], s = st.dice[0] + st.dice[1];
  if (owns(st, pi, 'carbon') && ![2, 7, 12].includes(s)) { log(st, `Carbono-12 estável: ${p.name} pesca 1 carta.`, pi); drawCards(st, pi, 1); }
  for (const q of st.players) {
    const t = q.res.t, b = q.res.b;
    if (!t && !b) continue;
    q.res.c += t; q.res.s += b; q.res.e += t + b; q.res.t = 0; q.res.b = 0;
    const parts = []; if (t) parts.push(`${t} Top → Charm`); if (b) parts.push(`${b} Bottom → Strange`);
    log(st, `Decaimento de ${q.name}: ${parts.join(', ')}, +${t + b} Energia.`);
  }
  if (p.cards.length > HAND) return askDiscard(st);
  nextTurn(st);
}
function askDiscard(st) {
  const p = st.players[st.current];
  st.pending = { who: st.current, kind: 'discard', pick: 'card', options: [...new Set(p.cards)], prompt: `Limite de ${HAND} cartas: descarte mais ${p.cards.length - HAND}.` };
}
function nextTurn(st) { st.pending = null; st.current = (st.current + 1) % st.players.length; startTurn(st); }

function playCard(st, id) {
  const pi = st.current, p = st.players[pi];
  if (!cardPlayable(st, pi, id)) throw new Error(whyNotCard(st, pi, id));
  p.cards.splice(p.cards.indexOf(id), 1); st.discard.push(id); st.flags.cardPlayed = true;
  if (CARDS[id].cost) p.res.e -= CARDS[id].cost.e;
  log(st, `${p.name} joga ${CARDS[id].name}.`, pi);
  const pend = (kind, pick, options, prompt, data) => { st.pending = { who: pi, kind, pick, options, prompt, data: data || {} }; };
  switch (id) {
    case 'forte': st.flags.discount = true; break;
    case 'fraca': pend('fraca', 'res', Q.filter(k => p.res[k] > 0), 'Escolha o quark que decai em 2 Energias.'); break;
    case 'em': case 'unificada': pend('tokenPick', 'token', FIELDS.slice(), 'Escolha o Campo Quântico que vai mover.', { card: id }); break;
    case 'gravidade': pend('gravity', 'vertex', gravityOptions(st, pi), 'Escolha a construção sua que atrai os recursos vizinhos.'); break;
    case 'gauge': pend('gauge', 'vertex', ownVerts(st, pi), 'Escolha a construção que fica protegida até o seu próximo turno.'); break;
    case 'blindagem': p.blind = true; log(st, `Os recursos de ${p.name} estão protegidos até o próximo turno dele.`, pi); break;
    case 'fusao': pend('fusao1', 'vertex', ownOfType(st, pi, 'deuterium'), 'Escolha o Deutério que vira Hélio-4.'); break;
    case 'fissao': pend('fissao', 'vertex', fissionOptions(st, pi), 'Escolha o núcleo pesado que sofre fissão.'); break;
    case 'aniquilacao': pend('aniqRes', 'res', Q.filter(k => p.res[k] >= 2), 'Escolha o par partícula/antipartícula: 2 quarks iguais (mais 2 Energias).'); break;
    case 'descoberta': drawCards(st, pi, 2); break;
    case 'colaboracao': pend('colab', 'player', others(st, pi).filter(i => st.players[i].cards.length), 'Escolha com quem trocar uma carta.'); break;
  }
}

function pick(st, val) {
  const pd = st.pending;
  if (!pd) throw new Error('Não há nada para escolher agora.');
  if (!pd.options.some(o => same(o, val))) throw new Error('Escolha inválida.');
  const pi = pd.who, p = st.players[pi], d = pd.data || {};
  st.pending = null;
  const pend = (kind, pick2, options, prompt, data) => { st.pending = { who: pi, kind, pick: pick2, options, prompt, data: data || {} }; };
  switch (pd.kind) {
    case 'setupHadron':
      st.buildings[val] = { owner: pi, type: d.type };
      log(st, `${p.name} posiciona um ${BUILD[d.type].name}.`, pi);
      pend('setupAccel', 'edge', st.board.vertices[val].edges.filter(e => !st.roads[e]), `Posicione um Tubo de Deriva grátis ligado ao seu ${BUILD[d.type].name}.`, { v: val });
      break;
    case 'setupAccel': {
      st.roads[val] = { owner: pi, type: 'drift' };
      const n = st.players.length;
      if (st.setupStep >= n) {
        const g = {};
        for (const h of st.board.vertices[d.v].hexes) {
          let k = st.board.hexes[h].kind;
          if (!isProd(k)) continue;
          if (k === 't' || k === 'b') { const to = k === 't' ? 'c' : 's'; p.res[to]++; p.res.e++; g[to] = (g[to] || 0) + 1; g.e = (g.e || 0) + 1; continue; }
          p.res[k]++; g[k] = (g[k] || 0) + 1;
        }
        log(st, `${p.name} recebe os recursos iniciais: ${fmtRes(g)}.`, pi);
      }
      st.setupStep++;
      updateLongest(st);
      if (st.setupStep < 2 * n) beginSetupStep(st);
      else { st.phase = 'play'; st.current = 0; log(st, 'Preparação concluída. Que comecem as colisões!'); startTurn(st); }
      break;
    }
    case 'higgsHex': afterHiggsHex(st, val, d.viaCard); break;
    case 'higgsSteal': targetSteal(st, val, d.viaCard); break;
    case 'react':
      if (val) { p.cards.splice(p.cards.indexOf('estab'), 1); st.discard.push('estab'); log(st, `${p.name} usa Estabilização Quântica e cancela o ${FIELD_NAME[d.field]}!`, pi); }
      else if (d.field === 'fusion') continueFusion(st, d);
      else applyField(st, d);
      break;
    case 'decayPick': {
      const owner = st.buildings[val].owner;
      if (!askReact(st, owner, { field: 'decay', v: val })) applyField(st, { field: 'decay', v: val });
      break;
    }
    case 'fusionPick1': pend('fusionPick2', 'player', others(st, pi).filter(i => i !== val), 'Escolha o segundo jogador da fusão.', { a: val }); break;
    case 'fusionPick2': continueFusion(st, { field: 'fusion', a: d.a, b: val, stage: 0 }); break;
    case 'fraca': p.res[val]--; p.res.e += 2; log(st, `${p.name} converte 1 ${QN[val]} em 2 Energias.`, pi); break;
    case 'tokenPick': pend('tokenHex', 'hex', st.board.hexes.map(h => h.id).filter(h => h !== st.tokens[val]), `Escolha o destino do ${FIELD_NAME[val]}.`, { card: d.card, token: val }); break;
    case 'tokenHex':
      if (d.card === 'unificada' && d.token === 'higgs') afterHiggsHex(st, val, true);
      else { moveToken(st, d.token, val); log(st, `${p.name} move o ${FIELD_NAME[d.token]}.`, pi); }
      break;
    case 'gravity': {
      const g = {};
      for (const h of gravityHexes(st, val)) { const k = st.board.hexes[h].kind; p.res[k]++; g[k] = (g[k] || 0) + 1; }
      log(st, `Gravidade: ${p.name} atrai ${fmtRes(g)}.`, pi);
      break;
    }
    case 'gauge': st.buildings[val].shield = true; log(st, `O ${BUILD[st.buildings[val].type].name} de ${p.name} está protegido por Simetria Gauge.`, pi); break;
    case 'fusao1': pend('fusao2', 'vertex', ownOfType(st, pi, 'deuterium').filter(v => v !== val), 'Escolha o outro Deutério, que volta ao hádron de origem.', { v1: val }); break;
    case 'fusao2': {
      const b1 = st.buildings[d.v1], b2 = st.buildings[val];
      b1.type = 'helium'; b1.heCount = 0; b2.type = b2.base || 'proton';
      log(st, `${p.name} funde dois Deutérios: nasce um Hélio-4.`, pi);
      break;
    }
    case 'fissao': stepDown(st, val, 'sofre fissão', 'deuterium'); break;
    case 'aniqRes': pend('aniqTarget', 'target', annihilationTargets(st, pi), 'Escolha a construção do oponente que será aniquilada.', { q: val }); break;
    case 'aniqTarget': {
      p.res[d.q] -= 2; p.res.e -= 2;
      if (val.k === 'v') { const b = st.buildings[val.id]; log(st, `${p.name} aniquila o ${BUILD[b.type].name} de ${pn(st, b.owner)}.`, pi); delete st.buildings[val.id]; }
      else { const r = st.roads[val.id]; log(st, `${p.name} aniquila um ${BUILD[r.type].name} de ${pn(st, r.owner)}.`, pi); delete st.roads[val.id]; }
      drawCards(st, pi, 1);
      updateLongest(st);
      break;
    }
    case 'colab': {
      const q = st.players[val];
      const mine = p.cards.length ? p.cards.splice(ri(st, p.cards.length), 1)[0] : null;
      const theirs = q.cards.splice(ri(st, q.cards.length), 1)[0];
      p.cards.push(theirs); if (mine) q.cards.push(mine);
      log(st, `${p.name} e ${q.name} trocam cartas.`, pi);
      break;
    }
    case 'tradeResponse': {
      const from = st.players[d.from];
      if (!val) { log(st, `${p.name} recusa a troca.`, pi); break; }
      if (!hasRes(from, d.give) || !hasRes(p, d.get)) { log(st, 'Troca cancelada: faltam recursos.'); break; }
      addRes(from, d.give, -1); addRes(p, d.give); addRes(p, d.get, -1); addRes(from, d.get);
      log(st, `${p.name} aceita: recebe ${fmtRes(d.give)} e entrega ${fmtRes(d.get)} a ${from.name}.`, pi);
      break;
    }
    case 'discard':
      p.cards.splice(p.cards.indexOf(val), 1); st.discard.push(val);
      if (p.cards.length > HAND) askDiscard(st); else nextTurn(st);
      break;
    default: throw new Error('Escolha desconhecida: ' + pd.kind);
  }
}

function cleanRes(r) {
  const out = {};
  for (const [k, v] of Object.entries(r || {})) {
    if (!(k in QN)) throw new Error('Recurso inválido.');
    const n = Math.floor(+v);
    if (n < 0) throw new Error('Quantidade inválida.');
    if (n > 0) out[k] = n;
  }
  return out;
}

function apply(st, a) {
  if (st.phase === 'over') throw new Error('A partida terminou.');
  const pi = st.current, p = st.players[pi];
  const main = () => {
    if (st.phase !== 'play') throw new Error('Termine a preparação primeiro.');
    if (st.pending) throw new Error('Resolva a escolha pendente primeiro.');
    if (!st.rolled) throw new Error('Role os dados primeiro.');
  };
  switch (a.type) {
    case 'pick': pick(st, a.value); break;
    case 'roll':
      if (st.phase !== 'play' || st.pending || st.rolled) throw new Error('Não é hora de rolar os dados.');
      doRoll(st, a.dice); break;
    case 'build': {
      main();
      const kind = a.kind, B = BUILD[kind];
      if (!B) throw new Error('Construção desconhecida.');
      if (!buildSpots(st, pi, kind).includes(a.at)) throw new Error('Posição inválida para ' + B.name + '.');
      const cost = costOf(st, pi, kind, a.at), plan = payPlan(p, cost);
      if (!plan.ok) throw new Error('Recursos insuficientes.');
      pay(p, cost, plan);
      if (B.tier === 3) st.roads[a.at] = { owner: pi, type: kind };
      else if (B.tier === 1) st.buildings[a.at] = { owner: pi, type: kind };
      else { const b = st.buildings[a.at]; if (kind === 'deuterium') b.base = b.type; b.type = kind; b.heCount = 0; }
      if (B.baryon && st.flags.discount) st.flags.discount = false;
      log(st, `${p.name} constrói ${B.tier === 2 ? 'um núcleo de ' : ''}${B.name}${plan.useE ? ` (1 Energia no lugar de 1 ${QN[plan.useE]})` : ''}.`, pi);
      if (kind === 'lambda' || kind === 'detector') drawCards(st, pi, 1);
      updateLongest(st);
      break;
    }
    case 'bank': {
      main();
      const r = bankRatio(st, pi);
      if (!Q.includes(a.give) || !Q.includes(a.get) || a.give === a.get) throw new Error('Troca inválida.');
      if (p.res[a.give] < r) throw new Error(`Precisa de ${r} ${QN[a.give]}.`);
      p.res[a.give] -= r; p.res[a.get]++;
      log(st, `${p.name} troca ${r} ${QN[a.give]} por 1 ${QN[a.get]} com o banco.`, pi);
      break;
    }
    case 'energy':
      main();
      if (!Q.includes(a.get)) throw new Error('Troca inválida.');
      if (p.res.e < 3) throw new Error('Precisa de 3 Energias.');
      p.res.e -= 3; p.res[a.get]++;
      log(st, `${p.name} converte 3 Energias em 1 ${QN[a.get]}.`, pi);
      break;
    case 'li':
      main();
      if (!owns(st, pi, 'lithium')) throw new Error('Precisa de um Lítio-7.');
      if (st.flags.liUsed) throw new Error('A Fusão do Lítio-7 já foi usada neste turno.');
      if (a.get !== 't' && a.get !== 'b') throw new Error('Escolha Top ou Bottom.');
      if (p.res.u < 1 || p.res.d < 1) throw new Error('Precisa de 1 Up e 1 Down.');
      p.res.u--; p.res.d--; p.res[a.get]++; st.flags.liUsed = true;
      log(st, `Lítio-7: ${p.name} funde 1 Up + 1 Down em 1 ${QN[a.get]}.`, pi);
      break;
    case 'offer': {
      main();
      const to = a.to, give = cleanRes(a.give), get = cleanRes(a.get);
      if (!(to >= 0 && to < st.players.length) || to === pi) throw new Error('Escolha outro jogador.');
      if (!Object.keys(give).length || !Object.keys(get).length) throw new Error('A troca precisa ter algo dos dois lados.');
      if (!hasRes(p, give)) throw new Error('Você não tem esses recursos.');
      st.flags.offers++;
      const can = hasRes(st.players[to], get);
      st.pending = { who: to, kind: 'tradeResponse', pick: 'yesno', options: can ? [true, false] : [false], data: { from: pi, give, get },
        prompt: `${p.name} oferece ${fmtRes(give)} em troca de ${fmtRes(get)}.${can ? '' : ' (Você não tem o que foi pedido.)'}` };
      log(st, `${p.name} propõe uma troca a ${st.players[to].name}.`, pi);
      break;
    }
    case 'card': main(); playCard(st, a.id); break;
    case 'unify':
      main();
      if (!canUnify(st, pi)) throw new Error('Você precisa das 4 cartas básicas de força ao mesmo tempo.');
      for (const c of UNI) { p.cards.splice(p.cards.indexOf(c), 1); st.discard.push(c); }
      p.unified = true;
      log(st, `${p.name} completa o experimento Unificação das Forças: +2 pontos.`, pi);
      break;
    case 'end': main(); endTurn(st); break;
    default: throw new Error('Ação desconhecida.');
  }
  checkWin(st);
  return st;
}

// ---------------------------------------------------------------- ações legais (para bots e testes)
function legal(st) {
  if (st.phase === 'over') return [];
  if (st.pending) return st.pending.options.map(o => ({ type: 'pick', value: o }));
  if (!st.rolled) return [{ type: 'roll' }];
  const pi = st.current, p = st.players[pi], acts = [];
  for (const kind of Object.keys(BUILD)) for (const at of buildSpots(st, pi, kind)) if (payPlan(p, costOf(st, pi, kind, at)).ok) acts.push({ type: 'build', kind, at });
  const r = bankRatio(st, pi);
  for (const g of Q) if (p.res[g] >= r) for (const k of Q) if (k !== g) acts.push({ type: 'bank', give: g, get: k });
  if (p.res.e >= 3) for (const k of Q) acts.push({ type: 'energy', get: k });
  if (owns(st, pi, 'lithium') && !st.flags.liUsed && p.res.u && p.res.d) acts.push({ type: 'li', get: 't' }, { type: 'li', get: 'b' });
  for (const id of new Set(p.cards)) if (cardPlayable(st, pi, id)) acts.push({ type: 'card', id });
  if (canUnify(st, pi)) acts.push({ type: 'unify' });
  acts.push({ type: 'end' });
  return acts;
}

// ---------------------------------------------------------------- computador
const KIND_W = { u: 1.25, d: 1.2, c: 0.8, s: 0.9, t: 0.45, b: 0.45 };
function vertexScore(st, v) {
  return st.board.vertices[v].hexes.reduce((s, h) => { const H = st.board.hexes[h]; return s + (isProd(H.kind) ? prob(H.num) * KIND_W[H.kind] : 0); }, 0);
}
function leader(st, list) { let best = list[0], bv = -1; for (const i of list) { const v = vp(st, i); if (v > bv) { bv = v; best = i; } } return best; }
function botPick(st, pd) {
  const pi = pd.who, opts = pd.options, p = st.players[pi];
  const anyOf = () => opts[ri(st, opts.length)];
  switch (pd.kind) {
    case 'setupHadron': {
      let best = opts[0], bs = -1;
      for (const v of opts) { const s = vertexScore(st, v) + rnd(st) * 0.02; if (s > bs) { bs = s; best = v; } }
      return best;
    }
    case 'higgsHex': case 'tokenHex': {
      if (pd.kind === 'tokenHex' && pd.data.token !== 'higgs') return anyOf();
      let best = opts[0], bs = -Infinity;
      for (const h of opts) {
        const H = st.board.hexes[h]; let s = isProd(H.kind) ? 0 : -5;
        for (const v of H.verts) { const b = st.buildings[v]; if (!b) continue; s += (b.owner === pi ? -3 : 1 + vp(st, b.owner) * 0.1) * (BUILD[b.type].tier === 2 ? 2 : 1); }
        s = s * (prob(H.num) + 0.02) + rnd(st) * 0.01;
        if (s > bs) { bs = s; best = h; }
      }
      return best;
    }
    case 'higgsSteal': case 'fusionPick1': case 'fusionPick2': case 'colab': return leader(st, opts);
    case 'decayPick': case 'fissao': return opts.reduce((a, v) => vp(st, st.buildings[v].owner) > vp(st, st.buildings[a].owner) ? v : a, opts[0]);
    case 'aniqTarget': {
      const vs = opts.filter(o => o.k === 'v');
      const pool = vs.length ? vs : opts;
      return pool[ri(st, pool.length)];
    }
    case 'react': return true;
    case 'tradeResponse': return opts.includes(true) && rnd(st) < 0.5;
    case 'fraca': case 'aniqRes': return opts.reduce((a, k) => (p.res[k] > p.res[a] ? k : a), opts[0]);
    case 'tokenPick': return 'higgs';
    case 'gravity': return opts.reduce((a, v) => gravityHexes(st, v).length > gravityHexes(st, a).length ? v : a, opts[0]);
    case 'gauge': return opts.reduce((a, v) => BUILD[st.buildings[v].type].tier > BUILD[st.buildings[a].type].tier ? v : a, opts[0]);
    case 'discard': {
      const order = ['colaboracao', 'gauge', 'em', 'blindagem', 'fissao', 'aniquilacao', 'fusao', 'descoberta', 'unificada', 'estab', 'forte', 'fraca', 'gravidade'];
      return order.find(c => opts.includes(c)) || anyOf();
    }
    default: return anyOf();
  }
}
function bestRoad(st, pi, spots) {
  let best = spots[0], bs = -1;
  for (const e of spots) {
    let s = rnd(st) * 0.05;
    for (const v of st.board.edges[e].v) if (distanceOK(st, v)) s += vertexScore(st, v);
    if (s > bs) { bs = s; best = e; }
  }
  return best;
}
function botAction(st) {
  if (st.pending) return { type: 'pick', value: botPick(st, st.pending) };
  if (!st.rolled) return { type: 'roll' };
  const pi = st.current, p = st.players[pi];
  if (canUnify(st, pi)) return { type: 'unify' };
  const t1Free = buildSpots(st, pi, 'proton').length;
  const order = ['carbon', 'helium', 'deuterium', 'proton', 'neutron', 'lambda', 'kaon', 'pion', 'lithium', 'magnet', 'detector', 'drift'];
  for (const kind of order) {
    const spots = buildSpots(st, pi, kind).filter(at => payPlan(p, costOf(st, pi, kind, at)).ok);
    if (!spots.length) continue;
    const B = BUILD[kind];
    if (B.tier === 3) {
      if (t1Free > 0 && kind === 'drift' && countTier(st, pi, 3) > 6) continue;
      return { type: 'build', kind, at: bestRoad(st, pi, spots) };
    }
    if (B.tier === 1) { let best = spots[0]; for (const v of spots) if (vertexScore(st, v) > vertexScore(st, best)) best = v; return { type: 'build', kind, at: best }; }
    return { type: 'build', kind, at: spots[0] };
  }
  if (!st.flags.cardPlayed) {
    const playable = [...new Set(p.cards)].filter(id => cardPlayable(st, pi, id));
    if (playable.length && rnd(st) < 0.7) return { type: 'card', id: playable[ri(st, playable.length)] };
  }
  if (owns(st, pi, 'lithium') && !st.flags.liUsed && p.res.u >= 2 && p.res.d >= 2 && p.res.e >= 2) return { type: 'li', get: 't' };
  if (st.flags.botTrades < 3) {
    const want = p.res.u <= p.res.d ? 'u' : 'd';
    if (p.res.e >= 5) { st.flags.botTrades++; return { type: 'energy', get: want }; }
    const r = bankRatio(st, pi);
    const give = [...Q].sort((a, b) => p.res[b] - p.res[a]).find(k => k !== want && p.res[k] >= r + (LIGHT.includes(k) ? 2 : 0));
    if (give) { st.flags.botTrades++; return { type: 'bank', give, get: want }; }
  }
  if (st.flags.offers < 1 && rnd(st) < 0.2) {
    const to = others(st, pi)[ri(st, st.players.length - 1)];
    const mine = [...Q].sort((a, b) => p.res[b] - p.res[a])[0];
    const theirs = LIGHT.find(k => st.players[to].res[k] > 0 && k !== mine);
    if (p.res[mine] > 0 && theirs) return { type: 'offer', to, give: { [mine]: 1 }, get: { [theirs]: 1 } };
  }
  return { type: 'end' };
}

function tileStats() {
  const out = {};
  for (const k of Q) {
    const nums = TILE_SET.filter(t => t.kind === k).map(t => t.num);
    out[k] = { nums, p: nums.reduce((s, n) => s + prob(n), 0) };
  }
  return out;
}

return {
  Q, QN, WIN, HAND, LIMIT, LONG_MIN, FIELDS, FIELD_NAME, TOKEN_SYM, TILE_SET, TILE_NAME, BUILD, CARDS, NUCLEI, UNI, DECK_SIZE,
  isProd, prob, newGame, apply, legal, botAction, vp, vpBreak, chainLen, buildSpots, costOf, payPlan, bankRatio,
  cardPlayable, whyNotCard, canUnify, owns, countTier, qCount, fmtRes, tileStats, stealImmune,
};
})();
if (typeof module !== 'undefined') module.exports = HadronEngine;
