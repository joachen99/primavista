const PV = require('../gen.js');
const { midiOf, mod7 } = PV._internal;
let fails = 0, total = 0;
const fail = (msg, ex) => { fails++; if (fails < 25) console.log('FAIL', msg, ex ? ex.abc.slice(0, 400) : ''); };
const stats = { intervals: {}, keys: {}, meters: {}, endDeg: {}, styles: {} };

for (let level = 1; level <= 6; level++) {
  for (const hands of ['both', 'rh', 'lh']) {
    for (const bars of [4, 8, 12, 16]) {
      for (let s = 0; s < 150; s++) {
        total++;
        const ex = PV.sightReading({ level, hands, bars, key: 'auto', meter: 'auto' }, 1000 * level + s * 7 + bars);
        const m = ex.meter;
        stats.keys[ex.key.id] = (stats.keys[ex.key.id] || 0) + 1;
        stats.meters[ex.meterId] = (stats.meters[ex.meterId] || 0) + 1;
        if (ex.accStyle) stats.styles[level + ex.accStyle] = (stats.styles[level + ex.accStyle] || 0) + 1;
        // durations
        ex._debug.voices.forEach((v) => v.bars.forEach((cells, bi) => {
          const sum = cells.flat().reduce((a, n) => a + n.dur, 0);
          if (sum !== m.bar) fail(`bar dur L${level} ${hands} bar${bi} sum ${sum}`, ex);
          cells.flat().forEach((n) => { if (!n.rest && (n.deg === undefined || Number.isNaN(n.deg))) fail('undefined deg', ex); });
        }));
        // melody intervals
        const melEv = ex.events.filter((e) => e.voice === 0).sort((a, b) => a.start - b.start);
        for (let i = 1; i < melEv.length; i++) {
          const d = Math.abs(melEv[i].midi - melEv[i - 1].midi);
          stats.intervals[d] = (stats.intervals[d] || 0) + 1;
          if (d === 6 || d > 12 || d === 10 || d === 11) fail(`bad leap ${d} L${level}`, ex);
        }
        // ends on tonic
        const last = melEv[melEv.length - 1];
        const tonicPc = (midiOf(ex.key.t, ex.key.sig[ex.key.t]) % 12 + 12) % 12;
        if (((last.midi % 12) + 12) % 12 !== tonicPc) fail('not ending on tonic', ex);
        const pen = melEv[melEv.length - 2];
        const pd = last.midi - pen.midi; stats.endDeg[pd] = (stats.endDeg[pd] || 0) + 1;
        // ranges / hands apart
        if (hands === 'both') {
          const rhMin = Math.min(...ex.events.filter((e) => e.voice === 0).map((e) => e.midi));
          const lhMax = Math.max(...ex.events.filter((e) => e.voice === 1).map((e) => e.midi));
          if (lhMax >= rhMin) fail(`hands overlap rhMin ${rhMin} lhMax ${lhMax} L${level}`, ex);
          if (lhMax > 64) fail('LH too high ' + lhMax, ex);
        }
        const all = ex.events.map((e) => e.midi);
        if (Math.min(...all) < 36 || Math.max(...all) > 86) fail(`extreme range ${Math.min(...all)}-${Math.max(...all)}`, ex);
        if (hands !== 'lh') { const mx = Math.max(...melEv.map((e) => e.midi)); if (mx > 84) fail('RH too high ' + mx, ex); }
        // ABC sanity
        const body = ex.abc.split('\n').filter((l) => l && !/^[A-Z]:|^%%/.test(l));
        const lines = body.length;
        const expLines = (bars / 4) * (hands === 'both' ? 2 : 1);
        if (lines !== expLines) fail(`lines ${lines} vs ${expLines}`, ex);
        if (/undefined|NaN|null/.test(ex.abc)) fail('bad token', ex);
        const open = (ex.abc.match(/\(/g) || []).length, close = (ex.abc.match(/\)/g) || []).length;
        if (open !== close) fail('slur mismatch', ex);
        body.forEach((l) => {
          const clean = l.replace(/^\[V:(RH|LH)\] /, '');
          const toks = clean.split(/[\s|\]]+/).filter(Boolean);
          toks.forEach((t) => { if (!/^\(?(!(p|mp|mf|[1-5])!)*((\^\^|__|[_^=])?[A-Ga-g][,']*\d*|z\d*)+\)?$/.test(t)) fail('token ' + t, ex); });
        });
      }
    }
  }
}
console.log(`sight-reading: ${total} exercises, ${fails} failures`);
console.log('melodic interval semitone histogram', stats.intervals);
console.log('penultimate->final semitones', stats.endDeg);
console.log('meters', stats.meters);
console.log('LH styles', stats.styles);

// ---------- theory ----------
let tf = 0, tt = 0;
const NUM = { 'Unison': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5, '6th': 6, '7th': 7, 'Octave': 8 };
const SEM = { 'Major 2nd': 2, 'minor 2nd': 1, 'Major 3rd': 4, 'minor 3rd': 3, 'Perfect 4th': 5, 'Perfect 5th': 7, 'Major 6th': 9, 'minor 6th': 8, 'Major 7th': 11, 'minor 7th': 10, 'Perfect octave': 12,
  'Augmented 2nd': 3, 'diminished 2nd': 0, 'Augmented 3rd': 5, 'diminished 3rd': 2, 'Augmented 4th': 6, 'diminished 4th': 4, 'Augmented 5th': 8, 'diminished 5th': 6, 'Augmented 6th': 10, 'diminished 6th': 7, 'Augmented 7th': 12, 'diminished 7th': 9 };
const LET = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }; const BS = [0, 2, 4, 5, 7, 9, 11];
function parseAbcNotes(body) {
  const out = []; const re = /(\^\^|__|[_^=])?([A-Ga-g])([,']*)/g; let m;
  while ((m = re.exec(body))) {
    const L = LET[m[2].toUpperCase()]; let oct = m[2] === m[2].toLowerCase() ? 5 : 4;
    for (const ch of m[3]) oct += ch === "'" ? 1 : -1;
    const alter = { '^': 1, '_': -1, '^^': 2, '__': -2, '=': 0 }[m[1]] || 0;
    out.push({ dia: oct * 7 + L, midi: 12 * (oct + 1) + BS[L] + alter, alter });
  }
  return out;
}
for (const topic of ['notes', 'intervals', 'keys', 'triads', 'scales', 'mixed']) for (const difficulty of ['easy', 'medium', 'hard']) for (const clef of ['treble', 'bass', 'both']) for (let s = 0; s < 40; s++) {
  const ws = PV.theoryWorksheet({ topic, difficulty, clef, count: 16 }, s * 31 + 5);
  const want = 16;
  if (ws.items.length !== want) { tf++; console.log('count', topic, difficulty, ws.items.length); }
  ws.items.forEach((q) => {
    tt++;
    const body = q.abc.split('\n')[4];
    if (q.type === 'interval') {
      const ns = parseAbcNotes(body);
      const num = ns[1].dia - ns[0].dia + 1;
      const semis = ns[1].midi - ns[0].midi;
      if (difficulty === 'easy') { if (NUM[q.answer] !== num) { tf++; console.log('int easy', body, q.answer); } }
      else { const nm = q.answer.split(' ').pop(); const nn = q.answer === 'Perfect octave' ? 8 : NUM[nm]; if (nn !== num || SEM[q.answer] !== semis) { tf++; console.log('int', body, q.answer, num, semis); } }
    }
    if (q.type === 'triad') {
      const ns = parseAbcNotes(body);
      // find root: stack in thirds
      const pcs = ns.map((n) => n.dia);
      const rootIdx = ns.findIndex((n) => ns.every((o) => mod7(o.dia - n.dia) % 2 === 0));
      const root = ns[rootIdx];
      const third = ns.find((o) => mod7(o.dia - root.dia) === 2), fifth = ns.find((o) => mod7(o.dia - root.dia) === 4);
      const t = ((third.midi - root.midi) % 12 + 12) % 12, f = ((fifth.midi - root.midi) % 12 + 12) % 12;
      const qual = t === 4 && f === 7 ? 'major' : t === 3 && f === 7 ? 'minor' : t === 3 && f === 6 ? 'diminished' : t === 4 && f === 8 ? 'augmented' : '?';
      const inv = rootIdx === 0 ? '' : ns[0] === third ? ', 1st inversion' : ', 2nd inversion';
      if (!q.answer.endsWith(qual + inv)) { tf++; console.log('triad', body, q.answer, qual, inv); }
    }
    if (q.type === 'scale') {
      const ns = parseAbcNotes(body);
      const steps = ns.slice(1).map((n, i) => n.midi - ns[i].midi).join('');
      const exp = { major: '2212221', 'natural minor': '2122122', 'harmonic minor': '2122131', 'melodic minor': '2122221' };
      const type = q.meta.type;
      if (steps !== exp[type]) { tf++; console.log('scale', q.prompt, steps); }
      if (q.pk !== 'scaleId' || q.answer !== q.meta.name) { tf++; console.log('scale not an identify task', q.pk, q.answer); }
    }
    if (/undefined|NaN/.test(q.abc + q.answer)) { tf++; console.log('bad', q); }
  });
}
// custom note-name range is respected in both clefs
const NR = { treble: [27, 35], bass: [15, 19] };
for (const clef of ['treble', 'bass', 'both']) for (const difficulty of ['easy', 'medium', 'hard']) for (let s = 0; s < 30; s++) {
  const ws = PV.theoryWorksheet({ topic: 'notes', difficulty, clef, count: 16, noteRange: NR }, s * 13 + 1);
  const qz = PV.quiz({ topics: ['notes'], difficulty, clef, count: 10, noteRange: NR }, s * 17 + 3);
  ws.items.concat(qz.items).forEach((q) => { tt++; const [lo, hi] = NR[q.meta.clef]; if (q.meta.dia < lo || q.meta.dia > hi) { tf++; console.log('note out of range', q.meta); } });
}
// level 1: C major, 4/4, steps and thirds only
for (let s = 0; s < 300; s++) {
  const ex = PV.sightReading({ level: 1, hands: 'both', bars: 8 }, s);
  if (ex.key.id !== 'C' || ex.meterId !== '4/4') { tf++; console.log('level 1 key/meter', ex.key.id, ex.meterId); }
}
console.log(`theory: ${tt} questions, ${tf} failures`);

console.log('\n--- samples ---');
for (const [lvl, h, b] of [[1, 'both', 8], [3, 'both', 8], [5, 'both', 8], [4, 'lh', 8]]) {
  const ex = PV.sightReading({ level: lvl, hands: h, bars: b }, 4242 + lvl);
  console.log(`L${lvl} ${h} ${ex.title} (${ex.accStyle})\n${ex.abc}`);
}

// ---------- quiz ----------
let qf = 0, qt = 0; const fewer = {};
for (const difficulty of ['easy', 'medium', 'hard']) for (const clef of ['treble', 'bass', 'both']) for (let s = 0; s < 60; s++) {
  const topics = [['notes'], ['intervals'], ['keys'], ['triads'], ['scales'], ['notes', 'intervals', 'keys', 'triads', 'scales']][s % 6];
  const qz = PV.quiz({ topics, difficulty, clef, count: 20 }, s * 13 + 1);
  if (qz.items.length !== 20) { qf++; console.log('quiz count', topics, difficulty, qz.items.length); }
  qz.items.forEach((q) => {
    qt++;
    const c = q.choices;
    if (!c.includes(q.answer)) { qf++; console.log('answer missing', q.answer, c); }
    if (new Set(c).size !== c.length) { qf++; console.log('dup', c); }
    if (c.length < 4) { fewer[q.type + difficulty] = (fewer[q.type + difficulty] || 0) + 1; }
    if (c.some((x) => /undefined|NaN/.test(x))) { qf++; console.log('bad choice', c); }
  });
}
console.log(`quiz: ${qt} questions, ${qf} failures, fewer-than-4 choices:`, fewer);
for (const lang of ['en', 'nb']) {
  const valid = new Set(); const N = PV.namer(lang);
  ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'].forEach((t) => { const L='CDEFGAB'.indexOf(t[0]), a=t[1]==='#'?1:t[1]==='b'?-1:0; valid.add(N.scale(L,a,'major')); });
  ['Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#','G#','D#','A#'].forEach((t) => { const L='CDEFGAB'.indexOf(t[0]), a=t[1]==='#'?1:t[1]==='b'?-1:0; ['natural minor','harmonic minor','melodic minor'].forEach((ty) => valid.add(N.scale(L,a,ty))); });
  let bad = 0, dup = 0, n = 0;
  for (const d of ['easy','medium','hard']) for (let s2 = 0; s2 < 200; s2++) {
    const qz = PV.quiz({ topics: ['notes','intervals','keys','triads','scales'], difficulty: d, clef: 'both', count: 20, lang }, s2);
    qz.items.forEach((q) => { n++; if (new Set(q.choices).size !== 4 || !q.choices.includes(q.answer)) dup++; if (q.type === 'scale') q.choices.forEach((c) => { if (!valid.has(c)) { bad++; if (bad < 4) console.log('invalid scale', lang, c); } }); });
  }
  console.log(`quiz ${lang}: ${n} questions, ${dup} choice problems, ${bad} non-existent scales`);
}
const sq = PV.quiz({ topics: ['notes', 'intervals', 'keys', 'triads', 'scales'], difficulty: 'hard', clef: 'both', count: 10 }, 99);
sq.items.forEach((q) => console.log(q.type, '|', q.pk, '|', q.answer, '|', q.choices.join(' ; ')));
const sr = PV.sightReading({ level: 3, hands: 'both', bars: 8 }, 5);
console.log(sr.systems.map((x) => x.abc).join('\n---\n'));
