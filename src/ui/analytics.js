import { getUserProgress, getWorkoutHistory } from "../api.js";

const labels = {
  ru: {
    totalWorkouts: "ВСЕГО ТРЕНИРОВОК", totalReps: "ВСЕГО ПОВТОРЕНИЙ", totalTime: "ОБЩЕЕ ВРЕМЯ", streak: "ТЕКУЩАЯ СЕРИЯ",
    weekly: "АКТИВНОСТЬ ЗА НЕДЕЛЮ", weeklySub: "Количество повторений · текущая неделя", distribution: "РАСПРЕДЕЛЕНИЕ УПРАЖНЕНИЙ",
    history: "ИСТОРИЯ ТРЕНИРОВОК", records: "ЛИЧНЫЕ РЕКОРДЫ", progress: "ТРЕНИРОВОЧНЫЙ ПРОГРЕСС",
    empty: "Завершите первую тренировку, чтобы увидеть статистику.", noHistory: "История тренировок пока пуста.",
    noData: "Недостаточно данных", login: "Войдите, чтобы увидеть свою аналитику.",
    unavailable: "Данные временно недоступны. Проверьте подключение к серверу.",
    reps: "повт.", workouts: "тренировок", exercises: "упражнения", day: "дн.", min: "мин", sec: "с",
    done: "ЗАВЕРШЕНА", incomplete: "НЕ ЗАВЕРШЕНА", days: ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"],
    names: { squat: "Приседания", pushup: "Отжимания", armraise: "Подъём рук", sidebend: "Боковые наклоны" },
    programs: { "full-body": "FULL BODY", strength: "STRENGTH", light: "LIGHT" },
    maxSquat: "Максимум приседаний за тренировку", maxPushup: "Максимум отжиманий за тренировку",
    longest: "Самая длинная тренировка", total: "Всего тренировок", weeklySessions: "Тренировки за неделю",
    activeDays: "Активные дни за неделю", weeklyReps: "Повторения за неделю", progressHint: "Реальные итоги сохранённых тренировок",
    zeroHint: "Появится после первой сохранённой тренировки"
  },
  en: {
    totalWorkouts: "TOTAL WORKOUTS", totalReps: "TOTAL REPS", totalTime: "TOTAL TIME", streak: "CURRENT STREAK",
    weekly: "WEEKLY ACTIVITY", weeklySub: "Repetitions · current week", distribution: "EXERCISE DISTRIBUTION",
    history: "WORKOUT HISTORY", records: "PERSONAL BESTS", progress: "TRAINING PROGRESS",
    empty: "Finish your first workout to see your statistics.", noHistory: "No workout history yet.",
    noData: "Not enough data", login: "Log in to see your analytics.",
    unavailable: "Data is temporarily unavailable. Check your server connection.",
    reps: "reps", workouts: "workouts", exercises: "exercises", day: "day", daysPlural: "days", min: "min", sec: "s",
    done: "COMPLETED", incomplete: "INCOMPLETE", days: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    names: { squat: "Squat", pushup: "Push-up", armraise: "Arm Raise", sidebend: "Side Bend" },
    programs: { "full-body": "FULL BODY", strength: "STRENGTH", light: "LIGHT" },
    maxSquat: "Most squats in one workout", maxPushup: "Most push-ups in one workout",
    longest: "Longest workout", total: "Total workouts", weeklySessions: "Workouts this week",
    activeDays: "Active days this week", weeklyReps: "Repetitions this week", progressHint: "Actual totals from saved workouts",
    zeroHint: "Appears after your first saved workout"
  }
};

const ids = ["squat", "pushup", "armraise", "sidebend"];
let lang = "ru";
let latest = null;
let generation = 0;
let initialized = false;
const make = (tag, className, value) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
};
const fmt = (number) => new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(number);
const duration = (ms) => {
  const t = labels[lang];
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes ? `${fmt(minutes)} ${t.min} ${String(seconds).padStart(2, "0")} ${t.sec}` : `${seconds} ${t.sec}`;
};
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const safeHistory = (result) => result?.ok && Array.isArray(result.data) ? result.data : [];
const sumReps = (workout) => workout.exercises.reduce((sum, item) => sum + item.completedReps, 0);
const empty = (message) => make("p", "analytics-empty", message);

function weekData(history) {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { key: dayKey(date), reps: 0, workouts: 0 };
  });
  for (const workout of history) {
    const date = new Date(workout.finishedAt);
    if (Number.isNaN(date.getTime())) continue;
    const day = days.find(item => item.key === dayKey(date));
    if (day) { day.reps += sumReps(workout); day.workouts += 1; }
  }
  return days;
}

function streak(history) {
  const dates = new Set(history.map(item => dayKey(new Date(item.finishedAt))));
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (!dates.has(dayKey(date))) date.setDate(date.getDate() - 1);
  let count = 0;
  while (dates.has(dayKey(date))) { count++; date.setDate(date.getDate() - 1); }
  return count;
}

function renderMetrics(root, history, progress, hasData, historyAvailable) {
  const t = labels[lang];
  const streakDays = streak(history);
  const values = [
    [t.totalWorkouts, progress?.totalWorkouts ?? history.length, "01"],
    [t.totalReps, progress?.totalReps ?? history.reduce((sum, w) => sum + sumReps(w), 0), "02"],
    [t.totalTime, duration(progress?.totalDurationMs ?? history.reduce((sum, w) => sum + w.durationMs, 0)), "03"],
    [t.streak, historyAvailable ? `${streakDays} ${streakDays === 1 ? t.day : (t.daysPlural ?? t.day)}` : null, "04"]
  ];
  const grid = make("div", "analytics-metrics");
  values.forEach(([title, value, number]) => {
    const card = make("article", "analytics-metric");
    card.append(make("span", "analytics-metric-index", number), make("strong", "analytics-metric-value", hasData && value !== null ? String(value) : "—"),
      make("span", "analytics-metric-label", title), make("span", "analytics-metric-foot", hasData ? t.progressHint : t.zeroHint));
    grid.append(card);
  });
  root.append(grid);
}

function renderWeek(history, emptyMessage) {
  const t = labels[lang];
  const card = make("article", "analytics-panel analytics-weekly");
  card.append(make("h3", "analytics-panel-title", t.weekly), make("p", "analytics-panel-subtitle", t.weeklySub));
  const days = weekData(history);
  const max = Math.max(0, ...days.map(day => day.reps));
  const chart = make("div", "analytics-week-chart");
  days.forEach((day, index) => {
    const column = make("div", "analytics-week-column");
    const barWrap = make("div", "analytics-week-bar-wrap");
    const bar = make("div", "analytics-week-bar");
    bar.style.height = day.reps && max ? `${Math.max(3, day.reps / max * 100)}%` : "0%";
    bar.setAttribute("aria-label", `${t.days[index]}: ${day.reps} ${t.reps}`);
    barWrap.append(bar);
    column.append(make("strong", "analytics-week-value", max ? fmt(day.reps) : ""), barWrap, make("span", "analytics-week-day", t.days[index]));
    chart.append(column);
  });
  card.append(chart);
  if (!max) card.append(empty(emptyMessage ?? t.noData));
  return card;
}

function renderDistribution(history, progress, emptyMessage) {
  const t = labels[lang];
  const card = make("article", "analytics-panel analytics-distribution");
  card.append(make("h3", "analytics-panel-title", t.distribution));
  const totals = Object.fromEntries(ids.map(id => [id, progress?.exerciseTotals?.[id]?.completedReps ?? 0]));
  if (!progress) for (const workout of history) for (const exercise of workout.exercises) {
    if (exercise.exerciseId in totals) totals[exercise.exerciseId] += exercise.completedReps;
  }
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  if (!total) { card.append(empty(emptyMessage ?? t.noData)); return card; }
  const track = make("div", "analytics-distribution-track");
  ids.forEach((id, index) => {
    const segment = make("span", `analytics-segment segment-${index}`);
    segment.style.width = `${totals[id] / total * 100}%`;
    track.append(segment);
  });
  card.append(make("strong", "analytics-distribution-total", `${fmt(total)} ${t.reps}`), track);
  ids.forEach((id, index) => {
    const row = make("div", "analytics-distribution-row");
    const label = make("span", "analytics-distribution-name", t.names[id]);
    label.prepend(make("i", `analytics-dot segment-${index}`));
    row.append(label, make("strong", "", fmt(totals[id])));
    card.append(row);
  });
  return card;
}

function renderHistory(history, emptyMessage) {
  const t = labels[lang];
  const card = make("article", "analytics-panel analytics-history");
  card.id = "history-items-list";
  card.append(make("h3", "analytics-panel-title", t.history));
  if (!history.length) { card.append(empty(emptyMessage ?? t.noHistory)); return card; }
  history.slice(0, 8).forEach(workout => {
    const row = make("div", "analytics-history-row history-item");
    const main = make("div", "analytics-history-main");
    main.append(make("strong", "", t.programs[workout.programId] ?? `${t.workouts} ${workout.workoutNumber}`),
      make("span", "", new Date(workout.finishedAt).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short" })));
    const stats = make("div", "analytics-history-stats");
    stats.append(make("span", "", `${workout.exercises.length} ${t.exercises}`),
      make("span", "", `${fmt(sumReps(workout))} ${t.reps}`), make("span", "", duration(workout.durationMs)));
    row.append(main, stats, make("span", `analytics-history-status ${workout.completed ? "" : "is-incomplete"}`, workout.completed ? t.done : t.incomplete));
    card.append(row);
  });
  return card;
}

function renderRecords(history, emptyMessage) {
  const t = labels[lang];
  const card = make("article", "analytics-panel analytics-records");
  card.append(make("h3", "analytics-panel-title", t.records));
  if (!history.length) { card.append(empty(emptyMessage ?? t.noData)); return card; }
  const best = id => Math.max(0, ...history.map(workout => workout.exercises.filter(e => e.exerciseId === id)
    .reduce((sum, exercise) => sum + exercise.completedReps, 0)));
  const records = [
    [t.maxSquat, `${fmt(best("squat"))} ${t.reps}`],
    [t.maxPushup, `${fmt(best("pushup"))} ${t.reps}`],
    [t.longest, duration(Math.max(...history.map(workout => workout.durationMs)))],
    [t.total, fmt(history.length)]
  ];
  records.forEach(([label, value], index) => {
    const row = make("div", "analytics-record-row");
    row.append(make("span", "analytics-record-index", String(index + 1).padStart(2, "0")),
      make("span", "analytics-record-label", label), make("strong", "analytics-record-value", value));
    card.append(row);
  });
  return card;
}

function renderProgress(history, emptyMessage) {
  const t = labels[lang];
  const card = make("article", "analytics-panel analytics-progress");
  card.append(make("h3", "analytics-panel-title", t.progress), make("p", "analytics-panel-subtitle", t.progressHint));
  if (!history.length) { card.append(empty(emptyMessage ?? t.noData)); return card; }
  const week = weekData(history);
  const stats = [
    [t.weeklySessions, week.reduce((sum, day) => sum + day.workouts, 0), history.length],
    [t.activeDays, week.filter(day => day.workouts > 0).length, 7],
    [t.weeklyReps, week.reduce((sum, day) => sum + day.reps, 0), history.reduce((sum, workout) => sum + sumReps(workout), 0)]
  ];
  stats.forEach(([name, value, ceiling]) => {
    const row = make("div", "analytics-progress-row");
    const heading = make("div", "analytics-progress-heading");
    heading.append(make("span", "", name), make("strong", "", fmt(value)));
    const track = make("div", "analytics-progress-track");
    const fill = make("span", "analytics-progress-fill");
    fill.style.width = `${ceiling ? Math.min(100, value / ceiling * 100) : 0}%`;
    track.append(fill);
    row.append(heading, track);
    card.append(row);
  });
  return card;
}

function render() {
  const root = document.querySelector("#analytics-content");
  if (!root || !latest) return;
  root.replaceChildren();
  const t = labels[lang];
  const history = safeHistory(latest.history);
  const progress = latest.progress?.ok ? latest.progress.data : null;
  const hasData = Boolean(progress?.totalWorkouts || history.length);
  const unavailable = !latest.history.ok && !latest.progress.ok;
  const unavailableMessage = unavailable ?
    (latest.history.status === 401 || latest.progress.status === 401 ? t.login : t.unavailable) : null;
  if (unavailable) root.append(empty(unavailableMessage));
  else if (!hasData) root.append(empty(t.empty));
  renderMetrics(root, history, progress, hasData, latest.history.ok);
  const summary = make("p", "sr-only", progress && hasData ?
    `${t.totalWorkouts}: ${progress.totalWorkouts} · ${t.totalReps}: ${progress.totalReps}` : "");
  summary.id = "user-progress-summary";
  root.append(summary);
  const top = make("div", "analytics-main-grid");
  top.append(renderWeek(history, unavailableMessage), renderDistribution(history, progress, unavailableMessage));
  const middle = make("div", "analytics-main-grid");
  middle.append(renderHistory(history, unavailableMessage), renderRecords(history, unavailableMessage));
  root.append(top, middle, renderProgress(history, unavailableMessage));
}

export function setAnalyticsLanguage(nextLang) {
  lang = nextLang === "en" ? "en" : "ru";
  render();
}

export function clearAnalytics() {
  ++generation;
  latest = { history: { ok: false, status: 401 }, progress: { ok: false, status: 401 } };
  render();
}

export async function refreshAnalytics() {
  if (!initialized) return;
  const request = ++generation;
  const [history, progress] = await Promise.all([getWorkoutHistory(), getUserProgress()]);
  if (request !== generation) return;
  latest = { history, progress };
  render();
}

export function initAnalytics(nextLang = "ru") {
  lang = nextLang === "en" ? "en" : "ru";
  if (initialized) return;
  initialized = true;
  refreshAnalytics();
}
