/* ======================================================================
   TEXT CORE — pure functions (no Obsidian dependencies)
   ====================================================================== */

export const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:[-'’][\p{L}\p{M}\p{N}]+)*/gu;
export const LETTER_RE = /[\p{L}\p{M}\p{N}]/u;
export const HR_RE = /^\s{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
export const SCENE_RE = /^\s{0,3}(?:%%\w+%%)?\s*(?:([-*_])(?:[ \t]*\1){2,}|⁂|#|§|~{3,}|\*\s\*\s\*)[ \t]*$/;
export const HEADING_RE = /^(\s{0,3})(#{1,6})[ \t]+(.*)$/;
export const LIST_RE = /^(\s*)([-+*]|\d+[.)])[ \t]+(\[[ xX]\][ \t]+)?/;

export const STOP = {
  en: new Set(("the a an and or but if then so of to in on at by for with from as is was were be been being are am it its it's this that these those " +
    "i me my mine you your yours he him his she her hers we us our ours they them their theirs not no nor do did does done doing have has had having " +
    "there here what which who whom whose when where why how all any some can could would should will shall may might must just than too very into " +
    "out up down over under again about said one only i'm i'd i'll i've don't didn't doesn't can't couldn't wasn't weren't isn't aren't won't wouldn't " +
    "it'll that's there's what's he's she's let's you're we're they're you'll we'll they'll you've we've they've also more most such each own same other " +
    "both few through during before after above below off once because while until against between among himself herself itself myself yourself " +
    "themselves ourselves get got like back even still well way much many now").split(" ")),
  es: new Set(("el la los las lo un una unos unas y e o u ni pero sino si no de del a al en con por para sin sobre entre hasta desde hacia contra según tras " +
    "que qué quien quién quienes cual cuál cuales como cómo cuando cuándo donde dónde cuanto cuánto es era eran fue fueron ser sido siendo soy eres somos " +
    "son está estaba estaban estar estoy estás estamos están estuvo estado ha había habían han he has hemos haber hay habrá sería serían " +
    "yo me mi mis mí tú te tu tus ti él le les se su sus sí ella ellos ellas nos nosotros nosotras vosotros os usted ustedes nuestro nuestra nuestros nuestras " +
    "vuestro este esta esto estos estas ese esa eso esos esas aquel aquella aquello aquellos aquellas muy más menos ya también tampoco porque pues así " +
    "todo toda todos todas otro otra otros otras cada mismo misma mismos mismas sólo solo tan tanto tanta tantos algo nada dijo mientras aunque luego " +
    "entonces cuando ahí allí aquí bien mal sea fuera hacer hizo hace tener tenía tiene tienen poder podía puede pueden decir dice iba ir va").split(" ")),
};

export const ABBR = new Set(["mr", "mrs", "ms", "dr", "st", "sr", "sra", "srta", "dra", "lic", "ing", "prof", "vs", "etc", "e.g", "i.e", "p", "pp", "no", "núm", "ud", "uds", "av", "col", "jr"]);

export const ADVERB_EXC_EN = new Set(("only family early reply apply supply imply comply holy ugly july italy lily belly fly rely ally bully jelly silly lonely " +
  "friendly lovely daily likely assembly butterfly curly elderly jolly melancholy monopoly oily rally sly smelly wily chilly hilly ply anomaly emily " +
  "molly sally kelly billy polly holly dolly folly gully tally woolly homily costly deadly lively lowly manly orderly timely worldly ghostly cowardly " +
  "scholarly unlikely unruly burly surly bubbly cuddly prickly wrinkly sickly bodily hourly weekly monthly yearly nightly kindly").split(" "));
export const ADVERB_EXC_ES = new Set(["mente", "demente", "clemente", "simiente", "vehemente"]);

export const DEFAULT_CRUTCH = {
  en: "very, really, just, actually, suddenly, quite, somehow, seemed, started to, began to, rather, literally, basically, simply, a little, kind of, sort of",
  es: "muy, realmente, de repente, de pronto, simplemente, básicamente, solamente, empezó a, comenzó a, como que, un poco, algo, totalmente, en realidad, literalmente",
};

export function words(s) { return s.match(WORD_RE) || []; }

/* ---------- Markdown → prose map (keeps document offsets) ---------- */

export function proseMap(text) {
  const pieces = [];   // {k:'t'|'m', s, from, i?}  — covers the whole document, in order
  const paras = [];    // prose blocks: {kind, fromLine, toLine, plain, segs:[{p,d,n}]}
  let cur = null;

  const pushM = (s, from, ia) => {
    if (!s) return;
    const last = pieces[pieces.length - 1];
    if (last && last.k === "m" && last.from + last.s.length === from) {
      last.s += s; if (ia) last.i = (last.i || "") + ia; return;
    }
    const p = { k: "m", s, from }; if (ia) p.i = ia; pieces.push(p);
  };
  const pushT = (s, from) => {
    if (!s) return;
    const last = pieces[pieces.length - 1];
    if (last && last.k === "t" && last.from + last.s.length === from) last.s += s;
    else pieces.push({ k: "t", s, from });
    if (cur) {
      if (cur.gap && cur.plain.length) cur.plain += " ";
      cur.gap = false;
      const lastSeg = cur.segs[cur.segs.length - 1];
      if (lastSeg && lastSeg.d + lastSeg.n === from && lastSeg.p + lastSeg.n === cur.plain.length) lastSeg.n += s.length;
      else cur.segs.push({ p: cur.plain.length, d: from, n: s.length });
      cur.plain += s;
    }
  };
  const endPara = (line) => {
    if (cur && cur.plain.trim()) { cur.toLine = line; delete cur.gap; paras.push(cur); }
    cur = null;
  };
  const startPara = (kind, line) => {
    if (cur && cur.kind === kind) return;
    endPara(line);
    cur = { kind, fromLine: line, toLine: line, plain: "", segs: [], gap: false };
  };

  const st = { comment: false };
  const inline = (s, from) => {
    let i = 0, buf = "", bufFrom = from;
    const flush = () => { if (buf) pushT(buf, bufFrom); buf = ""; };
    const mark = (len, ia) => { flush(); pushM(s.substr(i, len), from + i, ia); i += len; bufFrom = from + i; };
    while (i < s.length) {
      const c = s[i], rest = s.slice(i);
      if (rest.startsWith("%%")) {
        const j = s.indexOf("%%", i + 2);
        if (j < 0) { mark(s.length - i); st.comment = true; break; }
        mark(j + 2 - i); continue;
      }
      if (rest.startsWith("![[")) { const j = s.indexOf("]]", i); mark(j < 0 ? s.length - i : j + 2 - i); continue; }
      if (rest.startsWith("![")) { const m = /^!\[[^\]]*\]\([^)]*\)/.exec(rest); if (m) { mark(m[0].length); continue; } }
      if (rest.startsWith("[[")) {
        const j = s.indexOf("]]", i);
        if (j > 0) {
          const inner = s.slice(i + 2, j), bar = inner.indexOf("|");
          if (bar >= 0) { mark(2 + bar + 1); flush(); pushT(inner.slice(bar + 1), from + i); i += inner.length - bar - 1; bufFrom = from + i; mark(2); }
          else { const hash = inner.indexOf("#"); mark(2); const shown = hash >= 0 ? inner.slice(0, hash) : inner; pushT(shown, from + i); i += shown.length; bufFrom = from + i; if (hash >= 0) mark(inner.length - hash); mark(2); }
          continue;
        }
      }
      if (rest.startsWith("[^")) { const j = s.indexOf("]", i); if (j > 0) { mark(j + 1 - i); continue; } }
      if (c === "[") {
        const m = /^\[([^\]]*)\]\(([^)]*)\)/.exec(rest);
        if (m) { mark(1); pushT(m[1], from + i); i += m[1].length; bufFrom = from + i; mark(2 + m[2].length + 1); continue; }
      }
      if (c === "`") { const j = s.indexOf("`", i + 1); if (j > 0) { mark(j + 1 - i); continue; } }
      if (c === "<" && /^<\/?[a-zA-Z][^>]*>/.test(rest)) { mark(/^<\/?[a-zA-Z][^>]*>/.exec(rest)[0].length); continue; }
      if (c === "\\" && i + 1 < s.length && /[!-/:-@[-`{-~]/.test(s[i + 1])) { mark(1); buf += s[i]; i++; continue; }
      if (/^(\*\*|__|~~|==)/.test(rest)) { mark(2); continue; }
      if (c === "*") { mark(1); continue; }
      if (c === "_") {
        const pv = i > 0 ? s[i - 1] : " ", nx = i + 1 < s.length ? s[i + 1] : " ";
        if (!(LETTER_RE.test(pv) && LETTER_RE.test(nx))) { mark(1); continue; }
      }
      if (/^https?:\/\/\S+/.test(rest) && (i === 0 || /\s/.test(s[i - 1]))) { mark(/^https?:\/\/\S+/.exec(rest)[0].length); continue; }
      const bid = /^\s\^[\w-]+\s*$/.exec(rest);
      if (bid) { mark(bid[0].length); continue; }
      if (!buf) bufFrom = from + i;
      buf += c; i++;
    }
    flush();
  };

  const lines = text.split("\n");
  let off = 0, front = lines[0] === "---", fence = false, callout = false;
  for (let n = 0; n < lines.length; n++) {
    const L = lines[n], from = off;
    if (front) {
      pushM(L, from);
      if (n > 0 && /^(---|\.\.\.)\s*$/.test(L)) front = false;
    } else if (st.comment) {
      const j = L.indexOf("%%");
      if (j < 0) pushM(L, from);
      else { pushM(L.slice(0, j + 2), from); st.comment = false; if (L.slice(j + 2).trim()) { startPara("para", n); inline(L.slice(j + 2), from + j + 2); } }
    } else if (fence) {
      pushM(L, from); if (/^\s*(```|~~~)/.test(L)) fence = false;
    } else if (/^\s*(```|~~~)/.test(L)) {
      endPara(n); fence = true; pushM(L, from);
    } else if (L.trim() === "") {
      endPara(n); callout = false; pushM(L, from);
    } else if (callout && /^\s*>/.test(L)) {
      pushM(L, from);
    } else if (/^\s*>\s*\[!/.test(L)) {
      endPara(n); callout = true; pushM(L, from);
    } else if (HR_RE.test(L) || SCENE_RE.test(L)) {
      endPara(n); pushM(L, from);
    } else if (/^\s*\|/.test(L) || /^\s*\$\$/.test(L)) {
      endPara(n); pushM(L, from);
    } else {
      callout = false;
      let m;
      if ((m = HEADING_RE.exec(L))) {
        endPara(n); startPara("heading", n);
        const pre = m[1].length + m[2].length + (L.length - m[1].length - m[2].length - m[3].length);
        pushM(L.slice(0, pre), from); inline(L.slice(pre), from + pre); endPara(n + 1);
      } else if ((m = /^(\s*>+\s?)/.exec(L))) {
        startPara("quote", n); pushM(m[1], from); inline(L.slice(m[1].length), from + m[1].length);
      } else if ((m = LIST_RE.exec(L))) {
        endPara(n); startPara("list", n); pushM(m[0], from); inline(L.slice(m[0].length), from + m[0].length);
      } else {
        startPara("para", n); inline(L, from);
      }
      if (cur) cur.gap = true;
    }
    off += L.length;
    if (n < lines.length - 1) { pushM("\n", off, "\n"); off += 1; }
  }
  endPara(lines.length);
  return { pieces, paras };
}

export function plainToDoc(para, p) {
  const segs = para.segs;
  for (let k = 0; k < segs.length; k++) {
    const g = segs[k], nx = segs[k + 1];
    if (p < g.p) return g.d;
    if (p < g.p + g.n) return g.d + (p - g.p);
    if (p === g.p + g.n && (!nx || nx.p > p)) return g.d + g.n;
  }
  const g = segs[segs.length - 1];
  return g ? g.d + g.n : 0;
}

/* ---------- language ---------- */

export function detectLang(sample) {
  let en = 0, es = 0;
  for (const w of words(sample.slice(0, 20000).toLowerCase())) {
    if (STOP.en.has(w)) en++;
    if (STOP.es.has(w)) es++;
  }
  if (/[ñáéíóú¿¡]/i.test(sample)) es += 3;
  return es > en ? "es" : "en";
}
export function baseLang(code) { return String(code || "").toLowerCase().startsWith("es") ? "es" : "en"; }

/* ---------- syllables / readability ---------- */

export function syllablesEn(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
export function syllablesEs(w) {
  w = w.toLowerCase().replace(/qu(?=[eiéí])/g, "q").replace(/gu(?=[eiéí])/g, "g").replace(/y$/, "i").replace(/[^a-záéíóúüñ]/g, "");
  if (!w) return 0;
  const V = "aeiouáéíóúü", STRONG = "aeoáéóíú";
  let n = 0, prev = null;
  for (const ch of w) {
    if (!V.includes(ch)) { prev = null; continue; }
    if (prev === null) n++;
    else if (STRONG.includes(prev) && STRONG.includes(ch)) n++;
    prev = ch;
  }
  return Math.max(1, n);
}
export function readability(lang, nWords, nSent, nSyl) {
  if (!nWords || !nSent) return null;
  const wps = nWords / nSent, spw = nSyl / nWords;
  if (lang === "es") {
    const v = 206.835 - 62.3 * spw - wps;  // Szigriszt-Pazos / INFLESZ
    const label = v < 40 ? "Very difficult" : v < 55 ? "Somewhat difficult" : v < 65 ? "Normal" : v < 80 ? "Fairly easy" : "Very easy";
    return { name: "INFLESZ", score: v, label };
  }
  const v = 206.835 - 1.015 * wps - 84.6 * spw;  // Flesch Reading Ease
  const grade = 0.39 * wps + 11.8 * spw - 15.59;
  const label = v >= 90 ? "Very easy" : v >= 80 ? "Easy" : v >= 70 ? "Fairly easy" : v >= 60 ? "Standard" : v >= 50 ? "Fairly difficult" : v >= 30 ? "Difficult" : "Very difficult";
  return { name: "Flesch", score: v, label, grade };
}

/* ---------- sentences & dialogue ---------- */

export function splitSentences(s) {
  const out = [];
  const re = /(?:[.!?]+|…|\.\.\.)+[”"’'»)\]]*(?=\s|$)/g;
  let start = 0, m;
  while ((m = re.exec(s))) {
    const end = m.index + m[0].length;
    const before = s.slice(start, m.index);
    const lastWord = ((before.match(/(\S+)$/) || ["", ""])[1]).toLowerCase().replace(/^[¿¡"“«(—–-]+/, "");
    if (/^\.$/.test(m[0]) && (ABBR.has(lastWord) || /^\p{L}$/u.test(lastWord))) continue;
    const after = s.slice(end).replace(/^\s+/, "");
    const nx = after.replace(/^[—–\-"“”«»'’(]+/, "");
    if (nx && /^\p{Ll}/u.test(nx)) continue;  // "…pensé… que", "“Really?” she asked", "—¿Vienes? —preguntó"
    out.push([start, end]);
    start = end; while (start < s.length && /\s/.test(s[start])) start++;
  }
  if (start < s.length && s.slice(start).trim()) out.push([start, s.length]);
  return out.filter(([a, b]) => words(s.slice(a, b)).length > 0);
}

export function dialogueRanges(s) {
  const t = s.replace(/^\s+/, ""), lead = s.length - t.length, out = [];
  if (/^[—–]/.test(t) || /^-(?=\S)/.test(t)) {
    let on = true, start = lead + 1;
    for (let i = lead + 1; i < s.length; i++) {
      if (s[i] === "—" || s[i] === "–") {
        if (on) out.push([start, i]); else start = i + 1;
        on = !on;
      }
    }
    if (on) out.push([start, s.length]);
    return out;
  }
  let open = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "“" || c === "«") { if (open < 0) open = i; }
    else if (c === "”" || c === "»") { if (open >= 0) { out.push([open, i]); open = -1; } }
    else if (c === '"') { if (open < 0) open = i; else { out.push([open, i]); open = -1; } }
  }
  return out;
}

export function mattr(list, win) {
  if (!list.length) return 0;
  if (list.length <= win) return new Set(list).size / list.length;
  const cnt = new Map(); let uniq = 0, sum = 0, n = 0;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    const c = (cnt.get(w) || 0) + 1; cnt.set(w, c); if (c === 1) uniq++;
    if (i >= win) { const o = list[i - win]; const oc = cnt.get(o) - 1; cnt.set(o, oc); if (oc === 0) uniq--; }
    if (i >= win - 1) { sum += uniq / win; n++; }
  }
  return sum / n;
}

/* ---------- full analysis ---------- */

export function parseCrutch(str) {
  return String(str || "").split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
}

export function analyze(text, opts) {
  opts = opts || {};
  const { paras } = proseMap(text);
  const prose = paras.filter((p) => p.kind !== "heading");
  const sample = prose.map((p) => p.plain).join("\n");
  const lang = opts.lang && opts.lang !== "auto" ? baseLang(opts.lang) : detectLang(sample);
  const stop = STOP[lang];
  const sylF = lang === "es" ? syllablesEs : syllablesEn;

  const W = [];        // {w, lw, para, a, b}
  const S = [];        // {para, a, b, n, opener}
  let chars = 0, charsNoSp = 0, syl = 0, dlgWords = 0;
  prose.forEach((p, pi) => {
    p.words = 0;
    chars += p.plain.length; charsNoSp += p.plain.replace(/\s/g, "").length;
    const dr = dialogueRanges(p.plain);
    let m; WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(p.plain))) {
      const w = m[0], a = m.index;
      W.push({ w, lw: w.toLowerCase(), para: pi, a, b: a + w.length });
      p.words++; syl += sylF(w);
      if (dr.some(([x, y]) => a >= x && a < y)) dlgWords++;
    }
    for (const [a, b] of splitSentences(p.plain)) {
      const ws = words(p.plain.slice(a, b));
      S.push({ para: pi, a, b, n: ws.length, opener: (ws[0] || "").toLowerCase() });
    }
  });

  const nW = W.length, nS = S.length;
  const lens = S.map((s) => s.n);
  const avgS = nS ? nW / nS : 0;
  const sd = nS ? Math.sqrt(lens.reduce((t, x) => t + (x - avgS) ** 2, 0) / nS) : 0;
  // proper nouns: words that are capitalised (almost) every time they appear mid-sentence
  const capStat = new Map();
  for (const x of W) {
    const p = prose[x.para].plain;
    const pre = p.slice(Math.max(0, x.a - 8), x.a);
    const initial = /^[\s—–\-"“«¿¡(']*$/.test(p.slice(0, x.a)) || /[.!?…:]["”’»)]*\s+[—–\-"“«¿¡(']*$/.test(pre);
    if (initial) continue;
    const c = capStat.get(x.lw) || { cap: 0, n: 0, shown: x.w };
    c.n++; if (/^\p{Lu}/u.test(x.w)) { c.cap++; c.shown = x.w; }
    capStat.set(x.lw, c);
  }
  const proper = new Set([...capStat.entries()].filter(([w, c]) => c.cap >= 1 && c.cap / c.n >= 0.8 && !stop.has(w)).map(([w]) => w));
  const nameCount = new Map();
  for (const x of W) if (proper.has(x.lw)) nameCount.set(x.lw, (nameCount.get(x.lw) || 0) + 1);
  const names = [...nameCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w, n]) => ({ word: w, shown: capStat.get(w).shown, count: n }));
  const content = W.filter((x) => !stop.has(x.lw) && x.lw.length >= 3 && !/^\d+$/.test(x.lw) && !proper.has(x.lw));

  // frequency
  const freq = new Map();
  for (const x of content) freq.set(x.lw, (freq.get(x.lw) || 0) + 1);
  const top = [...freq.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 15);

  // echoes: the same content word again within N words
  const win = opts.echoWindow || 40;
  const lastAt = new Map(), echoes = new Map();
  W.forEach((x, idx) => {
    if (stop.has(x.lw) || x.lw.length < 4 || /^\d+$/.test(x.lw) || proper.has(x.lw)) return;
    const prev = lastAt.get(x.lw);
    if (prev !== undefined && idx - prev <= win) {
      const e = echoes.get(x.lw) || { word: x.lw, count: 0, idx: new Set() };
      e.count++; e.idx.add(prev); e.idx.add(idx); echoes.set(x.lw, e);
    }
    lastAt.set(x.lw, idx);
  });
  const echoList = [...echoes.values()].sort((a, b) => b.count - a.count).slice(0, 12)
    .map((e) => ({ word: e.word, count: e.count, idx: [...e.idx].sort((a, b) => a - b) }));

  // adverbs
  const adv = new Map();
  W.forEach((x, idx) => {
    const isAdv = lang === "es" ? (/mente$/.test(x.lw) && x.lw.length > 6 && !ADVERB_EXC_ES.has(x.lw))
      : (/ly$/.test(x.lw) && x.lw.length > 4 && !ADVERB_EXC_EN.has(x.lw));
    if (isAdv) { const e = adv.get(x.lw) || { word: x.lw, idx: [] }; e.idx.push(idx); adv.set(x.lw, e); }
  });
  const advList = [...adv.values()].sort((a, b) => b.idx.length - a.idx.length);
  const advCount = advList.reduce((t, e) => t + e.idx.length, 0);

  // crutch words / phrases
  const crutch = [];
  for (const ph of parseCrutch((opts.crutch || DEFAULT_CRUTCH)[lang])) {
    const re = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "giu");
    const hits = [];
    prose.forEach((p, pi) => {
      let m; re.lastIndex = 0;
      while ((m = re.exec(p.plain))) {
        const a = m.index, b = a + m[0].length;
        if ((a > 0 && LETTER_RE.test(p.plain[a - 1])) || (b < p.plain.length && LETTER_RE.test(p.plain[b]))) continue;
        hits.push({ para: pi, a, b });
      }
    });
    if (hits.length) crutch.push({ word: ph, hits });
  }
  crutch.sort((a, b) => b.hits.length - a.hits.length);

  // long sentences
  const longT = opts.longSentence || 35;
  const longS = S.filter((s) => s.n > longT).sort((a, b) => b.n - a.n);

  // repeated sentence openers (3+ in a row)
  const openers = [];
  for (let i = 0; i < S.length;) {
    let j = i + 1;
    while (j < S.length && S[j].opener && S[j].opener === S[i].opener) j++;
    if (j - i >= 3 && S[i].opener) openers.push({ word: S[i].opener, sents: S.slice(i, j) });
    i = j;
  }

  // paragraphs
  const paraWords = prose.map((p, i) => ({ i, n: p.words })).filter((x) => x.n > 0);
  const longestParas = [...paraWords].sort((a, b) => b.n - a.n).slice(0, 3);

  const r = readability(lang, nW, nS, syl);
  return {
    lang, paras: prose, allParas: paras, W, S,
    words: nW, chars, charsNoSp, paragraphs: paraWords.length, sentences: nS,
    avgSentence: avgS, sentenceSD: sd, lens, avgPara: paraWords.length ? nW / paraWords.length : 0,
    syllables: syl, readability: r, dialogue: nW ? dlgWords / nW : 0,
    variety: mattr(W.map((x) => x.lw), 100),
    top, echoes: echoList, adverbs: advList, adverbCount: advCount, crutch, longSentences: longS, longThreshold: longT,
    openers, longestParas, names,
  };
}

export function lengthCategory(n) {
  if (n < 1000) return "Flash fiction";
  if (n < 7500) return "Short story";
  if (n < 17500) return "Novelette";
  if (n < 40000) return "Novella";
  return "Novel";
}

/* ---------- outline (headings + scene breaks) and reordering ---------- */

export function bodyStart(lines) {
  if (lines[0] !== "---") return 0;
  for (let i = 1; i < lines.length; i++) if (/^(---|\.\.\.)\s*$/.test(lines[i])) return i + 1;
  return 0;
}

export function plainTitle(s) {
  return s.replace(/%%[^%]*%%/g, "").replace(/!\[\[[^\]]*\]\]/g, "").replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_~=`]/g, "").replace(/\s+/g, " ").trim();
}

export function buildOutline(text) {
  const lines = text.split("\n");
  const start = bodyStart(lines);
  const heads = [], breaks = [];
  let fence = false, comment = false;
  for (let i = start; i < lines.length; i++) {
    const L = lines[i];
    const cnt = (L.match(/%%/g) || []).length;
    if (comment) { if (cnt % 2 === 1) comment = false; continue; }
    if (/^\s*(```|~~~)/.test(L)) { fence = !fence; continue; }
    if (fence) continue;
    if (cnt % 2 === 1) { comment = true; continue; }
    if (/^\s*>/.test(L)) continue;
    const h = HEADING_RE.exec(L);
    if (h) { heads.push({ line: i, level: h[2].length, title: plainTitle(h[3]) || "(untitled)" }); continue; }
    if (SCENE_RE.test(L) && (i === start || lines[i - 1].trim() === "")) breaks.push(i);
  }
  const root = { id: "", level: 0, start, contentStart: start, end: lines.length, children: [], scenes: [], title: "" };
  const stack = [root];
  for (const h of heads) {
    while (stack[stack.length - 1].level >= h.level) stack.pop();
    const parent = stack[stack.length - 1];
    const node = { id: parent.id + "/h" + parent.children.length, level: h.level, title: h.title, start: h.line, contentStart: h.line + 1, end: lines.length, children: [], scenes: [], parent };
    parent.children.push(node); stack.push(node);
  }
  const all = [];
  (function walk(n) { all.push(n); n.children.forEach(walk); })(root);
  // end of a heading node = next heading at same or higher level
  for (const n of all) {
    if (n === root) continue;
    const nxt = heads.find((h) => h.line > n.start && h.level <= n.level);
    n.end = nxt ? nxt.line : lines.length;
  }
  const nonBlank = (a, b) => { for (let i = a; i < b; i++) if (lines[i].trim()) return true; return false; };
  for (const n of all) {
    const ownEnd = n.children.length ? n.children[0].start : n.end;
    const bs = breaks.filter((b) => b >= n.contentStart && b < ownEnd);
    if (!bs.length) continue;
    const segs = [];
    let a = n.contentStart;
    for (const b of bs) { segs.push({ start: a, end: b, hasBreak: a !== n.contentStart }); a = b; }
    segs.push({ start: a, end: ownEnd, hasBreak: true });
    let k = 0;
    for (const s of segs) {
      const from = s.hasBreak ? s.start + 1 : s.start;
      if (!nonBlank(from, s.end)) { s.empty = true; continue; }
      let first = from; while (first < s.end && !lines[first].trim()) first++;
      s.title = plainTitle(lines[first]).split(/\s+/).slice(0, 7).join(" ") + "…";
      s.id = n.id + "/s" + k++; s.parent = n;
      n.scenes.push(s);
    }
    n.sceneSep = lines[bs[0]].trim();
    n.leadingEmpty = segs[0].empty;
  }
  return { lines, root, all };
}

export function trimBlank(arr) {
  let a = 0, b = arr.length;
  while (a < b && !arr[a].trim()) a++;
  while (b > a && !arr[b - 1].trim()) b--;
  return arr.slice(a, b);
}

/** Returns {fromLine, toLine (inclusive), text} replacing that region, or null. kind: 'h' | 's' */
export function reorder(outline, parentId, kind, fromIdx, toIdx) {
  const parent = outline.all.find((n) => n.id === parentId);
  if (!parent) return null;
  const L = outline.lines;
  const items = kind === "h" ? parent.children : parent.scenes;
  if (fromIdx < 0 || fromIdx >= items.length || toIdx < 0 || toIdx >= items.length || fromIdx === toIdx) return null;
  const order = items.map((_, i) => i);
  const [mv] = order.splice(fromIdx, 1); order.splice(toIdx, 0, mv);
  let chunks, regionStart, regionEnd;
  if (kind === "h") {
    chunks = items.map((n) => trimBlank(L.slice(n.start, n.end)).join("\n"));
    regionStart = items[0].start; regionEnd = items[items.length - 1].end;
    const text = order.map((i) => chunks[i]).join("\n\n");
    while (regionEnd > regionStart && !L[regionEnd - 1].trim()) regionEnd--;
    return { fromLine: regionStart, toLine: regionEnd - 1, text };
  }
  chunks = items.map((s) => trimBlank(L.slice(s.hasBreak ? s.start + 1 : s.start, s.end)).join("\n"));
  const sep = "\n\n" + parent.sceneSep + "\n\n";
  regionStart = items[0].hasBreak ? items[0].start : items[0].start;
  while (!items[0].hasBreak && regionStart < items[0].end && !L[regionStart].trim()) regionStart++;
  regionEnd = items[items.length - 1].end;
  while (regionEnd > regionStart && !L[regionEnd - 1].trim()) regionEnd--;
  let text = order.map((i) => chunks[i]).join(sep);
  if (parent.leadingEmpty) text = parent.sceneSep + "\n\n" + text;
  return { fromLine: regionStart, toLine: regionEnd - 1, text };
}

/* ---------- LanguageTool request building ---------- */

export function utf8len(s) { let n = 0; for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; }

/** Cut the piece list to [from,to) and split into annotation chunks of at most maxBytes. */
export function ltChunks(pieces, from, to, maxBytes) {
  const sel = [];
  for (const p of pieces) {
    const a = p.from, b = p.from + p.s.length;
    if (b <= from || a >= to) continue;
    const s = p.s.slice(Math.max(0, from - a), Math.min(p.s.length, to - a));
    const q = { k: p.k, s, from: Math.max(a, from) };
    if (p.i) q.i = p.s === s ? p.i : (s.includes("\n") ? "\n" : "");
    sel.push(q);
  }
  const chunks = [];
  let cur = [], bytes = 0;
  const close = () => { if (cur.some((x) => x.k === "t" && x.s.trim())) chunks.push(cur); cur = []; bytes = 0; };
  for (const p of sel) {
    const b = utf8len(p.s);
    if (bytes + b > maxBytes && cur.length) {
      // split at the last paragraph break inside the current chunk
      let cut = -1;
      for (let i = cur.length - 1; i > 0; i--) if (cur[i].k === "m" && /\n\s*\n|\n$/.test(cur[i].s)) { cut = i + 1; break; }
      if (cut > 0 && cut < cur.length) {
        const keep = cur.slice(cut); cur = cur.slice(0, cut); close();
        cur = keep; bytes = keep.reduce((t, x) => t + utf8len(x.s), 0);
      } else close();
    }
    if (b > maxBytes && p.k === "t") {
      // a single giant paragraph: split at sentence ends
      let s = p.s, f = p.from;
      while (utf8len(s) > maxBytes) {
        let cut = Math.floor(maxBytes / 2);
        const m = s.slice(0, cut).match(/[\s\S]*[.!?…]\s/);
        if (m) cut = m[0].length;
        cur.push({ k: "t", s: s.slice(0, cut), from: f }); close();
        s = s.slice(cut); f += cut;
      }
      cur.push({ k: "t", s, from: f }); bytes += utf8len(s);
      continue;
    }
    cur.push(p); bytes += b;
  }
  close();
  return chunks.map((c) => ({
    base: c[0].from,
    text: c.map((x) => x.s).join(""),
    bytes: c.reduce((t, x) => t + utf8len(x.s), 0),
    annotation: c.map((x) => (x.k === "t" ? { text: x.s } : x.i ? { markup: x.s, interpretAs: x.i } : { markup: x.s })),
  }));
}

export function issueKind(m) {
  const t = (m.rule && m.rule.issueType) || "";
  const cat = (m.rule && m.rule.category && m.rule.category.id) || "";
  if (t === "misspelling" || cat === "TYPOS") return "spelling";
  if (t === "grammar" || cat === "GRAMMAR") return "grammar";
  if (t === "typographical" || t === "whitespace" || cat === "PUNCTUATION" || cat === "TYPOGRAPHY" || cat === "CASING") return "punctuation";
  return "style";
}

/** Map LanguageTool matches back to document offsets; verifies the text and relocates if it drifted. */
export function chunkPlainToDoc(chunk, off) {
  // LanguageTool's internal plain text = text pieces + interpretAs of markup
  let p = 0, d = chunk.base;
  for (const a of chunk.annotation) {
    if (a.text !== undefined) {
      if (off <= p + a.text.length) return d + (off - p);
      p += a.text.length; d += a.text.length;
    } else {
      const ia = a.interpretAs || "";
      if (off < p + ia.length) return d;
      p += ia.length; d += a.markup.length;
    }
  }
  return d;
}

/** Map LanguageTool matches back to document offsets; verifies the text and relocates if it drifted. */
export function mapMatches(json, chunk, docText) {
  const out = [];
  for (const m of (json && json.matches) || []) {
    const ctx = m.context;
    const expected = ctx && typeof ctx.text === "string" ? ctx.text.substr(ctx.offset, ctx.length) : chunk.text.substr(m.offset, m.length);
    const len = expected.length;
    if (!len) continue;
    const cands = [chunk.base + m.offset, chunkPlainToDoc(chunk, m.offset)];
    let from = -1;
    for (const c of cands) if (docText.substr(c, len) === expected) { from = c; break; }
    for (let dd = 1; dd < 400 && from < 0; dd++) {
      for (const c of cands) {
        if (docText.substr(c - dd, len) === expected) { from = c - dd; break; }
        if (docText.substr(c + dd, len) === expected) { from = c + dd; break; }
      }
    }
    if (from < 0) continue;
    out.push({
      from, to: from + len, text: expected, message: m.message || "", short: m.shortMessage || "",
      replacements: (m.replacements || []).slice(0, 6).map((r) => r.value),
      kind: issueKind(m), rule: (m.rule && m.rule.id) || "", ruleName: (m.rule && m.rule.description) || "",
      sentence: m.sentence || "",
    });
  }
  return out;
}
