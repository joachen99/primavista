/* Prima Vista — music material generators (sight-reading + theory).
   Pure logic: produces ABC notation strings plus playback event data. */
(function (root) {
  'use strict';

  const LETTERS = 'CDEFGAB';
  const BASE = [0, 2, 4, 5, 7, 9, 11];
  const SHARPS = 'FCGDAEB', FLATS = 'BEADGCF';
  const mod7 = (d) => ((d % 7) + 7) % 7;

  // ---------- randomness ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function wpick(r, items, wfn) {
    let tot = 0;
    const ws = items.map((it) => { const w = Math.max(0, wfn(it) || 0); tot += w; return w; });
    if (tot <= 0) return null;
    let x = r() * tot;
    for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x < 0) return items[i]; }
    return items[items.length - 1];
  }
  function shuffle(r, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- pitch helpers ----------
  function keySig(n) {
    const s = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < Math.abs(n); i++) {
      if (n > 0) s[LETTERS.indexOf(SHARPS[i])] = 1; else s[LETTERS.indexOf(FLATS[i])] = -1;
    }
    return s;
  }
  // dia = octave*7 + letter  (C4 = 28, middle C)
  const midiOf = (dia, alter) => 12 * (Math.floor(dia / 7) + 1) + BASE[mod7(dia)] + alter;
  function abcLetter(dia) {
    const oct = Math.floor(dia / 7), L = LETTERS[mod7(dia)];
    if (oct >= 5) return L.toLowerCase() + "'".repeat(oct - 5);
    return L + ','.repeat(Math.max(0, 4 - oct));
  }
  const ACC_ABC = { '-2': '__', '-1': '_', '0': '=', '1': '^', '2': '^^' };
  const ACC_SYM = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  const noteName = (letter, alter) => LETTERS[letter] + ACC_SYM[alter];
  const prettyKey = (s) => s.replace(/^([A-G])b/, '$1♭').replace(/^([A-G])#/, '$1♯');

  // ---------- keys ----------
  const MAJOR_BY_N = { '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' };
  const MINOR_BY_N = { '-7': 'Ab', '-6': 'Eb', '-5': 'Bb', '-4': 'F', '-3': 'C', '-2': 'G', '-1': 'D', 0: 'A', 1: 'E', 2: 'B', 3: 'F#', 4: 'C#', 5: 'G#', 6: 'D#', 7: 'A#' };
  function makeKey(n, minor) {
    const tonic = (minor ? MINOR_BY_N : MAJOR_BY_N)[n];
    return {
      id: tonic + (minor ? 'm' : ''), abc: tonic + (minor ? 'm' : ''), t: LETTERS.indexOf(tonic[0]),
      n, minor, sig: keySig(n), name: prettyKey(tonic) + (minor ? ' minor' : ' major'), tl: LETTERS.indexOf(tonic[0]), ta: keySig(n)[LETTERS.indexOf(tonic[0])],
    };
  }
  const SR_KEYS = [];
  for (const n of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) SR_KEYS.push(makeKey(n, false));
  for (const n of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) SR_KEYS.push(makeKey(n, true));
  const keyById = (id) => SR_KEYS.find((k) => k.id === id);

  // ---------- sight-reading configuration ----------
  // lh: left-hand styles (picked per exercise, or per phrase when varyLh) · chordN: notes in LH chords · wide: octave basses,
  // wide broken chords, notes down to D2 · artic: staccato and accents · turns: hands take turns (never together)
  const LEVELS = {
    1: { acc: 0, minor: false, meters: ['4/4'], range: [0, 4], five: true, turns: true, maxLeap: 1, chords: ['I', 'V'], lh: ['roots'], rests: 0, slur: false, dyn: false, bpm: 60,
         blurb: 'Hands take turns · around middle C · steps only · whole, half and quarter notes' },
    2: { acc: 1, minor: false, meters: ['4/4', '4/4', '3/4'], range: [0, 4], five: true, maxLeap: 2, chords: ['I', 'V'], lh: ['roots'], rests: 0, slur: false, dyn: false, bpm: 66,
         blurb: 'Five-finger position · C, G and F major · whole, half and quarter notes' },
    3: { acc: 2, minor: true, meters: ['4/4', '4/4', '3/4', '2/4'], range: [0, 4], five: true, maxLeap: 3, chords: ['I', 'IV', 'V'], lh: ['roots', 'halves'], rests: 0, slur: true, dyn: true, bpm: 72,
         blurb: 'Five-finger position · up to 2 sharps/flats, minor keys · eighth notes' },
    4: { acc: 3, minor: true, meters: ['4/4', '4/4', '3/4', '2/4'], range: [-2, 7], five: false, maxLeap: 4, chords: ['I', 'ii', 'IV', 'V', 'vi'], lh: ['halves', 'quarters', 'oompah', 'oompah'], chordN: 2, rests: 0.06, slur: true, dyn: true, bpm: 80,
         blurb: 'Shifting positions · up to 3 sharps/flats · dotted rhythms · bass-and-chord and broken-chord left hand' },
    5: { acc: 4, minor: true, meters: ['4/4', '3/4', '2/4', '6/8'], range: [-3, 8], five: false, maxLeap: 5, chords: ['I', 'ii', 'IV', 'V', 'vi'], lh: ['oompah', 'arp8', 'quarters'], chordN: 3, wide: true, artic: true, varyLh: true, rests: 0.12, slur: true, dyn: true, bpm: 84,
         blurb: 'Up to 4 sharps/flats · 6/8 time · rests · waltz and oom-pah bass with leaps · wide broken chords in eighths · staccato and accents' },
    6: { acc: 5, minor: true, meters: ['4/4', '3/4', '2/4', '6/8'], range: [-4, 9], five: false, maxLeap: 7, chords: ['I', 'ii', 'IV', 'V', 'vi', 'V/V'], lh: ['eighths', 'arp8', 'arp16', 'oompah'], chordN: 3, wide: true, artic: true, varyLh: true, rests: 0.12, slur: true, dyn: true, bpm: 80,
         blurb: 'Up to 5 sharps/flats · sixteenth notes · Alberti bass and sixteenth-note left hand · octave bass · secondary dominant' },
    7: { acc: 6, minor: true, meters: ['4/4', '3/4', '2/4', '6/8'], range: [-4, 10], five: false, maxLeap: 7, chords: ['I', 'ii', 'IV', 'V', 'vi', 'V/V'], lh: ['arp16', 'arp16', 'eighths', 'arp8', 'oompah'], chordN: 3, wide: true, artic: true, varyLh: true, rests: 0.15, slur: true, dyn: true, bpm: 76,
         blurb: 'Up to 6 sharps/flats · chromatic notes · busy left hand in sixteenths · wide leaps in both hands' },
  };

  const METERS = {
    '4/4': { bar: 16, beat: 4, beats: 4, compound: false },
    '3/4': { bar: 12, beat: 4, beats: 3, compound: false },
    '2/4': { bar: 8, beat: 4, beats: 2, compound: false },
    '6/8': { bar: 12, beat: 6, beats: 2, compound: true },
  };

  // rhythm cells; durations in sixteenths; w = weight per level 1..7
  const SIMPLE_CELLS = [
    { d: [4], b: 1, w: [4, 6, 6, 5, 4, 3, 2.5] },
    { d: [8], b: 2, w: [5, 3, 3, 2, 1.5, 1, 0.7] },
    { d: [12], b: 3, w: [0.4, 1, 1, 0.7, 0.5, 0.3, 0.2] },
    { d: [16], b: 4, w: [2, 1, 0.6, 0.3, 0.2, 0.1, 0.05] },
    { d: [2, 2], b: 1, w: [0, 0, 1.5, 3, 3, 3, 3] },
    { d: [6, 2], b: 2, w: [0, 0, 0, 1.2, 1.5, 1.5, 1.6] },
    { d: [3, 1], b: 1, w: [0, 0, 0, 0, 0, 1, 1.3] },
    { d: [1, 1, 1, 1], b: 1, w: [0, 0, 0, 0, 0, 1, 1.6] },
    { d: [2, 1, 1], b: 1, w: [0, 0, 0, 0, 0, 0.8, 1.1] },
    { d: [1, 1, 2], b: 1, w: [0, 0, 0, 0, 0, 0.8, 1.1] },
  ];
  const COMPOUND_CELLS = [
    { d: [6], b: 1, w: [4, 4, 4, 4, 3, 3, 2.5] },
    { d: [4, 2], b: 1, w: [3, 3, 3, 3, 3, 3, 3] },
    { d: [2, 2, 2], b: 1, w: [2, 2, 2, 2, 3, 3, 3] },
    { d: [12], b: 2, w: [1, 1, 1, 1, 0.7, 0.5, 0.4] },
    { d: [2, 2, 1, 1], b: 1, w: [0, 0, 0, 0, 0, 1, 1.3] },
    { d: [3, 1, 2], b: 1, w: [0, 0, 0, 0, 0, 1, 1.2] },
  ];
  const END_PATTERNS = {
    '4/4': [{ c: [[4], [4], [8]], l: 1 }, { c: [[8], [8]], l: 1 }, { c: [[16]], l: 1 }, { c: [[2, 2], [4], [8]], l: 3 }, { c: [[6, 2], [8]], l: 4 }],
    '3/4': [{ c: [[12]], l: 1 }, { c: [[4], [8]], l: 1 }, { c: [[2, 2], [8]], l: 3 }],
    '2/4': [{ c: [[8]], l: 1 }, { c: [[4], [4]], l: 1 }, { c: [[2, 2], [4]], l: 3 }],
    '6/8': [{ c: [[12]], l: 1 }, { c: [[4, 2], [6]], l: 1 }, { c: [[2, 2, 2], [6]], l: 1 }],
  };

  function startOk(cell, beat, meterId) {
    if (METERS[meterId].compound) return cell.b === 1 || beat === 0;
    if (cell.b === 1) return true;
    if (cell.b === 2) return meterId === '4/4' ? beat % 2 === 0 : meterId === '3/4' ? beat <= 1 : beat === 0;
    return beat === 0;
  }

  function genBarRhythm(r, meterId, level, kind) {
    const m = METERS[meterId];
    if (kind === 'final') return [[m.bar]];
    if (kind === 'half' || kind === 'auth') {
      const opts = END_PATTERNS[meterId].filter((p) => p.l <= level);
      return pick(r, opts).c.map((c) => c.slice());
    }
    const pool = m.compound ? COMPOUND_CELLS : SIMPLE_CELLS;
    const cells = [];
    let beat = 0;
    while (beat < m.beats) {
      const opts = pool.filter((c) => c.w[level - 1] > 0 && c.b <= m.beats - beat && startOk(c, beat, meterId));
      const c = wpick(r, opts, (c) => c.w[level - 1]);
      cells.push(c.d.slice());
      beat += c.b;
    }
    return cells;
  }

  const CHORD_ROOT = { I: 0, ii: 1, IV: 3, V: 4, vi: 5, 'V/V': 1 };
  const HALF_T = [['I', 'IV', 'I', 'V'], ['I', 'V', 'I', 'V'], ['I', 'I', 'IV', 'V'], ['I', 'vi', 'IV', 'V'], ['I', 'vi', 'ii', 'V'], ['I', 'IV', 'ii', 'V'], ['I', 'I', 'V', 'V'], ['I', 'I', 'I', 'V'], ['I', 'IV', 'V/V', 'V'], ['I', 'vi', 'V/V', 'V']];
  const AUTH_T = [['I', 'IV', 'V', 'I'], ['I', 'V', 'V', 'I'], ['I', 'vi', 'V', 'I'], ['IV', 'I', 'V', 'I'], ['I', 'ii', 'V', 'I'], ['vi', 'IV', 'V', 'I'], ['I', 'I', 'V', 'I'], ['I', 'V/V', 'V', 'I'], ['IV', 'V/V', 'V', 'I']];
  function chordTemplate(r, kind, allowed, minor) {
    const pool = (kind === 'half' ? HALF_T : AUTH_T).filter((t) => t.every((c) => allowed.includes(c)));
    let t = pick(r, pool).slice();
    if (minor) t = t.map((c) => (c === 'ii' || c === 'V/V' ? 'IV' : c)); // avoid diminished ii (and V/V) in minor
    return t;
  }
  const chordTones = (c) => { const rt = CHORD_ROOT[c]; return [rt, mod7(rt + 2), mod7(rt + 4)]; };

  // allowed melodic intervals: diatonic size -> allowed semitone sizes (excludes tritones, aug 2nds, dim 4ths…)
  const OK_SEMIS = { 0: [0], 1: [1, 2], 2: [3, 4], 3: [5], 4: [7], 5: [8, 9], 7: [12] };
  const INT_W = { 0: 1, 1: 6, 2: 3, 3: 1.2, 4: 1, 5: 0.4, 7: 0.5 };

  function sightReading(settings, seed) {
    const r = rng(seed);
    const level = settings.level;
    const cfg = LEVELS[level];
    const hands = settings.hands || 'both';

    let key = settings.key && settings.key !== 'auto' ? keyById(settings.key) : null;
    if (!key) {
      const pool = SR_KEYS.filter((k) => Math.abs(k.n) <= cfg.acc && (cfg.minor || !k.minor));
      key = wpick(r, pool, (k) => (k.minor ? 0.45 : 1) * (Math.abs(k.n) === cfg.acc ? 1.4 : 1));
    }
    const meterId = settings.meter && settings.meter !== 'auto' ? settings.meter : pick(r, cfg.meters);
    const meter = METERS[meterId];
    const nBars = settings.bars || 8;
    const nPhr = Math.max(1, Math.round(nBars / 4));

    // --- structure: phrases, chords, rhythms ---
    const bars = [];
    const firstPhraseRhythm = [];
    const repeatOpening = level >= 3 && r() < 0.6;
    for (let p = 0; p < nPhr; p++) {
      const kind = p === nPhr - 1 ? 'final' : p % 2 === 0 ? 'half' : 'auth';
      const chords = chordTemplate(r, kind === 'half' ? 'half' : 'auth', cfg.chords, key.minor);
      for (let b = 0; b < 4; b++) {
        const barKind = b < 3 ? 'mid' : kind;
        let cells, rests = new Set();
        if (p > 0 && b < 2 && repeatOpening && p % 2 === 0) { cells = firstPhraseRhythm[b].cells.map((c) => c.slice()); rests = new Set(firstPhraseRhythm[b].rests); }
        else if (p > 0 && b < 2 && repeatOpening && p % 2 === 1 && r() < 0.5) { cells = firstPhraseRhythm[b].cells.map((c) => c.slice()); rests = new Set(firstPhraseRhythm[b].rests); }
        else {
          cells = genBarRhythm(r, meterId, level, barKind);
          if (barKind === 'mid' && !(p === 0 && b === 0) && cfg.rests > 0) {
            for (let ci = 0; ci < cells.length; ci++) {
              const c = cells[ci];
              const isBeat = c.length === 1 && c[0] === meter.beat;
              if (isBeat && rests.size === 0 && ci > 0 && r() < cfg.rests * 2.5) rests.add(ci);
            }
          }
        }
        if (p === 0) firstPhraseRhythm.push({ cells, rests: [...rests] });
        bars.push({ phrase: p, idx: b, chord: chords[b], kind: barKind, cells, rests });
      }
    }

    // --- placement of hands ---
    const center = (cfg.range[0] + cfg.range[1]) / 2;
    const placeTonic = (target, c) => { let best = null; for (let o = 1; o <= 6; o++) { const d = o * 7 + key.t; if (best === null || Math.abs(d + c - target) < Math.abs(best + c - target)) best = d; } return best; };
    const melodyHand = hands === 'lh' ? 'lh' : 'rh';
    const melTonic = placeTonic(melodyHand === 'rh' ? 32 : 23, center);
    let melRange = cfg.range.slice();
    // LH accompaniment tonic: five-finger position A2–G3; otherwise D3–A3 (lowest note stays around E2 or above)
    const lhWin = cfg.five ? [19, 25] : [17, 23];
    let lhTonic = key.t + 14; while (lhTonic < lhWin[0]) lhTonic += 7;
    let lhRange = cfg.five ? [0, 4] : cfg.wide ? [Math.max(-7, 15 - lhTonic), 7] : [Math.max(-4, 16 - lhTonic), 7];
    if (hands === 'both') {
      // keep the hands apart: RH not below D4, LH not touching RH
      const rhFloor = 29 - melTonic;
      if (melRange[0] < rhFloor) melRange[0] = Math.min(rhFloor, melRange[1] - 4);
      const lhCeil = melTonic + melRange[0] - 1 - lhTonic;
      if (!cfg.five && lhRange[1] > lhCeil) lhRange[1] = lhCeil;
    }

    const botLimit = melodyHand === 'rh' ? 26 : 16;
    if (melTonic + melRange[0] < botLimit) melRange[0] = Math.min(botLimit - melTonic, melRange[1] - 4);
    const topLimit = melodyHand === 'rh' ? 40 : 30;
    if (melTonic + melRange[1] > topLimit) melRange[1] = Math.max(topLimit - melTonic, melRange[0] + 4);
    const isV = (bar) => bar.chord === 'V';
    // raised 7th in minor V bars; raised 4th (e.g. F♯ in C major) in V/V bars
    const raisedFor = (deg, bar) => (key.minor && isV(bar) && mod7(deg) === 6) || (bar.chord === 'V/V' && mod7(deg) === 3);
    const pitch = (tonicDia, deg, bar) => {
      const dia = tonicDia + deg;
      const alter = key.sig[mod7(dia)] + (raisedFor(deg, bar) ? 1 : 0);
      return { dia, alter, midi: midiOf(dia, alter) };
    };

    // --- melody ---
    function genMelody(tonicDia, range) {
      const notes = [];
      bars.forEach((bar, bi) => {
        let off = 0;
        bar.cells.forEach((cell, ci) => {
          cell.forEach((dur) => { notes.push({ bar: bi, off, dur, rest: bar.rests.has(ci) }); off += dur; });
        });
      });
      const playable = notes.filter((n) => !n.rest);
      const lastIdx = playable.length - 1;
      // last sounding note of each bar
      const lastInBar = {};
      playable.forEach((n, i) => { lastInBar[n.bar] = i; });
      let prev = null, lastInt = 0, rep = 0;
      playable.forEach((n, i) => {
        const bar = bars[n.bar];
        const ct = chordTones(bar.chord);
        const strong = n.off === 0 || (meterId === '4/4' && n.off === 8) || (meter.compound && n.off === 6);
        const phraseEnd = lastInBar[n.bar] === i && (bar.kind === 'half' || bar.kind === 'auth');
        const tonics = []; for (let d = range[0]; d <= range[1]; d++) if (mod7(d) === 0) tonics.push(d);
        let deg;
        if (prev === null) {
          const opts = []; for (let d = range[0]; d <= range[1]; d++) if (ct.includes(mod7(d))) opts.push(d);
          deg = wpick(r, opts, (d) => (mod7(d) === 0 ? 3 : 2) * (cfg.five ? (d === range[0] || d === range[1] ? 1.5 : 1) : 1) / (1 + Math.abs(d - (range[0] + range[1]) / 2) * 0.15) *
            (cfg.maxLeap === 1 && Math.min(...tonics.map((t) => Math.abs(d - t))) > lastIdx ? 1e-6 : 1));
        } else if (i === lastIdx) {
          // nearest tonic; may sit one step above the range (or below, for one hand) so the line resolves by step instead of leaping a 7th
          const cands = tonics.slice();
          if (mod7(range[1] + 1) === 0) cands.push(range[1] + 1);
          if (hands !== 'both' && mod7(range[0] - 1) === 0) cands.push(range[0] - 1);
          let best = cands[0];
          for (const t of cands) if (Math.abs(t - prev) < Math.abs(best - prev)) best = t;
          deg = best;
        } else {
          const opts = [];
          for (let d = range[0]; d <= range[1]; d++) {
            const iv = Math.abs(d - prev);
            if (iv > cfg.maxLeap || !(iv in OK_SEMIS)) continue;
            const semis = Math.abs(pitch(tonicDia, d, bar).midi - pitch(tonicDia, prev, bars[n._pb] || bar).midi);
            if (!OK_SEMIS[iv].includes(semis)) continue;
            opts.push(d);
          }
          deg = wpick(r, opts, (d) => {
            const iv = Math.abs(d - prev), dir = Math.sign(d - prev);
            let w = INT_W[iv];
            const chordTone = ct.includes(mod7(d));
            if (strong || phraseEnd) w *= chordTone ? 4 : (iv > 1 ? 0.03 : 0.15);
            else if (!chordTone && iv > 1) w *= 0.2;
            if (Math.abs(lastInt) >= 3) { if (dir === -Math.sign(lastInt) && iv === 1) w *= 3; else if (dir === Math.sign(lastInt)) w *= 0.25; }
            if (iv === 0 && rep >= 1) w *= 0.15;
            // fast notes move mostly by step
            if (n.dur <= 2 && iv >= 3) w *= 0.35;
            if (n.dur === 1 && iv >= 2) w *= 0.3;
            // leading tone resolves upward to the tonic
            // raised 4th of a V/V bar resolves up to the 5th
            if (mod7(prev) === 3 && bars[n._pb] && bars[n._pb].chord === 'V/V') w *= d === prev + 1 ? 8 : 0.2;
            if (mod7(prev) === 6) {
              const strongLT = key.minor && bars[n._pb] && bars[n._pb].chord === 'V';
              if (d === prev + 1) w *= strongLT ? 8 : 2.5; else if (strongLT) w *= 0.25;
            }
            if (phraseEnd && bar.kind === 'half') w *= mod7(d) === 4 ? 3 : mod7(d) === 1 ? 1.5 : 1;
            if (phraseEnd && bar.kind === 'auth') w *= mod7(d) === 0 ? 5 : mod7(d) === 2 ? 1.5 : 0.5;
            if (i === lastIdx - 1) {
              const dist = Math.min(...tonics.map((t) => Math.abs(d - t)));
              const fifth = tonics.some((t) => d - t === 4 || d - t === -3);
              if (cfg.maxLeap === 1) w *= dist <= 1 ? 5 : 1e-6; // steps-only level: approach the final tonic by step
              else w *= dist === 1 ? 5 : fifth ? 2 : dist === 2 ? 1 : 1e-6; // never leave the last note a 7th from the tonic
            }
            // steps-only level: never wander further from the tonic than the notes left can walk back
            if (cfg.maxLeap === 1) { const dist = Math.min(...tonics.map((t) => Math.abs(d - t))); if (dist > lastIdx - i) w *= 1e-6; }
            // gently pull toward middle of range
            const mid = (range[0] + range[1]) / 2;
            w *= 1 / (1 + Math.max(0, Math.abs(d - mid) - (range[1] - range[0]) / 3) * 0.4);
            return w;
          });
          if (deg === null || deg === undefined) deg = prev + (prev > (range[0] + range[1]) / 2 ? -1 : 1);
        }
        if (prev !== null) { lastInt = deg - prev; rep = lastInt === 0 ? rep + 1 : 0; }
        n.deg = deg; n._pb = n.bar;
        prev = deg;
        // remember bar of previous note for semitone checks
        if (playable[i + 1]) playable[i + 1]._pb = n.bar;
      });
      return notes;
    }

    // --- left-hand accompaniment ---
    function genAccomp() {
      let style = pick(r, cfg.lh);
      const styles = [];
      const out = [];
      let prevRoot = 0, prevChordLow = null;
      const inR = (d) => d >= lhRange[0] && d <= lhRange[1];
      bars.forEach((bar, bi) => {
        if (cfg.varyLh && bar.idx === 0 && bi > 0) style = pick(r, cfg.lh);
        const ct = chordTones(bar.chord);
        const root = CHORD_ROOT[bar.chord];
        const roots = [root, root - 7, root + 7].filter(inR);
        roots.sort((a, b) => Math.abs(a - prevRoot) - Math.abs(b - prevRoot));
        const rt = roots.length ? roots[0] : root;
        prevRoot = rt;
        // wide levels: bass an octave lower now and then (a leap to read)
        const lowRt = cfg.wide && inR(rt - 7) && r() < 0.55 ? rt - 7 : rt;
        const tonesInRange = []; for (let d = lhRange[0]; d <= lhRange[1]; d++) if (ct.includes(mod7(d))) tonesInRange.push(d);
        const other = tonesInRange.filter((d) => d !== rt && Math.abs(d - rt) <= 4);
        const fifthNear = other.includes(rt + 4) ? rt + 4 : other.includes(rt - 3) ? rt - 3 : (other[0] ?? rt);
        // triad above root that fits, for broken chords
        const triadRoot = [rt, rt - 7, rt + 7, rt - 14].filter((x) => x >= lhRange[0] && x + 4 <= lhRange[1]).sort((a, b) => Math.abs(a - rt) - Math.abs(b - rt))[0];
        // closed chord of n notes above the bass, moving as little as possible from the previous chord
        const chordAbove = (bass, n) => {
          const tones = []; for (let d = bass + 2; d <= lhRange[1]; d++) if (ct.includes(mod7(d))) tones.push(d);
          let best = null;
          for (let i = 0; i + n <= tones.length; i++) {
            const w = tones.slice(i, i + n);
            if (w[n - 1] - w[0] > 5 || w[0] - bass > 11) continue;
            const score = Math.abs(w[0] - (prevChordLow === null ? bass + 4 : prevChordLow));
            if (!best || score < best.s) best = { w, s: score };
          }
          if (best) prevChordLow = best.w[0];
          return best ? best.w : null;
        };
        let st = bar.kind === 'final' ? 'final' : style;
        const B = meter.bar;
        let ev;
        const T = triadRoot;
        if (st === 'oompah') {
          // chord above the root; if there is no room, use the root an octave lower
          let bass = null, ch = null;
          for (const b of [rt, rt - 7]) { if (!inR(b)) continue; ch = chordAbove(b, cfg.chordN || 2); if (ch) { bass = b; break; } }
          if (!ch) st = 'halves';
          else {
            const C = { chord: ch, stac: !!cfg.artic };
            const lowB = cfg.wide && inR(bass - 7) && r() < 0.55 ? bass - 7 : bass;
            const alt = cfg.wide && inR(bass - 3) ? bass - 3 : inR(bass + 4) && bass + 4 < ch[0] ? bass + 4 : inR(bass - 3) ? bass - 3 : bass;
            if (meterId === '4/4') ev = [[lowB, 4], [C, 4], [alt, 4], [C, 4]];
            else if (meterId === '3/4') ev = [[lowB, 4], [C, 4], [C, 4]];
            else if (meterId === '2/4') ev = [[lowB, 4], [C, 4]];
            else ev = [[lowB, 2], [C, 2], [C, 2], [alt, 2], [C, 2], [C, 2]];
          }
        }
        if (st === 'arp8') {
          // broken chord over more than an octave: root, 5th, octave, 10th
          // from the root if it fits (root–5th–octave–10th), otherwise an inversion starting on the 3rd or 5th
          const tones = []; for (let d = lhRange[0]; d <= lhRange[1]; d++) if (ct.includes(mod7(d))) tones.push(d);
          let u = null;
          for (const wantRoot of [true, false]) {
            const starts = tones.map((d, i) => i).filter((i) => i + 4 < tones.length && (mod7(tones[i]) === mod7(root)) === wantRoot);
            starts.sort((a, b) => Math.abs(tones[a] - lowRt) - Math.abs(tones[b] - lowRt));
            if (starts.length) { const i = starts[0]; u = [tones[i], tones[i + 2], tones[i + 3], tones[i + 4]]; break; }
          }
          if (!u) st = T === undefined ? 'halves' : 'quarters';
          else {
            const pat = meterId === '4/4' ? [0, 1, 2, 3, 2, 1, 2, 1] : meterId === '2/4' ? [0, 1, 2, 1] : [0, 1, 2, 3, 2, 1];
            ev = pat.map((i) => [u[i], 2]);
          }
        }
        if (st === 'arp16') {
          if (T === undefined) st = 'halves';
          else if (meter.compound) ev = [0, 4, 2, 4, 2, 4, 0, 4, 2, 4, 2, 4].map((x) => [T + x, 1]);
          else { ev = []; for (let b = 0; b < meter.beats; b++) [0, 4, 2, 4].forEach((x, i) => ev.push([T + (b % 2 && i === 0 && T + 7 <= lhRange[1] ? 7 : x), 1])); }
        }
        if ((st === 'quarters' || st === 'eighths') && T === undefined) st = 'halves';
        if (st === 'final') {
          // wide levels end on an octave in the bass
          ev = [[cfg.wide && inR(rt - 7) ? { chord: [rt - 7, rt] } : rt, B]];
        } else if (st === 'roots') ev = [[rt, B]];
        else if (st === 'halves') {
          if (meterId === '4/4') ev = [[rt, 8], [fifthNear, 8]];
          else if (meterId === '3/4') ev = [[rt, 8], [fifthNear, 4]];
          else if (meterId === '2/4') ev = [[rt, 4], [fifthNear, 4]];
          else ev = [[rt, 6], [fifthNear, 6]];
        } else if (st === 'quarters') {
          if (meterId === '4/4') ev = [[T, 4], [T + 4, 4], [T + 2, 4], [T + 4, 4]];
          else if (meterId === '3/4') ev = [[T, 4], [T + 2, 4], [T + 4, 4]];
          else if (meterId === '2/4') ev = [[T, 4], [T + 4, 4]];
          else ev = [[T, 4], [T + 4, 2], [T + 2, 4], [T + 4, 2]];
        } else if (st === 'eighths') { // Alberti
          const pat = [T, T + 4, T + 2, T + 4];
          const n = B / 2; ev = [];
          for (let i = 0; i < n; i++) ev.push([pat[i % 4], 2]);
          if (meter.compound) ev = [[T, 2], [T + 4, 2], [T + 2, 2], [T + 4, 2], [T + 2, 2], [T + 4, 2]];
        }
        styles.push(st);
        // group into cells by beat for beaming
        const cells = []; let cur = [], acc = 0;
        const grp = meter.beat;
        ev.forEach(([d, dur]) => {
          cur.push(typeof d === 'number' ? { deg: d, dur } : { chord: d.chord, stac: d.stac, dur });
          acc += dur;
          if (acc % grp === 0) { cells.push(cur); cur = []; }
        });
        if (cur.length) cells.push(cur);
        out.push(cells);
      });
      return { style: styles[0], styles, bars: out };
    }

    // --- build voices ---
    const mel = genMelody(melTonic, melRange);
    const voices = [];
    const fingerOf = (deg, hand, range) => hand === 'rh' ? deg - range[0] + 1 : 5 - (deg - range[0]);
    const dynamic = cfg.dyn ? pick(r, ['p', 'mp', 'mf', 'mf']) : null;

    function melodyToBars(notes, tonicDia, hand, range) {
      const out = bars.map(() => []);
      let ni = 0;
      bars.forEach((bar, bi) => {
        bar.cells.forEach((cell, ci) => {
          const c = [];
          cell.forEach(() => { const n = notes[ni++]; c.push(n.rest ? { rest: true, dur: n.dur } : { deg: n.deg, dur: n.dur, stac: bar._stac && n.dur <= 4 && n.off + n.dur < meter.bar, accent: bar._accent && n.off === 0 }); });
          out[bi].push(c);
        });
      });
      return out;
    }
    // staccato and accents (reading demands): one bar of staccato and/or one accented downbeat in some phrases
    if (cfg.artic) for (let p = 0; p < nPhr; p++) {
      const ph = bars.filter((b) => b.phrase === p);
      if (r() < 0.5 && ph[1] && ph[1].rests.size === 0) { ph[1]._stac = true; ph.forEach((b) => { b._noSlur = true; }); }
      if (r() < 0.4 && ph[2]) ph[2]._accent = true;
    }
    const melBars = melodyToBars(mel, melTonic, melodyHand, melRange);
    const melVoice = { id: melodyHand === 'rh' ? 'RH' : 'LH', clef: melodyHand === 'rh' ? 'treble' : 'bass', tonic: melTonic, bars: melBars, melody: true, range: melRange, hand: melodyHand };
    let accVoice = null, accStyle = null;
    const restBar = () => [[{ rest: true, dur: meter.bar }]];
    if (hands === 'both' && cfg.turns) {
      // level 1: the hands take turns, two bars each, never together; both around middle C (C position: an octave apart)
      const rhT = 28 + key.t, lhT = key.t === 0 ? 28 : rhT - 7, lhR = key.t === 0 ? [-4, 0] : [0, 4];
      const rhBars = melodyToBars(genMelody(rhT, [0, 4]), rhT, 'rh', [0, 4]);
      const lhBars = melodyToBars(genMelody(lhT, lhR), lhT, 'lh', lhR);
      const rhTurn = (bi) => bars[bi].idx < 2;
      voices.push({ id: 'RH', clef: 'treble', tonic: rhT, bars: bars.map((_, bi) => (rhTurn(bi) ? rhBars[bi] : restBar())), melody: true, range: [0, 4], hand: 'rh' });
      voices.push({ id: 'LH', clef: 'bass', tonic: lhT, bars: bars.map((_, bi) => (rhTurn(bi) ? restBar() : lhBars[bi])), melody: true, range: lhR, hand: 'lh' });
      accStyle = 'turns';
    } else if (hands === 'both') {
      const a = genAccomp();
      accStyle = a.styles.join(',');
      accVoice = { id: 'LH', clef: 'bass', tonic: lhTonic, bars: a.bars, melody: false, range: lhRange, hand: 'lh' };
      voices.push(melVoice, accVoice);
    } else voices.push(melVoice);

    // --- ABC rendering + playback events ---
    const events = [];
    const dynDone = {};
    function voiceToAbc(v, vi) {
      const barStrs = [];
      let first = true;
      let t0 = 0;
      v.bars.forEach((cells, bi) => {
        const bar = bars[bi];
        const accState = {};
        const cellStrs = [];
        let off = 0;
        const phraseHasRest = bars.some((b) => b.phrase === bar.phrase && b.rests.size > 0) && v.melody;
        const slurThis = cfg.slur && v.melody && !phraseHasRest && nBars >= 4;
        const notesInPhrase = []; // for slur end detection
        cells.forEach((cell, ci) => {
          let s = '';
          cell.forEach((n, ni) => {
            let tok = '';
            const durStr = n.dur === 1 ? '' : String(n.dur);
            if (n.rest) { tok = 'z' + durStr; if (n.dur === meter.bar) first = true; }
            else if (n.chord) {
              let inner = '';
              n.chord.forEach((dg) => {
                const p = pitch(v.tonic, dg, bar);
                const k = String(p.dia), cur = k in accState ? accState[k] : key.sig[mod7(p.dia)];
                if (p.alter !== cur) { inner += ACC_ABC[p.alter]; accState[k] = p.alter; }
                inner += abcLetter(p.dia);
                events.push({ voice: vi, start: bi * meter.bar + off, dur: n.stac ? n.dur * 0.5 : n.dur, midi: p.midi });
              });
              tok = (n.stac ? '.' : '') + '[' + inner + ']' + durStr;
              first = false;
            } else {
              const p = pitch(v.tonic, n.deg, bar);
              const keyAlt = key.sig[mod7(p.dia)];
              const k = String(p.dia);
              const cur = k in accState ? accState[k] : keyAlt;
              let acc = '';
              if (p.alter !== cur) { acc = ACC_ABC[p.alter]; accState[k] = p.alter; }
              let deco = '';
              if (first) {
                if (dynamic && v.melody && !dynDone[vi]) { deco += '!' + dynamic + '!'; dynDone[vi] = true; }
                if (cfg.five) deco += '!' + fingerOf(n.deg, v.hand, v.range) + '!';
                first = false;
              }
              if (n.accent) deco += '!accent!';
              tok = deco + (n.stac ? '.' : '') + acc + abcLetter(p.dia) + durStr;
              events.push({ voice: vi, start: bi * meter.bar + off, dur: n.stac ? n.dur * 0.5 : n.dur, midi: p.midi, vel: n.accent ? 1.25 : 1 });
            }
            n._tok = tok;
            s += tok;
            off += n.dur;
          });
          cellStrs.push(s);
        });
        barStrs.push(cellStrs.join(' '));
        if (slurThis) bar._slur = true;
      });
      // phrase slurs: wrap the first and last note of each phrase (melody only, no rests)
      if (v.melody && cfg.slur) {
        for (let p = 0; p < nPhr; p++) {
          const idxs = bars.map((b, i) => (b.phrase === p ? i : -1)).filter((i) => i >= 0);
          if (bars.some((b, i) => idxs.includes(i) && (b.rests.size > 0 || b._noSlur))) continue;
          const fb = idxs[0], lb = idxs[idxs.length - 1];
          barStrs[fb] = '(' + barStrs[fb];
          barStrs[lb] = barStrs[lb] + ')';
        }
      }
      return barStrs;
    }
    const voiceBars = voices.map((v, vi) => voiceToAbc(v, vi));

    let abc = 'X:1\nM:' + meterId + '\nL:1/16\n';
    if (voices.length === 2) abc += '%%score {RH | LH}\nV:RH clef=treble\nV:LH clef=bass\nK:' + key.abc + '\n';
    else abc += 'K:' + key.abc + (voices[0].clef === 'bass' ? ' clef=bass' : '') + '\n';
    for (let p = 0; p < nPhr; p++) {
      voices.forEach((v, vi) => {
        const seg = voiceBars[vi].slice(p * 4, p * 4 + 4);
        const end = p === nPhr - 1 ? ' |]' : ' |';
        abc += (voices.length === 2 ? '[V:' + v.id + '] ' : '') + seg.join(' | ') + end + '\n';
      });
    }

    // one ABC tune per system (4-bar phrase) so the page knows exactly where each line is
    const systems = [];
    for (let p = 0; p < nPhr; p++) {
      let s = 'X:1\nM:' + (p === 0 ? meterId : 'none') + '\nL:1/16\n%%stretchlast 1\n';
      if (voices.length === 2) s += '%%score {RH | LH}\nV:RH clef=treble\nV:LH clef=bass\nK:' + key.abc + '\n';
      else s += 'K:' + key.abc + (voices[0].clef === 'bass' ? ' clef=bass' : '') + '\n';
      voices.forEach((v, vi) => {
        const seg = voiceBars[vi].slice(p * 4, p * 4 + 4);
        s += (voices.length === 2 ? '[V:' + v.id + '] ' : '') + seg.join(' | ') + (p === nPhr - 1 ? ' |]' : ' |') + '\n';
      });
      systems.push({ abc: s, firstBar: p * 4, bars: 4 });
    }

    // onset positions (in sixteenths) of every note/rest in each bar, all voices — used to steer the moving line
    const barOnsets = bars.map((_, bi) => {
      const set = new Set();
      voices.forEach((v) => { let off = 0; v.bars[bi].forEach((cell) => cell.forEach((n) => { set.add(off); off += n.dur; })); });
      return [...set].sort((a, b) => a - b);
    });

    return {
      abc, systems, barOnsets, events,
      voiceOnsets: voices.map((v) => v.bars.map((cells) => { const o = []; let off = 0; cells.forEach((c) => c.forEach((n) => { o.push(off); off += n.dur; })); return o; })), key, meterId, level, bars: nBars, hands, bpm: cfg.bpm, accStyle,
      title: key.name + ' · ' + meterId,
      meter,
      _debug: { bars, voices, melTonic, lhTonic, melRange, lhRange },
    };
  }

  // =====================================================================
  //  THEORY
  // =====================================================================
  const PERFECT = [1, 4, 5, 8];
  const BASE_SEMIS = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 8: 12 };
  function qualOffset(num, q) {
    if (PERFECT.includes(num)) return { P: 0, A: 1, d: -1 }[q];
    return { M: 0, m: -1, A: 1, d: -2 }[q];
  }
  function intervalUp(note, num, q) {
    const dia = note.dia + num - 1;
    const target = midiOf(note.dia, note.alter) + BASE_SEMIS[num] + qualOffset(num, q);
    const alter = target - midiOf(dia, 0);
    return { dia, alter };
  }
  const abcNote = (n) => (n.alter ? ACC_ABC[n.alter] : '') + abcLetter(n.dia);
  const oddSpelling = (n) => { const L = mod7(n.dia); return (n.alter === 1 && (L === 2 || L === 6)) || (n.alter === -1 && (L === 0 || L === 3)); };
  const tonicOf = (s) => ({ letter: LETTERS.indexOf(s[0]), alter: s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0 });
  const VALID_MAJOR = new Set(Object.values(MAJOR_BY_N));
  const VALID_MINOR = new Set(Object.values(MINOR_BY_N));
  const tonicStr = (letter, alter) => LETTERS[letter] + (alter === 1 ? '#' : alter === -1 ? 'b' : '');

  // ---------- names in each language ----------
  // lang: 'en' | 'nb' (Norwegian, H-system: H, B, fiss, ess)
  function namer(lang) {
    lang = lang || 'en';
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    if (lang === 'en') {
      const NUM = { 1: 'Unison', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'Octave' };
      const Q = { M: 'Major', m: 'minor', P: 'Perfect', A: 'Augmented', d: 'diminished' };
      const TYPE = { major: 'major', 'natural minor': 'natural minor', 'harmonic minor': 'harmonic minor', 'melodic minor': 'melodic minor' };
      const note = (L, a) => LETTERS[L] + ACC_SYM[a];
      return {
        note, num: (n) => NUM[n],
        interval: (n, q) => (n === 8 && q === 'P' ? 'Perfect octave' : Q[q] + ' ' + NUM[n]),
        keyName: (L, a, minor) => note(L, a) + (minor ? ' minor' : ' major'),
        keyPair: (n) => { const M = tonicOf(MAJOR_BY_N[n]), m = tonicOf(MINOR_BY_N[n]); return note(M.letter, M.alter) + ' major / ' + note(m.letter, m.alter) + ' minor'; },
        triad: (root, qual, inv) => note(root.letter, root.alter) + ' ' + qual + ['', ', 1st inversion', ', 2nd inversion'][inv],
        scale: (L, a, type) => note(L, a) + ' ' + TYPE[type],
      };
    }
    // Norwegian (H-system)
    const NUM = { 1: 'prim', 2: 'sekund', 3: 'ters', 4: 'kvart', 5: 'kvint', 6: 'sekst', 7: 'septim', 8: 'oktav' };
    const Q = { M: 'stor', m: 'liten', P: 'ren', A: 'forstørret', d: 'forminsket' };
    const FLAT = ['Cess', 'Dess', 'Ess', 'Fess', 'Gess', 'Ass', 'B'];
    const FLAT2 = ['Cessess', 'Dessess', 'Essess', 'Fessess', 'Gessess', 'Assess', 'Bess'];
    const BASE_H = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
    const note = (L, a) => {
      if (a === 0) return BASE_H[L];
      if (a === 1) return BASE_H[L] + 'iss';
      if (a === 2) return BASE_H[L] + 'ississ';
      if (a === -1) return FLAT[L];
      return FLAT2[L];
    };
    const lower = (s) => s.toLowerCase();
    const dur = (L, a) => note(L, a) + '-dur';
    const moll = (L, a) => lower(note(L, a)) + '-moll';
    return {
      note, num: (n) => cap(NUM[n]),
      interval: (n, q) => cap(Q[q] + ' ' + NUM[n]),
      keyName: (L, a, minor) => (minor ? moll(L, a) : dur(L, a)),
      keyPair: (n) => { const M = tonicOf(MAJOR_BY_N[n]), m = tonicOf(MINOR_BY_N[n]); return dur(M.letter, M.alter) + ' / ' + moll(m.letter, m.alter); },
      triad: (root, qual, inv) => {
        const L = root.letter, a = root.alter;
        const base = qual === 'major' ? dur(L, a) : qual === 'minor' ? moll(L, a) : note(L, a) + (qual === 'diminished' ? ' forminsket' : ' forstørret');
        return base + ['', ', 1. omvending', ', 2. omvending'][inv];
      },
      scale: (L, a, type) => (type === 'major' ? dur(L, a) : moll(L, a) + { 'natural minor': ' (ren)', 'harmonic minor': ' (harmonisk)', 'melodic minor': ' (melodisk)' }[type]),
    };
  }

  const RANGES = {
    treble: { easy: [30, 38], wide: [26, 42], chordLo: [28, 34] },
    bass: { easy: [18, 26], wide: [14, 30], chordLo: [16, 22] },
  };
  const clefOf = (r, clef) => (clef === 'both' ? (r() < 0.5 ? 'treble' : 'bass') : clef);
  const itemAbc = (clef, body, key) => 'X:1\nM:none\nL:1/4\n' + 'K:' + (key || 'C') + ' clef=' + clef + '\n' + body + '\n';

  // opts.noteRange = { treble: [lo, hi], bass: [lo, hi] } (diatonic numbers, C4 = 28) overrides the difficulty range
  function qNote(r, diff, clef, N, opts) {
    const c = clefOf(r, clef);
    const custom = opts && opts.noteRange && opts.noteRange[c];
    let [lo, hi] = custom ? custom : diff === 'easy' ? RANGES[c].easy : RANGES[c].wide;
    if (lo > hi) [lo, hi] = [hi, lo];
    const dia = lo + Math.floor(r() * (hi - lo + 1));
    let alter = 0;
    if (diff === 'hard' && r() < 0.45) alter = r() < 0.5 ? 1 : -1;
    const n = { dia, alter };
    if (oddSpelling(n)) n.alter = 0;
    return { type: 'note', pk: 'note', clef: c, abc: itemAbc(c, abcNote(n) + '4'), answer: N.note(mod7(dia), n.alter), sig: c + dia + ':' + n.alter, meta: { dia, letter: mod7(dia), alter: n.alter, clef: c } };
  }

  function qInterval(r, diff, clef, N) {
    for (let tries = 0; tries < 200; tries++) {
      const c = clefOf(r, clef);
      const num = 2 + Math.floor(r() * 7);
      let qs;
      if (diff === 'easy') qs = null;
      else if (diff === 'medium') qs = PERFECT.includes(num) ? ['P'] : ['M', 'm'];
      else qs = num === 8 ? ['P'] : PERFECT.includes(num) ? ['P', 'P', 'A', 'd'] : ['M', 'm', 'M', 'm', 'A', 'd'];
      const [lo, hi] = diff === 'easy' ? [RANGES[c].easy[0], RANGES[c].easy[1] + 2] : RANGES[c].wide;
      const maxBottom = hi - (num - 1);
      if (maxBottom < lo) continue;
      const dia = lo + Math.floor(r() * (maxBottom - lo + 1));
      const bottom = { dia, alter: 0 };
      if (diff === 'medium' && r() < 0.2) bottom.alter = r() < 0.5 ? 1 : -1;
      if (diff === 'hard' && r() < 0.35) bottom.alter = r() < 0.5 ? 1 : -1;
      if (oddSpelling(bottom)) continue;
      let top, answer, qq = null;
      if (!qs) { top = { dia: dia + num - 1, alter: 0 }; answer = N.num(num); }
      else {
        qq = pick(r, qs);
        top = intervalUp(bottom, num, qq);
        answer = N.interval(num, qq);
      }
      if (Math.abs(top.alter) > 1 || oddSpelling(top)) continue;
      if (diff !== 'hard' && (top.alter !== 0 && bottom.alter !== 0 && top.alter !== bottom.alter)) continue;
      const harmonic = r() < 0.5;
      const body = harmonic ? '[' + abcNote(bottom) + abcNote(top) + ']4' : abcNote(bottom) + '4 ' + abcNote(top) + '4';
      return { type: 'interval', pk: 'interval', clef: c, abc: itemAbc(c, body), answer, sig: c + dia + num + (qq || ''), meta: { num, q: qq } };
    }
    return null;
  }

  function qKey(r, diff, clef, N) {
    const max = diff === 'easy' ? 2 : diff === 'medium' ? 4 : 7;
    const c = clefOf(r, clef);
    let n = Math.floor(r() * (2 * max + 1)) - max;
    if (n === 0 && r() < 0.7) n = r() < 0.5 ? 1 : -1;
    return { type: 'key', pk: 'key', clef: c, abc: itemAbc(c, 'x4', MAJOR_BY_N[n]), answer: N.keyPair(n), sig: 'k' + n, meta: { n } };
  }

  const TRIAD = { major: ['M', 'P'], minor: ['m', 'P'], diminished: ['m', 'd'], augmented: ['M', 'A'] };
  function qTriad(r, diff, clef, N) {
    for (let tries = 0; tries < 200; tries++) {
      const c = clefOf(r, clef);
      const quals = diff === 'easy' ? ['major', 'minor'] : ['major', 'minor', 'major', 'minor', 'diminished', 'augmented'];
      const qual = pick(r, quals);
      const [lo, hi] = RANGES[c].chordLo;
      const dia = lo + Math.floor(r() * (hi - lo + 1));
      const root = { dia, alter: 0 };
      if (diff !== 'easy' && r() < 0.3) root.alter = r() < 0.5 ? 1 : -1;
      if (oddSpelling(root)) continue;
      const third = intervalUp(root, 3, TRIAD[qual][0]);
      const fifth = intervalUp(root, 5, TRIAD[qual][1]);
      if ([third, fifth].some((n) => Math.abs(n.alter) > 1)) continue;
      if (diff === 'easy' && [third, fifth].some(oddSpelling)) continue;
      const inv = diff === 'hard' ? Math.floor(r() * 3) : 0;
      let notes = [root, third, fifth];
      if (inv === 1) notes = [third, fifth, { dia: root.dia + 7, alter: root.alter }];
      if (inv === 2) notes = [fifth, { dia: root.dia + 7, alter: root.alter }, { dia: third.dia + 7, alter: third.alter }];
      if (inv > 0 && notes[2].dia > hi + 9) continue;
      const nl = (x) => ({ letter: mod7(x.dia), alter: x.alter });
      return {
        type: 'triad', pk: diff === 'hard' ? 'triadPos' : 'triad', clef: c, abc: itemAbc(c, '[' + notes.map(abcNote).join('') + ']4'),
        answer: N.triad(nl(root), qual, inv), sig: c + dia + root.alter + qual + inv,
        meta: { root: nl(root), third: nl(third), fifth: nl(fifth), qual, inv },
      };
    }
    return null;
  }

  function qScale(r, diff, clef, N) {
    const c = clefOf(r, clef);
    const types = diff === 'easy' ? ['major'] : diff === 'medium' ? ['major', 'natural minor', 'harmonic minor'] : ['major', 'natural minor', 'harmonic minor', 'melodic minor'];
    const type = pick(r, types);
    const minor = type !== 'major';
    const max = diff === 'easy' ? 2 : diff === 'medium' ? (minor ? 3 : 4) : 6;
    const n = Math.floor(r() * (2 * max + 1)) - max;
    const tonicName = (minor ? MINOR_BY_N : MAJOR_BY_N)[n];
    const sig = keySig(n);
    const t = LETTERS.indexOf(tonicName[0]);
    const [lo] = RANGES[c].chordLo;
    let start = Math.floor(lo / 7) * 7 + t; if (start < lo) start += 7;
    const notes = [];
    for (let i = 0; i < 8; i++) {
      const dia = start + i;
      let alter = sig[mod7(dia)];
      if (i === 6 && (type === 'harmonic minor' || type === 'melodic minor')) alter += 1;
      if (i === 5 && type === 'melodic minor') alter += 1;
      notes.push({ dia, alter });
    }
    const T = tonicOf(tonicName);
    const name = N.scale(T.letter, T.alter, type);
    return {
      type: 'scale', wide: true, pk: 'scaleId', clef: c,
      abc: itemAbc(c, notes.map((x) => abcNote(x) + '4').join(' ')),
      answer: name, sig: tonicName + type,
      meta: { n, type, name, minor, tonic: T },
    };
  }

  // ---------- multiple-choice distractors (built from typical student mistakes) ----------
  function choicesFor(r, q, diff, N) {
    const m = q.meta, cand = [];
    const add = (name, w) => { if (name && name !== q.answer) cand.push([name, w]); };
    if (q.type === 'note') {
      [-1, 1].forEach((d) => add(N.note(mod7(m.dia + d), m.alter), 3));
      [-2, 2].forEach((d) => add(N.note(mod7(m.dia + d), m.alter), 2));
      add(N.note(m.clef === 'treble' ? mod7(m.dia + 2) : mod7(m.dia - 2), m.alter), 4); // read in the wrong clef
      if (m.alter !== 0) { add(N.note(m.letter, 0), 3); add(N.note(m.letter, -m.alter), 3); }
    } else if (q.type === 'interval') {
      if (!m.q) { [-1, 1, -2, 2, -3, 3].forEach((d) => { const nn = m.num + d; if (nn >= 2 && nn <= 8) add(N.num(nn), Math.abs(d) === 1 ? 3 : 1.5); }); }
      else {
        const hard = diff === 'hard';
        for (let nn = Math.max(2, m.num - 2); nn <= Math.min(8, m.num + 2); nn++) {
          const qs = nn === 8 ? ['P'] : PERFECT.includes(nn) ? (hard ? ['P', 'A', 'd'] : ['P']) : (hard ? ['M', 'm', 'A', 'd'] : ['M', 'm']);
          qs.forEach((qq) => add(N.interval(nn, qq), nn === m.num ? 3 : Math.abs(nn - m.num) === 1 ? 1.5 : 0.4));
        }
      }
    } else if (q.type === 'key') {
      [1, -1].forEach((d) => { if (Math.abs(m.n + d) <= 7) add(N.keyPair(m.n + d), 3); });
      [2, -2].forEach((d) => { if (Math.abs(m.n + d) <= 7) add(N.keyPair(m.n + d), 1.5); });
      if (m.n !== 0) add(N.keyPair(-m.n), 2.5);
    } else if (q.type === 'triad') {
      const quals = diff === 'easy' ? ['major', 'minor'] : ['major', 'minor', 'diminished', 'augmented'];
      quals.forEach((ql) => add(N.triad(m.root, ql, m.inv), 3));
      if (diff === 'hard') [0, 1, 2].forEach((i) => add(N.triad(m.root, m.qual, i), 3));
      if (m.inv === 1) add(N.triad(m.third, m.qual, 0), 3);          // named from the bass note
      if (m.inv === 2) add(N.triad(m.fifth, m.qual, 0), 3);
      ['major', 'minor'].forEach((ql) => add(N.triad(m.third, ql, m.inv), 1));
    } else if (q.type === 'scale') {
      // only scales whose key really exists (no G♭ minor, D♯ major …)
      const exists = (L, a, type) => (type === 'major' ? VALID_MAJOR : VALID_MINOR).has(tonicStr(L, a));
      const types = diff === 'easy' ? ['major', 'natural minor'] : diff === 'medium' ? ['major', 'natural minor', 'harmonic minor'] : ['major', 'natural minor', 'harmonic minor', 'melodic minor'];
      const T = m.tonic;
      types.forEach((t) => { if (exists(T.letter, T.alter, t)) add(N.scale(T.letter, T.alter, t), 3); });
      // relative major/minor starts on another note but shares the key signature
      const rel = tonicOf((m.minor ? MAJOR_BY_N : MINOR_BY_N)[m.n]);
      add(N.scale(rel.letter, rel.alter, m.minor ? 'major' : 'natural minor'), 2);
      if (m.minor && m.type !== 'natural minor') add(N.scale(rel.letter, rel.alter, 'major'), 1);
      [1, -1, 2, -2].forEach((d) => { if (Math.abs(m.n + d) <= 7) { const t2 = tonicOf((m.minor ? MINOR_BY_N : MAJOR_BY_N)[m.n + d]); add(N.scale(t2.letter, t2.alter, m.type), Math.abs(d) === 1 ? 1.5 : 0.7); } });
    }
    const seen = new Set([q.answer]); const pool = [];
    cand.forEach(([nm, w]) => { if (!seen.has(nm)) { seen.add(nm); pool.push([nm, w]); } });
    const out = [q.answer];
    while (out.length < 4 && pool.length) {
      const c = wpick(r, pool, (x) => x[1]);
      out.push(c[0]); pool.splice(pool.indexOf(c), 1);
    }
    return shuffle(r, out);
  }

  const GEN = { notes: qNote, intervals: qInterval, keys: qKey, triads: qTriad, scales: qScale };
  const THEORY_TYPES = { notes: {}, intervals: {}, keys: {}, triads: {}, scales: {}, mixed: {} };

  function theoryWorksheet(settings, seed) {
    const r = rng(seed);
    const N = namer(settings.lang);
    const { topic, difficulty, clef } = settings;
    const count = settings.count || 12;
    const items = [];
    const seen = new Set();
    let guard = 0;
    while (items.length < count && guard++ < 2000) {
      const fn = topic === 'mixed' ? pick(r, [qNote, qInterval, qKey, qTriad]) : GEN[topic];
      const q = fn(r, difficulty, clef, N, settings);
      if (!q) continue;
      if (seen.has(q.sig) && guard < 1500) continue;
      seen.add(q.sig);
      items.push(q);
    }
    return { items, topic, difficulty };
  }

  function quiz(settings, seed) {
    const r = rng(seed);
    const N = namer(settings.lang);
    const topics = settings.topics.length ? settings.topics : ['intervals'];
    const count = settings.count || 20;
    let seq = []; for (let i = 0; i < count; i++) seq.push(topics[i % topics.length]);
    seq = shuffle(r, seq);
    const items = [], seen = new Set();
    for (const topic of seq) {
      let q = null;
      for (let t = 0; t < 60; t++) { q = GEN[topic](r, settings.difficulty, settings.clef, N, settings); if (q && !seen.has(q.sig)) break; }
      if (!q) continue;
      seen.add(q.sig);
      q.topic = topic;
      q.choices = choicesFor(r, q, settings.difficulty, N);
      items.push(q);
    }
    return { items };
  }
  const api = { sightReading, theoryWorksheet, quiz, namer, LEVELS, METERS, SR_KEYS, THEORY_TYPES, rng, _internal: { intervalUp, midiOf, keySig, abcLetter, mod7, OK_SEMIS } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PV = api;
})(typeof window !== 'undefined' ? window : globalThis);
