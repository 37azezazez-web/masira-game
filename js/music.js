/*
 * موسيقى خلفية بطابع سعودي/خليجي، مولّدة بالكود (Web Audio).
 * ما فيها أي ملف صوتي، فما فيه حقوق موسيقى ولا حجم إضافي للتطبيق.
 * - مقام بياتي على «ري» بربع التون الحقيقي (المي نص بيمول).
 * - عود: نغمة منقورة بطريقة Karplus-Strong.
 * - إيقاع ٦/٨ خليجي: طبل (دم/تك) وتصفيق ورق (دف بصنوج).
 */
(function (root) {
  "use strict";
  const BPM = 96; // بالنوار المنقوط
  const STEP = 60 / BPM / 6; // كل مازورة ١٢ خطوة (٦/٨ مقسومة)
  const BAR = 12;
  // مقام بياتي على ري: ري، مي نص بيمول، فا، صول، لا، سي بيمول، دو، ري
  const D = 62, Eh = 63.5, F = 65, G = 67, A = 69, Bb = 70, C = 72, D2 = 74;
  // [الخطوة، النغمة، الطول بالخطوات] لكل مازورة، ٨ مازورات
  const MELODY = [
    [[0, A, 2], [2, Bb, 1], [3, A, 1], [4, G, 2], [6, F, 2], [8, G, 2], [10, A, 2]],
    [[0, G, 3], [3, F, 1], [4, Eh, 2], [6, D, 4], [10, F, 1], [11, Eh, 1]],
    [[0, D, 2], [2, F, 2], [4, G, 2], [6, A, 2], [8, C, 2], [10, Bb, 1], [11, A, 1]],
    [[0, G, 2], [2, A, 1], [3, G, 1], [4, F, 2], [6, Eh, 2], [8, D, 4]],
    [[0, D2, 2], [2, C, 1], [3, Bb, 1], [4, A, 2], [6, Bb, 1], [7, A, 1], [8, G, 2], [10, A, 2]],
    [[0, Bb, 2], [2, A, 1], [3, G, 1], [4, F, 2], [6, G, 3], [9, A, 3]],
    [[0, A, 1], [1, Bb, 1], [2, A, 1], [3, G, 1], [4, F, 2], [6, Eh, 1], [7, F, 1], [8, G, 2], [10, F, 1], [11, Eh, 1]],
    [[0, D, 3], [3, Eh, 1], [4, F, 1], [5, Eh, 1], [6, D, 6]],
  ];
  // الإيقاع: د = دم (طبل غليظ)، ت = تك، ص = تصفيق
  const DUM = [0, 7], TAK = [4, 10], CLAP = [3, 6, 9], CLAP_SOFT = [4, 10];
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /** محرّك موسيقى مربوط بسياق صوت (حي أو للتسجيل) */
  function createBand(ctx) {
    let step = 0, nextTime = 0, noiseBuf;
    const plucks = new Map();
    const master = ctx.createGain();
    master.gain.value = 0;
    const bus = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 5200;
    bus.connect(lp); lp.connect(master);
    // صدى خفيف مثل غرفة جلسة
    const verb = ctx.createDelay(1); verb.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.22;
    const vg = ctx.createGain(); vg.gain.value = 0.18;
    verb.connect(fb); fb.connect(verb); verb.connect(vg); vg.connect(master);
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  /** وتر عود منقور (Karplus-Strong) محسوب مرة وحدة لكل نغمة */
  function pluckBuffer(m) {
    if (plucks.has(m)) return plucks.get(m);
    const sr = ctx.sampleRate, dur = 1.4, n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
    // طول خط التأخير + نص عينة من فلتر المتوسط = طول الموجة
    const N = Math.max(2, Math.round(sr / freq(m) - 0.5));
    const line = new Float32Array(N);
    for (let i = 0; i < N; i++) line[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const cur = line[idx], nxt = line[(idx + 1) % N];
      out[i] = cur;
      line[idx] = 0.996 * 0.5 * (cur + nxt);
      idx = (idx + 1) % N;
    }
    plucks.set(m, buf);
    return buf;
  }

  function oud(m, t, steps, vol) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    s.buffer = pluckBuffer(m);
    bp.type = "peaking"; bp.frequency.value = 900; bp.gain.value = 5; bp.Q.value = 1.2; // رنّة صندوق العود
    const end = t + Math.min(1.3, steps * STEP + 0.25);
    g.gain.setValueAtTime(vol, t);
    g.gain.setTargetAtTime(0.0001, end - 0.12, 0.05);
    s.connect(bp); bp.connect(g); g.connect(bus); g.connect(verb);
    s.start(t); s.stop(end + 0.1);
  }

  function drone(m, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(t, dur, type, f, q, vol) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.3, dur + 0.02);
  }

  function dum(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.22);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.45);
    noise(t, 0.03, "lowpass", 600, 0.7, 0.15);
  }
  function tak(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = 420;
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.1);
    noise(t, 0.06, "bandpass", 2200, 1.5, 0.22);
  }
  // التصفيق: أكثر من كف بفارق بسيط، مثل جماعة يصفقون
  function clap(t, vol) {
    for (let k = 0; k < 3; k++) noise(t + k * 0.011 + Math.random() * 0.004, 0.09 - k * 0.02, "bandpass", 1150 + k * 180, 1.1, vol * (1 - k * 0.2));
  }
  function riq(t, vol) { noise(t, 0.05, "highpass", 7500, 0.8, vol); }

  function schedule(until) {
    while (nextTime < until) {
      const inBar = step % BAR;
      const bar = Math.floor(step / BAR) % MELODY.length;
      const t = nextTime;
      if (inBar === 0) { drone(D - 24, t, STEP * BAR, 0.07); drone(A - 24, t, STEP * BAR, 0.035); }
      if (DUM.includes(inBar)) dum(t);
      if (TAK.includes(inBar)) tak(t);
      if (CLAP.includes(inBar)) clap(t, 0.32);
      if (CLAP_SOFT.includes(inBar)) clap(t, 0.12);
      if (inBar % 2 === 0) riq(t, inBar % 6 === 0 ? 0.07 : 0.04);
      for (const [s, m, len] of MELODY[bar]) if (s === inBar) oud(m, t, len, 0.5);
      // زخرفة بسيطة: ترديد النغمة على الأوكتاف تحت في بداية كل مازورتين
      if (inBar === 0 && bar % 2 === 0) oud(MELODY[bar][0][1] - 12, t, 3, 0.25);
      step++;
      nextTime += STEP;
    }
  }

    return {
      master,
      reset(t) { step = 0; nextTime = t; },
      schedule,
    };
  }

  let ctx, band, timer, playing = false;
  // أغنية يختارها المستخدم من جواله (تنحفظ في الجهاز فقط)
  let customEl = null, customGain = null, customUrl = null, customName = "";

  function ensureCtx() {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); band = createBand(ctx); }
    if (ctx.state === "suspended") ctx.resume();
  }
  const useSong = () => !customEl && songOk;
  const out = () => (customEl ? customGain : useSong() && songGain ? songGain : band.master);
  const LEVEL = () => (customEl ? 0.8 : useSong() ? 0.55 : 0.42);

  // ===== حفظ الأغنية في IndexedDB =====
  const DB = "intiqalat", STORE = "files";
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function dbPut(key, val) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(STORE, "readwrite");
      val == null ? tx.objectStore(STORE).delete(key) : tx.objectStore(STORE).put(val, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
  async function dbGet(key) {
    const d = await db();
    return new Promise((res, rej) => {
      const r = d.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }

  function useBlob(blob, name) {
    const wasPlaying = playing;
    if (wasPlaying) Music.stop(true);
    if (customEl) { customEl.pause(); customEl.removeAttribute("src"); customEl = null; }
    if (customUrl) URL.revokeObjectURL(customUrl);
    customUrl = null; customName = "";
    if (blob) {
      ensureCtx();
      customUrl = URL.createObjectURL(blob);
      customName = name || "";
      customEl = new Audio(customUrl);
      customEl.loop = true;
      customEl.setAttribute("playsinline", "");
      customGain = ctx.createGain();
      customGain.gain.value = 0;
      ctx.createMediaElementSource(customEl).connect(customGain);
      customGain.connect(ctx.destination);
    }
    if (wasPlaying) Music.start();
  }

  // ===== موسيقى اللعبة الافتراضية: مقطوعة هادية مؤلفة للعبة (assets/music/calm.mp3، من صنعنا وبدون حقوق لأحد) =====
  const SONG_NAME = "موسيقى هادية";
  let songEl = null, songGain = null, songOk = true;
  function songEnsure() {
    if (songEl || !songOk) return;
    ensureCtx();
    songEl = new Audio("assets/music/calm.mp3");
    songEl.loop = true;
    songEl.preload = "auto";
    songEl.setAttribute("playsinline", "");
    songEl.addEventListener("error", () => { songOk = false; songEl = null; if (playing) { playing = false; Music.start(); } });
    songGain = ctx.createGain();
    songGain.gain.value = 0;
    ctx.createMediaElementSource(songEl).connect(songGain);
    songGain.connect(ctx.destination);
  }
  const Music = {
    get playing() { return playing; },
    get customName() { return customEl ? customName || "أغنيتك" : ""; },
    get defaultName() { return songOk ? SONG_NAME : "اللحن الافتراضي"; },
    start() {
      try {
        if (useSong()) songEnsure();
        ensureCtx();
        if (playing) return;
        playing = true;
        const g = out().gain;
        g.cancelScheduledValues(ctx.currentTime);
        g.setTargetAtTime(LEVEL(), ctx.currentTime, 0.6);
        clearInterval(timer);
        if (customEl) { customEl.play().catch(() => { playing = false; }); return; }
        if (useSong() && songEl) { songEl.play().catch(() => { playing = false; }); return; }
        band.reset(ctx.currentTime + 0.1);
        timer = setInterval(() => band.schedule(ctx.currentTime + 0.15), 40);
      } catch { playing = false; }
    },
    stop(now) {
      if (!ctx || !playing) return;
      playing = false;
      const el = customEl || (useSong() ? songEl : null), g = out().gain;
      g.setTargetAtTime(0, ctx.currentTime, now ? 0.01 : 0.2);
      setTimeout(() => { if (!playing) { clearInterval(timer); if (el) el.pause(); } }, now ? 30 : 600);
    },
    /** يخفض الموسيقى شوي وقت آخر ثواني المؤقت */
    duck(on) {
      if (!ctx || !playing) return;
      out().gain.setTargetAtTime(on ? LEVEL() / 2 : LEVEL(), ctx.currentTime, 0.3);
    },
    /** أغنية من جوال المستخدم: تنحفظ في الجهاز وتشتغل بدل اللحن الافتراضي */
    async setCustom(file) {
      useBlob(file, file && file.name);
      try { await dbPut("music", file ? { blob: file, name: file.name } : null); } catch { /* التخزين مقفل */ }
    },
    async loadSaved() {
      try {
        const v = await dbGet("music");
        if (v && v.blob) useBlob(v.blob, v.name);
      } catch { /* */ }
      return Music.customName;
    },
    /** يسجّل مقطع بدون تشغيل (للاختبار والمعاينة) */
    preview(seconds, rate = 44100) {
      const off = new OfflineAudioContext(1, Math.round(rate * seconds), rate);
      const b = createBand(off);
      b.master.gain.value = 0.42;
      b.reset(0.05);
      b.schedule(seconds - 0.3);
      return off.startRendering();
    },
  };
  root.Music = Music;
})(window);
