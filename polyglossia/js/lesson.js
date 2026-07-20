import { speak, ttsMode } from "./tts.js";
import { addXP, markLessonComplete } from "./storage.js";

const XP_PER_EXERCISE = 10;
const XP_LESSON_BONUS = 20;

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Very small markdown-ish renderer for grammar/culture bodies:
// paragraphs, **bold**, *italic*, and | tables |.
function renderBody(text) {
  const lines = String(text || "").split("\n");
  let html = "", table = [];
  const flushTable = () => {
    if (!table.length) return;
    html += "<table>" + table.map((row) =>
      "<tr>" + row.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</table>";
    table = [];
  };
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>");
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("|")) {
      const cells = t.split("|").slice(1, -1).map((c) => c.trim());
      if (!cells.every((c) => /^-+$/.test(c))) table.push(cells);
    } else {
      flushTable();
      if (t) html += `<p>${inline(t)}</p>`;
    }
  }
  flushTable();
  return html;
}

export function renderLessonSession(app, course, unitId, lesson, onStatsChanged) {
  const approx = ttsMode(course) === "approximate";
  const ttsBadge = approx ? `<span class="tts-badge">≈ approx.</span>` : "";

  // Build the step queue: teach cards, grammar note, culture note, exercises.
  const steps = [];
  for (const item of lesson.teach || []) steps.push({ kind: "teach", item });
  if (lesson.grammar) steps.push({ kind: "grammar", note: lesson.grammar });
  if (lesson.culture) steps.push({ kind: "culture", note: lesson.culture });
  for (const ex of lesson.exercises || []) steps.push({ kind: "exercise", ex });

  const totalPlanned = steps.length;
  let stepIndex = 0;
  let correctCount = 0;
  let exercisesDone = 0;

  function progressPct() {
    return Math.min(100, Math.round((stepIndex / Math.max(totalPlanned, steps.length)) * 100));
  }

  function frame(inner, footer) {
    app.innerHTML = `
      <div class="session-top">
        <a class="session-quit" href="#/unit/${esc(unitId)}" title="Quit lesson">✕</a>
        <div class="progressbar"><div style="width:${progressPct()}%"></div></div>
      </div>
      ${inner}
      <div class="session-footer">${footer || ""}</div>`;
  }

  function speakBtn(text, label = "🔊 Listen") {
    return `<button class="speak-btn" data-say="${esc(text)}">${label}${ttsBadge}</button>`;
  }

  function wireSpeech() {
    app.querySelectorAll("[data-say]").forEach((b) =>
      b.addEventListener("click", () => speak(b.dataset.say, course)));
  }

  function next() {
    stepIndex++;
    if (stepIndex >= steps.length) return finish();
    show(steps[stepIndex]);
  }

  function show(step) {
    if (step.kind === "teach") return showTeach(step.item);
    if (step.kind === "grammar") return showNote(step.note, "grammar-box", "📐 Grammar");
    if (step.kind === "culture") return showNote(step.note, "culture-box", "🏛️ Culture note");
    return showExercise(step.ex);
  }

  function showTeach(item) {
    frame(`
      <div class="teach-card">
        <div class="big target">${esc(item.target)}</div>
        ${item.roman ? `<div class="roman">${esc(item.roman)}</div>` : ""}
        <div class="eng">${esc(item.english)}</div>
        ${item.note ? `<div class="note">${esc(item.note)}</div>` : ""}
        ${speakBtn(item.roman || item.target)}
      </div>`,
      `<button class="btn wide" id="continue">Continue</button>`);
    wireSpeech();
    speak(item.roman || item.target, course);
    app.querySelector("#continue").addEventListener("click", next);
  }

  function showNote(note, cls, tag) {
    frame(`
      <div class="${cls}">
        <h3>${tag}${note.title ? ` — ${esc(note.title)}` : ""}</h3>
        ${renderBody(note.body)}
      </div>`,
      `<button class="btn wide" id="continue">Continue</button>`);
    app.querySelector("#continue").addEventListener("click", next);
  }

  function feedback(good, message, onNext) {
    const el = document.createElement("div");
    el.className = `feedback ${good ? "good" : "bad"}`;
    el.innerHTML = `
      <div class="fb-inner">
        <h3>${good ? "Nicely done!" : "Not quite."}</h3>
        <p>${esc(message || "")}</p>
        <button class="btn wide ${good ? "" : "red"}" id="fb-next">Continue</button>
      </div>`;
    document.body.appendChild(el);
    el.querySelector("#fb-next").addEventListener("click", () => {
      el.remove();
      onNext();
    });
  }

  function settle(ex, good, explain) {
    exercisesDone++;
    if (good) {
      correctCount++;
      addXP(XP_PER_EXERCISE);
      onStatsChanged();
    } else {
      // Re-queue missed exercises at the end, Duolingo-style.
      steps.push({ kind: "exercise", ex, retry: true });
    }
    feedback(good, explain, next);
  }

  function showExercise(ex) {
    if (ex.type === "match") return showMatch(ex);
    if (ex.type === "type") return showType(ex);
    if (ex.type === "listen") return showListen(ex);
    return showMC(ex);
  }

  function showMC(ex) {
    const order = shuffled(ex.choices.map((c, i) => ({ c, i })));
    frame(`
      <div class="exercise">
        <h2>${esc(ex.prompt)}</h2>
        ${ex.tts ? speakBtn(ex.tts) : ""}
        <div class="choices" style="margin-top:14px">
          ${order.map((o) => `<button class="choice target" data-i="${o.i}">${esc(o.c)}</button>`).join("")}
        </div>
      </div>`);
    wireSpeech();
    app.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
      const good = Number(b.dataset.i) === ex.answer;
      b.classList.add(good ? "correct" : "wrong");
      app.querySelectorAll(".choice").forEach((x) => (x.disabled = true));
      settle(ex, good, good ? "" : `Correct answer: ${ex.choices[ex.answer]}`);
    }));
  }

  function showListen(ex) {
    const order = shuffled(ex.choices.map((c, i) => ({ c, i })));
    frame(`
      <div class="exercise">
        <h2>${esc(ex.prompt || "Which one did you hear?")}</h2>
        ${speakBtn(ex.ttsText, "🔊 Play audio")}
        <div class="choices" style="margin-top:14px">
          ${order.map((o) => `<button class="choice target" data-i="${o.i}">${esc(o.c)}</button>`).join("")}
        </div>
      </div>`);
    wireSpeech();
    speak(ex.ttsText, course);
    app.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
      const good = Number(b.dataset.i) === ex.answer;
      b.classList.add(good ? "correct" : "wrong");
      app.querySelectorAll(".choice").forEach((x) => (x.disabled = true));
      settle(ex, good, good ? "" : `It was: ${ex.choices[ex.answer]}`);
    }));
  }

  function normalize(s) {
    return String(s || "").toLowerCase().normalize("NFC").replace(/[\s'’-]+/g, "");
  }

  function showType(ex) {
    frame(`
      <div class="exercise">
        <h2>${esc(ex.prompt)}</h2>
        ${ex.tts ? speakBtn(ex.tts) : ""}
        <input class="type-input" id="answer" autocomplete="off" autocapitalize="off"
               spellcheck="false" placeholder="Type your answer">
      </div>`,
      `<button class="btn wide" id="check">Check</button>`);
    wireSpeech();
    const input = app.querySelector("#answer");
    input.focus();
    const check = () => {
      const accepted = [ex.answer, ...(ex.accept || [])].map(normalize);
      const good = accepted.includes(normalize(input.value));
      settle(ex, good, good ? "" : `Correct answer: ${ex.answer}`);
    };
    app.querySelector("#check").addEventListener("click", check);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
  }

  function showMatch(ex) {
    // pairs: [[left, right], ...] — tap one from each column to match.
    const lefts = shuffled(ex.pairs.map((p, i) => ({ text: p[0], i })));
    const rights = shuffled(ex.pairs.map((p, i) => ({ text: p[1], i })));
    let missed = false;
    let sel = null;
    let matched = 0;

    frame(`
      <div class="exercise">
        <h2>${esc(ex.prompt || "Match the pairs")}</h2>
        <div class="match-grid">
          ${lefts.map((l) => `<button class="choice target" data-side="L" data-i="${l.i}" data-say-word="${esc(l.text)}">${esc(l.text)}</button>`).join("")}
          ${rights.map((r) => `<button class="choice" data-side="R" data-i="${r.i}">${esc(r.text)}</button>`).join("")}
        </div>
      </div>`);

    // Interleave columns visually: rebuild grid as L R L R by row order.
    const grid = app.querySelector(".match-grid");
    const Ls = [...grid.querySelectorAll('[data-side="L"]')];
    const Rs = [...grid.querySelectorAll('[data-side="R"]')];
    grid.innerHTML = "";
    for (let i = 0; i < Ls.length; i++) { grid.appendChild(Ls[i]); grid.appendChild(Rs[i]); }

    grid.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.side === "L" && b.dataset.sayWord) speak(b.dataset.sayWord, course);
      if (sel && sel !== b && sel.dataset.side !== b.dataset.side) {
        if (sel.dataset.i === b.dataset.i) {
          sel.classList.add("matched"); b.classList.add("matched");
          matched++;
          if (matched === ex.pairs.length) settle(ex, !missed, missed ? "Watch those pairs — try it again later." : "");
        } else {
          missed = true;
          sel.classList.add("wrong"); b.classList.add("wrong");
          const s = sel, t = b;
          setTimeout(() => { s.classList.remove("wrong", "sel"); t.classList.remove("wrong"); }, 500);
        }
        sel.classList.remove("sel");
        sel = null;
      } else {
        sel?.classList.remove("sel");
        sel = b;
        b.classList.add("sel");
      }
    }));
  }

  function finish() {
    markLessonComplete(course.code, unitId, lesson.id);
    addXP(XP_LESSON_BONUS);
    onStatsChanged();
    const acc = exercisesDone ? Math.round((correctCount / exercisesDone) * 100) : 100;
    app.innerHTML = `
      <div class="complete">
        <div class="big-emoji">🎉</div>
        <h1>Lesson complete!</h1>
        <p>${acc}% accuracy</p>
        <div class="xp-chip">+${correctCount * XP_PER_EXERCISE + XP_LESSON_BONUS} XP</div>
        <div><a class="btn wide" href="#/unit/${esc(unitId)}">Continue</a></div>
      </div>`;
  }

  show(steps[0]);
}
