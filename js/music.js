/*
 * موسيقى خلفية خفيفة مولّدة بالكود (Web Audio).
 * ما فيها أي ملف صوتي، فما فيه حقوق موسيقى ولا حجم إضافي للتطبيق.
 * لحن هادئ: كوردات C – G – Am – F مع باص ونقرات خفيفة، 96 نبضة بالدقيقة.
 */
(function (root) {
  "use strict";
  const BPM = 96;
  const STEP = 60 / BPM / 2; // ثُمن نوتة
  const CHORDS = [
    [60, 64, 67, 71], // Cmaj7
    [55, 59, 62, 66], // Gmaj7 (تحت)
    [57, 60, 64, 67], // Am7
    [53, 57, 60, 64], // Fmaj7
  ];
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ctx, master, filter, timer, step = 0, nextTime = 0, playing = false;

  function setup() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    filter.connect(master);
    master.connect(ctx.destination);
  }

  function note(m, t, dur, type, vol, attack = 0.01) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(filter);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function hat(t, vol) {
    const len = 0.04, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; hp.type = "highpass"; hp.frequency.value = 7000; g.gain.value = vol;
    s.connect(hp); hp.connect(g); g.connect(master);
    s.start(t);
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.3);
  }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 8) % CHORDS.length;
      const inBar = step % 8;
      const ch = CHORDS[bar];
      if (inBar === 0) ch.forEach((m) => note(m - 12, nextTime, STEP * 8, "triangle", 0.045, 0.25)); // باد ناعم
      if (inBar === 0 || inBar === 4) { note(ch[0] - 24, nextTime, STEP * 3, "sine", 0.22); kick(nextTime); } // باص
      const arp = [0, 2, 1, 3, 2, 1, 3, 2][inBar];
      if (inBar !== 0) note(ch[arp] + 12, nextTime, STEP * 1.5, "square", 0.018); // أربيجو
      if (inBar % 2 === 1) hat(nextTime, 0.05);
      step++;
      nextTime += STEP;
    }
  }

  const Music = {
    get playing() { return playing; },
    start() {
      try {
        setup();
        if (ctx.state === "suspended") ctx.resume();
        if (playing) return;
        playing = true;
        nextTime = ctx.currentTime + 0.1;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.6);
        timer = setInterval(schedule, 40);
      } catch { playing = false; }
    },
    stop() {
      if (!ctx || !playing) return;
      playing = false;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      setTimeout(() => { if (!playing) clearInterval(timer); }, 600);
    },
    /** يخفض الموسيقى شوي وقت آخر ثواني المؤقت */
    duck(on) {
      if (!ctx || !playing) return;
      master.gain.setTargetAtTime(on ? 0.25 : 0.5, ctx.currentTime, 0.3);
    },
  };
  root.Music = Music;
})(window);
