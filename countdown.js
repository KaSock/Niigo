"use strict";

function nextOneAM(now) {
  const target = new Date(now);
  target.setHours(1, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

function remainingTime(target, now) {
  const total = Math.max(0, Math.ceil((target - now) / 1000));
  return {
    hours: String(Math.floor(total / 3600)).padStart(2, "0"),
    minutes: String(Math.floor(total / 60) % 60).padStart(2, "0"),
    seconds: String(total % 60).padStart(2, "0"),
  };
}

const digitPaths = {
  0: "M4 3H56V97H4ZM14 7V93H46V7Z",
  1: "M27 14L46 3H55V97H45V9L28 18Z",
  2: "M4 3H56V40L14 63V93H56V97H4V60L46 37V7H4Z",
  3: "M4 3H56V35L29 49L56 61V78L4 98V94L46 75V63L18 50V47L46 32V7H4Z",
  4: "M4 3H14V49L46 63V3H56V97H46V68L4 51Z",
  5: "M4 3H56V7H14V36L56 60V97H4V93H46V63L4 39Z",
  6: "M56 2V6L14 27V93H46V59L20 43V39L56 56V97H4V25Z",
  7: "M4 3H56V97H46V7H4Z",
  8: "M4 3H56V38L34 50L56 62V97H4V62L26 50L4 38ZM14 7V35L30 45L46 35V7ZM30 55L14 65V93H46V65Z",
  9: "M4 3H56V75L4 98V94L46 73V7H14V40L40 55V59L4 43Z",
};

const letterPaths = {
  H: "M2 1V23M12 1V23M2 11H12",
  M: "M2 23V1L8 10L14 1V23",
  S: "M12 2H2V10L12 14V23H2",
  C: "M12 2H2V23H12",
  O: "M2 2H12V23H2Z",
  I: "M4 2H10M7 2V23M4 23H10",
  N: "M2 23V2L12 23V2",
  G: "M12 2H2V23H12V13H7",
  o: "M2 8H11V23H2Z",
  u: "M2 8V23H11V8",
  r: "M2 23V8H11V12",
  s: "M11 8H2V14L11 17V23H2",
  i: "M6 8V23M6 2V4",
  n: "M2 23V8H11V23",
  t: "M6 2V23H11M2 8H11",
  e: "M2 15H11V8H2V23H11",
  c: "M11 8H2V23H11",
  d: "M11 1V23H2V8H11",
};

function svgElement(name, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function makeDigit(character) {
  const svg = svgElement("svg", { viewBox: "0 0 60 100", class: "digit", "aria-hidden": "true" });
  svg.append(svgElement("path", { d: digitPaths[character], fill: "currentColor", "fill-rule": "evenodd" }));
  return svg;
}

function drawWord(element) {
  const word = element.dataset.vectorWord;
  const advance = 19;
  const svg = svgElement("svg", { viewBox: `0 0 ${word.length * advance - 5} 25`, "aria-hidden": "true" });
  Array.from(word).forEach((character, index) => {
    if (character === " ") return;
    svg.append(svgElement("path", {
      d: letterPaths[character],
      transform: `translate(${index * advance} 0)`,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linejoin": "miter",
    }));
  });
  element.replaceChildren(svg);
  element.setAttribute("aria-label", word);
}

function startCountdown() {
  document.querySelectorAll("[data-vector-word]").forEach(drawWord);
  const timer = document.querySelector(".countdown");
  const fields = Object.fromEntries(["hours", "minutes", "seconds"].map(key => [key, document.getElementById(key)]));
  const targetDisplay = document.getElementById("target-time");
  const dateFormat = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
  });
  let target = nextOneAM(new Date());

  function tick() {
    const now = new Date();
    const expected = nextOneAM(now);
    if (now - target >= 1000 || (now < target && +expected !== +target)) target = expected;
    const time = remainingTime(target, now);
    for (const [key, value] of Object.entries(time)) {
      if (fields[key].dataset.value === value) continue;
      fields[key].replaceChildren(...Array.from(value, makeDigit));
      fields[key].dataset.value = value;
    }
    timer.setAttribute("aria-label", `次の25時まで、${Number(time.hours)}時間${Number(time.minutes)}分${Number(time.seconds)}秒`);
    targetDisplay.dateTime = target.toISOString();
    targetDisplay.textContent = dateFormat.format(target);
  }

  tick();
  window.setInterval(tick, 200);
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("focus", tick);

  const dialog = document.getElementById("information");
  document.querySelector(".menu-button").addEventListener("click", () => dialog.showModal());
  document.querySelector(".close-button").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}

function startMusic() {
  const music = document.getElementById("background-music");
  const button = document.querySelector(".music-button");
  music.volume = 0.5;

  function showState(playing) {
    button.classList.toggle("is-playing", playing);
    button.setAttribute("aria-pressed", String(playing));
    const label = playing ? "BGMを一時停止" : "BGMを再生";
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  async function play() {
    try {
      await music.play();
      if (!music.paused) {
        showState(true);
        stopGestureRetry();
      }
    } catch (error) {
      // 有声自动播放可能被浏览器阻止，等待用户操作后重试。
      if (error.name === "NotAllowedError" && music.paused) {
        button.title = "クリックしてBGMを再生";
      }
    }
  }

  function stopGestureRetry() {
    document.removeEventListener("pointerdown", retryOnGesture);
    document.removeEventListener("keydown", retryOnGesture);
  }

  function retryOnGesture(event) {
    if (button.contains(event.target)) return;
    if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
    void play();
  }

  music.addEventListener("playing", () => {
    showState(true);
    stopGestureRetry();
  });
  music.addEventListener("pause", () => showState(false));
  music.addEventListener("ended", () => showState(false));
  music.addEventListener("error", () => {
    showState(false);
    button.title = "BGMを読み込めませんでした。クリックして再試行";
  });
  button.addEventListener("click", () => {
    stopGestureRetry();
    if (music.paused) {
      if (music.error) music.load();
      void play();
    } else {
      music.pause();
    }
  });

  document.addEventListener("pointerdown", retryOnGesture);
  document.addEventListener("keydown", retryOnGesture);
  void play();
}

if (typeof document !== "undefined") {
  startCountdown();
  startMusic();
}
