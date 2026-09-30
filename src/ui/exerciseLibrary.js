// Presentation-only catalog. Only these four IDs exist in the motion engine.
const categories = ["all", "legs", "chest", "back", "shoulders", "arms", "core", "mobility", "cardio"];
const copy = {
  ru: {
    featured: "ДОСТУПНО ДЛЯ ОТСЛЕЖИВАНИЯ", all: "ВСЕ УПРАЖНЕНИЯ", count: "упражнений",
    search: "Поиск упражнения...", available: "● ОТСЛЕЖИВАНИЕ ДОСТУПНО", soon: "ОТСЛЕЖИВАНИЕ СКОРО",
    start: "НАЧАТЬ ОТСЛЕЖИВАНИЕ", details: "ПОДРОБНЕЕ", muscles: "ОСНОВНЫЕ МЫШЦЫ",
    view: "РАКУРС", side: "СБОКУ", front: "СПЕРЕДИ", difficulty: "СЛОЖНОСТЬ",
    technique: "ТЕХНИКА", safetyLabel: "ПОЛОЖЕНИЕ И КОНТРОЛЬ", close: "ЗАКРЫТЬ",
    noResults: "Упражнения не найдены. Попробуйте другой запрос или категорию.",
    trackedNote: "Выберите программу с этим упражнением после запуска камеры.",
    levels: { easy: "Начальный", medium: "Средний", hard: "Продвинутый" },
    cats: { all: "ВСЕ", legs: "НОГИ", chest: "ГРУДЬ", back: "СПИНА", shoulders: "ПЛЕЧИ", arms: "РУКИ", core: "КОР", mobility: "МОБИЛЬНОСТЬ", cardio: "КАРДИО" },
    safety: {
      legs: "Двигайтесь в комфортной амплитуде и сохраняйте устойчивую опору.", chest: "Держите корпус ровным и не задерживайте дыхание.",
      back: "Двигайтесь плавно, без рывков и чрезмерного прогиба.", shoulders: "Не поднимайте плечи к ушам; контролируйте амплитуду.",
      arms: "Сохраняйте спокойный темп и устойчивое положение локтей.", core: "Контролируйте корпус и остановитесь, если теряете устойчивость.",
      mobility: "Не тянитесь через боль; увеличивайте амплитуду постепенно.", cardio: "Начните с удобного темпа и следите за устойчивостью."
    }
  },
  en: {
    featured: "AVAILABLE FOR TRACKING", all: "ALL EXERCISES", count: "exercises",
    search: "Search exercises...", available: "● TRACKING AVAILABLE", soon: "TRACKING SOON",
    start: "START TRACKING", details: "VIEW DETAILS", muscles: "PRIMARY MUSCLES",
    view: "CAMERA VIEW", side: "SIDE", front: "FRONT", difficulty: "DIFFICULTY",
    technique: "TECHNIQUE", safetyLabel: "POSITION & CONTROL", close: "CLOSE",
    noResults: "No exercises found. Try another search or category.",
    trackedNote: "Choose a program containing this exercise after starting the camera.",
    levels: { easy: "Beginner", medium: "Intermediate", hard: "Advanced" },
    cats: { all: "ALL", legs: "LEGS", chest: "CHEST", back: "BACK", shoulders: "SHOULDERS", arms: "ARMS", core: "CORE", mobility: "MOBILITY", cardio: "CARDIO" },
    safety: {
      legs: "Use a comfortable range of motion and keep a steady base.", chest: "Keep your torso aligned and breathe steadily.",
      back: "Move smoothly without jerking or overextending.", shoulders: "Keep shoulders away from your ears and control the range.",
      arms: "Maintain a steady pace and stable elbow position.", core: "Control your torso and stop if you lose stability.",
      mobility: "Do not push through pain; increase range gradually.", cardio: "Start at a comfortable pace and stay balanced."
    }
  }
};

const tracked = [
  { id: "squat", cat: "legs", view: "side", name: ["Приседания", "Squat"], desc: ["Базовое упражнение для ног и нижней части тела.", "A foundational movement for the legs and lower body."], muscle: ["Квадрицепсы · Ягодицы · Задняя поверхность бедра", "Quadriceps · Glutes · Hamstrings"], level: "easy" },
  { id: "pushup", cat: "chest", view: "side", name: ["Отжимания", "Push-up"], desc: ["Упражнение с собственным весом для груди, плеч и трицепса.", "A bodyweight movement for chest, shoulders and triceps."], muscle: ["Грудь · Трицепс · Передняя дельта · Кор", "Chest · Triceps · Front delts · Core"], level: "medium" },
  { id: "armraise", cat: "shoulders", view: "front", name: ["Подъём рук", "Arm Raise"], desc: ["Контролируемое движение плечевого пояса с отслеживанием положения обеих рук.", "A controlled shoulder movement that tracks both arms."], muscle: ["Плечи · Верх спины", "Shoulders · Upper back"], level: "easy" },
  { id: "sidebend", cat: "core", view: "front", name: ["Боковые наклоны", "Side Bend"], desc: ["Боковые наклоны корпуса для работы над контролем корпуса и мобильностью.", "Side bends for torso control and mobility."], muscle: ["Косые мышцы живота · Кор", "Obliques · Core"], level: "easy" }
];

// [category, Russian name, English name, Russian technique, English technique, Russian muscles, English muscles, level]
const libraryRows = [
  ["legs", "Выпады", "Lunges", "Сделайте шаг вперёд и опуститесь, сохраняя устойчивость.", "Step forward and lower with control.", "Квадрицепсы · Ягодицы", "Quadriceps · Glutes", "easy"],
  ["legs", "Болгарские выпады", "Bulgarian Split Squat", "Поставьте заднюю ногу на опору и плавно согните переднюю.", "Rest the rear foot on a support and lower through the front leg.", "Квадрицепсы · Ягодицы", "Quadriceps · Glutes", "hard"],
  ["legs", "Ягодичный мост", "Glute Bridge", "Лёжа на спине, поднимайте таз до прямой линии корпуса.", "Lie on your back and lift the hips until the torso is aligned.", "Ягодицы · Задняя поверхность бедра", "Glutes · Hamstrings", "easy"],
  ["legs", "Подъём на носки", "Calf Raise", "Поднимайтесь на носки и медленно опускайте пятки.", "Rise onto your toes and lower your heels slowly.", "Икроножные", "Calves", "easy"],
  ["legs", "Статический стул", "Wall Sit", "Прижмитесь спиной к стене и удерживайте положение сидя.", "Lean against a wall and hold a seated position.", "Квадрицепсы · Ягодицы", "Quadriceps · Glutes", "medium"],
  ["legs", "Step-up", "Step-up", "Поднимитесь на устойчивую платформу одной ногой и опуститесь.", "Step onto a stable platform with one leg and lower down.", "Квадрицепсы · Ягодицы", "Quadriceps · Glutes", "medium"],
  ["chest", "Отжимания широким хватом", "Wide Push-up", "Поставьте ладони шире плеч и опускайте корпус целиком.", "Place hands wider than shoulders and lower the torso together.", "Грудь · Трицепс", "Chest · Triceps", "medium"],
  ["chest", "Отжимания узким хватом", "Close-grip Push-up", "Поставьте ладони ближе и ведите локти вдоль корпуса.", "Bring hands closer and keep elbows near the torso.", "Трицепс · Грудь", "Triceps · Chest", "hard"],
  ["chest", "Отжимания с колен", "Knee Push-up", "Опирайтесь на колени и опускайте корпус ровной линией.", "Support yourself on your knees and lower in one line.", "Грудь · Трицепс", "Chest · Triceps", "easy"],
  ["back", "Superman", "Superman", "Лёжа на животе, слегка поднимите руки и ноги, затем опустите.", "Lie face down; lift arms and legs slightly, then lower.", "Разгибатели спины · Ягодицы", "Back extensors · Glutes", "easy"],
  ["back", "Bird Dog", "Bird Dog", "На четвереньках вытяните противоположные руку и ногу.", "On all fours, extend opposite arm and leg.", "Спина · Кор", "Back · Core", "easy"],
  ["back", "Reverse Snow Angel", "Reverse Snow Angel", "Лёжа на животе, плавно проведите руками вдоль корпуса.", "Face down, sweep the arms slowly along the body.", "Верх спины · Плечи", "Upper back · Shoulders", "medium"],
  ["shoulders", "Круговые движения руками", "Arm Circles", "Опишите руками небольшие круги, не поднимая плечи.", "Make small circles with your arms without shrugging.", "Плечи", "Shoulders", "easy"],
  ["shoulders", "Front Raise", "Front Raise", "Поднимайте руки перед собой до комфортной высоты.", "Raise your arms in front of you to a comfortable height.", "Передняя дельта", "Front delts", "easy"],
  ["shoulders", "Lateral Raise", "Lateral Raise", "Поднимайте руки в стороны без рывка и опускайте плавно.", "Lift arms out to the sides without swinging; lower slowly.", "Средняя дельта", "Side delts", "medium"],
  ["shoulders", "Wall Angels", "Wall Angels", "Проводите руками вдоль стены, сохраняя контакт спины с опорой.", "Slide arms along a wall while keeping your back supported.", "Плечи · Верх спины", "Shoulders · Upper back", "easy"],
  ["arms", "Triceps Extension", "Triceps Extension", "Разгибайте руки в локтях, удерживая плечи на месте.", "Extend the elbows while keeping upper arms steady.", "Трицепс", "Triceps", "medium"],
  ["arms", "Diamond Push-up", "Diamond Push-up", "Сведите ладони под грудью и опускайтесь контролируемо.", "Place hands close below the chest and lower with control.", "Трицепс · Грудь", "Triceps · Chest", "hard"],
  ["arms", "Isometric Curl", "Isometric Curl", "Удерживайте согнутые руки без движения в удобной позиции.", "Hold the arms bent in a comfortable position without moving.", "Бицепс", "Biceps", "easy"],
  ["core", "Планка", "Plank", "Удерживайте прямую линию от головы до пяток.", "Hold a straight line from head to heels.", "Кор · Плечи", "Core · Shoulders", "medium"],
  ["core", "Side Plank", "Side Plank", "Удерживайте боковую опору с ровным корпусом.", "Hold a side support with the torso aligned.", "Косые мышцы живота", "Obliques", "medium"],
  ["core", "Dead Bug", "Dead Bug", "Лёжа на спине, вытягивайте противоположные руку и ногу.", "On your back, extend opposite arm and leg.", "Кор", "Core", "easy"],
  ["core", "Mountain Climber", "Mountain Climber", "Из упора поочерёдно подтягивайте колени к груди.", "From a plank, bring knees toward the chest alternately.", "Кор · Ноги", "Core · Legs", "medium"],
  ["core", "Bicycle Crunch", "Bicycle Crunch", "Поочерёдно направляйте локоть к противоположному колену.", "Bring each elbow toward the opposite knee in turn.", "Косые мышцы живота · Кор", "Obliques · Core", "medium"],
  ["mobility", "Cat-Cow", "Cat-Cow", "На четвереньках плавно округляйте и разгибайте спину.", "On all fours, gently round and extend the spine.", "Спина · Кор", "Back · Core", "easy"],
  ["mobility", "Shoulder Rotation", "Shoulder Rotation", "Плавно вращайте плечами в комфортной амплитуде.", "Rotate the shoulders smoothly through a comfortable range.", "Плечи · Верх спины", "Shoulders · Upper back", "easy"],
  ["mobility", "Hip Rotation", "Hip Rotation", "Выполняйте круговые движения тазом без резких поворотов.", "Circle the hips gently without sudden turns.", "Тазобедренные · Кор", "Hips · Core", "easy"],
  ["cardio", "Jumping Jacks", "Jumping Jacks", "Разводите ноги и поднимайте руки в одном ритме.", "Step or jump the feet apart while raising the arms.", "Ноги · Плечи", "Legs · Shoulders", "easy"],
  ["cardio", "High Knees", "High Knees", "Поочерёдно поднимайте колени в удобном темпе.", "Lift the knees alternately at a comfortable pace.", "Ноги · Кор", "Legs · Core", "medium"]
];
const exercises = [...tracked, ...libraryRows.map((row, index) => ({
  id: `library-${index}`, cat: row[0], name: [row[1], row[2]], desc: [row[3], row[4]],
  muscle: [row[5], row[6]], level: row[7]
}))];

let lang = "ru";
let filter = "all";
let query = "";
let selected = null;
let initialized = false;
const $ = (tag, className, value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};
const localized = (pair) => pair[lang === "en" ? 1 : 0];

function makeCard(exercise, index, featured = false) {
  const t = copy[lang];
  const card = $("article", `library-card ${featured ? "is-featured" : ""} ${exercise.view ? "is-tracked" : ""}`);
  const top = $("div", "library-card-top");
  top.append($("span", "library-category", t.cats[exercise.cat]), $("span", `library-status ${exercise.view ? "is-live" : ""}`, exercise.view ? t.available : t.soon));
  const visual = $("div", "library-visual");
  visual.append($("span", "library-visual-mark", String(index + 1).padStart(2, "0")), $("span", "library-visual-symbol", exercise.view ? "↗" : "◇"));
  const name = $("h4", "library-card-name", localized(exercise.name));
  const desc = $("p", "library-card-desc", localized(exercise.desc));
  const muscle = $("p", "library-card-muscle");
  muscle.append($("span", "library-meta-label", t.muscles), $("strong", "", localized(exercise.muscle)));
  card.append(top, visual, name, desc, muscle);
  if (exercise.view) {
    const view = $("p", "library-view", `${t.view}: ${t[exercise.view]}`);
    card.append(view);
    if (featured) card.append($("p", "library-note", t.trackedNote));
  }
  const action = $("button", `library-action ${exercise.view ? "is-live" : ""}`, exercise.view ? t.start : t.details);
  action.type = "button";
  action.addEventListener("click", () => exercise.view ? document.querySelector("#start-button")?.click() : openDetails(exercise));
  card.append(action);
  return card;
}

function renderDetails() {
  const dialog = document.querySelector("#exercise-details-dialog");
  if (!dialog || !selected) return;
  const t = copy[lang];
  dialog.replaceChildren();
  const close = $("button", "library-dialog-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", t.close);
  close.addEventListener("click", () => dialog.close());
  const badge = $("span", "library-status", t.soon);
  const title = $("h3", "library-dialog-title", localized(selected.name));
  const details = $("div", "library-dialog-meta");
  details.append($("span", "", t.cats[selected.cat]), $("span", "", `${t.difficulty}: ${t.levels[selected.level]}`));
  const technique = $("div", "library-dialog-block");
  technique.append($("strong", "", t.technique), $("p", "", localized(selected.desc)));
  const muscles = $("div", "library-dialog-block");
  muscles.append($("strong", "", t.muscles), $("p", "", localized(selected.muscle)));
  const safety = $("div", "library-dialog-block");
  safety.append($("strong", "", t.safetyLabel), $("p", "", t.safety[selected.cat]));
  dialog.append(close, badge, title, details, technique, muscles, safety);
}

function openDetails(exercise) {
  selected = exercise;
  renderDetails();
  document.querySelector("#exercise-details-dialog")?.showModal();
}

function renderCards() {
  const root = document.querySelector("#exercise-library-content");
  if (!root) return;
  const t = copy[lang];
  const matches = exercises.filter(e => (filter === "all" || e.cat === filter) &&
    (!query || `${localized(e.name)} ${t.cats[e.cat]}`.toLocaleLowerCase(lang).includes(query.toLocaleLowerCase(lang))));
  const featuredItems = matches.filter(e => e.view);
  const featured = $("section", "library-featured");
  const featuredTitle = $("h3", "library-subheading", t.featured);
  const featuredGrid = $("div", "library-featured-grid");
  featuredItems.forEach(e => featuredGrid.append(makeCard(e, exercises.indexOf(e), true)));
  featured.append(featuredTitle, featuredGrid);
  featured.hidden = featuredItems.length === 0;
  const all = $("section", "library-all");
  const allHeading = $("div", "library-all-heading");
  allHeading.append($("h3", "library-subheading", t.all), $("span", "library-count", `${matches.length} ${t.count}`));
  const grid = $("div", "library-grid");
  matches.forEach(e => grid.append(makeCard(e, exercises.indexOf(e))));
  if (!matches.length) grid.append($("p", "library-empty", t.noResults));
  all.append(allHeading, grid);
  root.querySelector(".library-results")?.replaceChildren(featured, all);
}

export function setExerciseLibraryLanguage(nextLang) {
  lang = nextLang === "en" ? "en" : "ru";
  if (!initialized) return;
  const t = copy[lang];
  const search = document.querySelector("#exercise-search");
  search.placeholder = t.search;
  search.setAttribute("aria-label", t.search);
  document.querySelectorAll(".library-filter").forEach(button => {
    button.textContent = t.cats[button.dataset.category];
  });
  renderCards();
  renderDetails();
}

export function initExerciseLibrary(nextLang = "ru") {
  lang = nextLang === "en" ? "en" : "ru";
  if (initialized) return setExerciseLibraryLanguage(lang);
  const root = document.querySelector("#exercise-library-content");
  if (!root) return;
  const controls = $("div", "library-controls");
  const search = $("input", "library-search");
  search.id = "exercise-search";
  search.type = "search";
  search.autocomplete = "off";
  search.addEventListener("input", () => { query = search.value.trim(); renderCards(); });
  const filters = $("div", "library-filters");
  filters.setAttribute("role", "group");
  categories.forEach(category => {
    const button = $("button", "library-filter");
    button.type = "button";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === filter));
    button.addEventListener("click", () => {
      filter = category;
      filters.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.category === filter)));
      renderCards();
    });
    filters.append(button);
  });
  controls.append(search, filters);
  const results = $("div", "library-results");
  root.append(controls, results);
  const dialog = $("dialog", "library-dialog");
  dialog.id = "exercise-details-dialog";
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  root.append(dialog);
  initialized = true;
  setExerciseLibraryLanguage(lang);
}

export const exerciseLibraryCount = exercises.length;
