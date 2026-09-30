// MOTION TRACKER — Interactive Controller, Authentication & Multilingual Layer
import {
  getCurrentUser,
  loginUser,
  registerUser,
  loginDemoUser,
  logoutUser,
  subscribeApi
} from "./api.js";
import { initExerciseLibrary, setExerciseLibraryLanguage } from "./ui/exerciseLibrary.js";
import { clearAnalytics, initAnalytics, refreshAnalytics, setAnalyticsLanguage } from "./ui/analytics.js";
import { PROGRAMS } from "./programs.js";

const PROGRAM_UI = {
  ru: {
    names: { "full-body": "ВСЁ ТЕЛО", strength: "СИЛОВАЯ", light: "ЛЁГКАЯ" },
    descriptions: { "full-body": "Сбалансированная тренировка всего тела.", strength: "Короткая силовая программа.", light: "Мягкая тренировка для перерыва." },
    exercises: { squat: "Приседания", armraise: "Подъём рук", sidebend: "Боковые наклоны", pushup: "Отжимания" },
    difficulty: { "full-body": "СРЕДНЯЯ", strength: "ВЫШЕ СРЕДНЕЙ", light: "НАЧАЛЬНАЯ" },
    workout: "ТРЕНИРОВКА", available: "ДОСТУПНА", reps: "повт.", count: "упражнения", minutes: "МИН", level: "СЛОЖНОСТЬ", start: "НАЧАТЬ ТРЕНИРОВКУ"
  },
  en: {
    names: { "full-body": "FULL BODY", strength: "STRENGTH", light: "LIGHT" },
    descriptions: { "full-body": "Balanced full-body movement.", strength: "A short strength circuit.", light: "A gentle movement break." },
    exercises: { squat: "Squat", armraise: "Arm Raise", sidebend: "Side Bend", pushup: "Push-up" },
    difficulty: { "full-body": "INTERMEDIATE", strength: "CHALLENGING", light: "BEGINNER" },
    workout: "WORKOUT", available: "AVAILABLE", reps: "reps", count: "exercises", minutes: "MIN", level: "DIFFICULTY", start: "START WORKOUT"
  }
};

function translateProgramCards(lang) {
  const t = PROGRAM_UI[lang] || PROGRAM_UI.ru;
  document.querySelectorAll("#program-cards .program-card").forEach((card, index) => {
    const program = PROGRAMS[index];
    if (!program) return;
    card.querySelector(".program-badge").textContent = `${t.workout} ${program.workoutNumber} · ${t.available}`;
    card.querySelector("h3").textContent = t.names[program.id];
    card.querySelector(".program-exercises").replaceChildren(...program.exercises.map(item => {
      const row = document.createElement("span");
      row.textContent = `${t.exercises[item.id]} · ${item.targetReps} ${t.reps}`;
      return row;
    }));
    card.querySelector(".program-exercises + p").textContent = t.descriptions[program.id];
    card.querySelector(".program-meta").textContent = `~${program.durationMinutes} ${t.minutes} · ${program.exercises.length} ${t.count} · ${t.level}: ${t.difficulty[program.id]}`;
    card.querySelector(".program-action").textContent = t.start;
  });
}

// Multilingual Dictionary (RU / EN)
const TRANSLATIONS = {
  ru: {
    nav_home: "Главная",
    nav_exercises: "Упражнения",
    nav_guide: "Как пользоваться",
    nav_workout: "Тренировки",
    nav_stats: "Аналитика",
    library_kicker: "ДВИЖЕНИЕ / КАТАЛОГ",
    library_title: "БИБЛИОТЕКА УПРАЖНЕНИЙ",
    library_subtitle: "Выберите движение, изучите технику и запустите отслеживание для поддерживаемых упражнений.",
    analytics_kicker: "ДАННЫЕ / ПРОГРЕСС",
    analytics_title: "АНАЛИТИКА ТРЕНИРОВОК",
    analytics_subtitle: "Следите за активностью, количеством повторений и историей тренировок.",
    workout_preview_kicker: "ИНТЕРФЕЙС / ПРЕВЬЮ",
    workout_preview_note: "Показатели ниже демонстрируют интерфейс. Реальные результаты появятся после тренировки.",
    sensors_active: "Датчики активны",
    btn_login: "Войти",
    btn_signup: "Регистрация",
    btn_logout: "Выйти из аккаунта",
    tab_login: "Вход",
    tab_register: "Регистрация",
    lbl_email: "Email адрес",
    lbl_password: "Пароль",
    lbl_forgot: "Забыли пароль?",
    btn_submit_login: "ВОЙТИ В АККАУНТ",
    auth_or: "или",
    btn_demo_athlete: "Войти как демо-атлет (в 1 клик)",
    lbl_name: "Имя и фамилия",
    lbl_confirm_password: "Подтвердите пароль",
    btn_submit_register: "СОЗДАТЬ АККАУНТ",
    terms_note: "Регистрируясь, вы соглашаетесь с правилами сервиса и безопасной локальной обработкой данных.",
    hero_badge: "MOTION TRACKER 2.0",
    hero_h1_1: "КАЖДОЕ",
    hero_h1_2: "ПОВТОРЕНИЕ —",
    hero_h1_3: "ПРОГРЕСС.",
    hero_sub: "Система отслеживает движения через веб-камеру и автоматически считает повторения прямо на вашем устройстве.",
    btn_start_training: "НАЧАТЬ ТРЕНИРОВКУ",
    btn_calibrate: "КАЛИБРОВКА КАМЕРЫ",
    hero_live_stat: "33 ТОЧКИ СУСТАВОВ • 60 FPS",
    guide_kicker: "ИНСТРУКЦИЯ",
    guide_title: "КАК ЭТО РАБОТАЕТ",
    guide_desc: "Всего 3 простых шага, чтобы начать тренироваться с умным контроллером движений:",
    step1_title: "Включите веб-камеру",
    step1_desc: "Нажмите «Начать тренировку» и разрешите доступ к камере. Все кадры анализируются прямо на вашем устройстве.",
    step2_title: "Отойдите на 1.5–2 метра",
    step2_desc: "Поставьте устройство на уровне пояса и отойдите назад, чтобы в объективе было видно всё тело с головы до стоп.",
    step3_title: "Выполняйте упражнение",
    step3_desc: "Система отслеживает положение суставов, углы движения и автоматически считает корректные повторения.",
    tab_pushup: "Отжимания",
    tab_squat: "Приседания",
    body_in_frame: "ТЕЛО В КАДРЕ",
    form_accuracy: "Точность формы:",
    kinematic_strip: "Кинематическая модель v1.4 | Задержка: 12мс",
    notice_ready: "Оптимальная видимость • Готов к калибровке",
    btn_launch_camera: "ЗАПУСТИТЬ ТРЕНИРОВКУ ПО КАМЕРЕ",
    stat_reps: "ПОВТОРЕНИЯ",
    unit_reps: "повт",
    set_num: "Текущий подход:",
    motion_in_progress: "ИДЁТ ДВИЖЕНИЕ",
    phase_label: "ФАЗА ДВИЖЕНИЯ:",
    phase_eccentric: "Эксцентрик",
    phase_concentric: "Концентрик",
    phase_speed: "Скорость: 0.72 м/с",
    stat_sets: "ПОДХОДЫ",
    stat_time: "ВРЕМЯ",
    stat_tempo: "Темп: 1.2сек / 2.3сек",
    goal_today: "ЦЕЛЬ НА СЕГОДНЯ",
    goal_remaining: "Осталось 40 повторений до рекорда дня",
    coach_title: "ПОДСКАЗКА ТРЕНЕРА:",
    coach_text: "Держите корпус прямым от головы до стоп, опускайтесь до угла 90° в локтях. Не роняйте таз на подъем.",
    weekly_title: "АКТИВНОСТЬ ЗА НЕДЕЛЮ",
    weekly_sub: "Суммарный объем повторений",
    weekly_record: "Чт: 120 повт (Рекорд)",
    day_mon: "Пн",
    day_tue: "Вт",
    day_wed: "Ср",
    day_thu: "Чт",
    day_fri: "Пт",
    day_sat: "Сб",
    day_sun: "Вс",
    history_title: "ИСТОРИЯ ТРЕНИРОВОК",
    history_count: "3 ПОСЛЕДНИХ",
    hist_pushup: "Отжимания",
    hist_squat: "Приседания",
    history_link: "СМОТРЕТЬ ВСЮ АНАЛИТИКУ СЕССИЙ →",
    check_cam_title: "Камера отключена?",
    check_cam_desc: "Проверьте доступ к объективу в настройках браузера.",
    check_body_title: "Тело вне кадра?",
    check_body_desc: "Отойдите на шаг назад и поставьте устройство на уровне пояса.",
    sensors_ok: "СЕНСОРЫ 100% ОК",
    cam_live: "ТРЕКИНГ В РЕАЛЬНОМ ВРЕМЕНИ",
    cam_title: "КАМЕРА ТРЕНИРОВКИ",
    cam_intro: "Ваше тело — контроллер. Видеопоток обрабатывается локально и не покидает ваше устройство.",
    prog_kicker: "ПРОГРАММЫ ТРЕНИРОВОК",
    prog_title: "ВЫБЕРИТЕ ТРЕНИРОВКУ",
    prog_intro: "Выберите тренировку, чтобы просмотреть упражнения перед стартом.",
    ex_next_kicker: "СЛЕДУЮЩЕЕ УПРАЖНЕНИЕ",
    btn_start_exercise: "НАЧАТЬ УПРАЖНЕНИЕ",
    btn_back_programs: "НАЗАД К ПРОГРАММАМ",
    btn_prep_next: "ПОДГОТОВИТЬ СЛЕДУЮЩЕЕ",
    btn_return_programs: "← ВЕРНУТЬСЯ К ПРОГРАММАМ",
    btn_repeat: "ПОВТОРИТЬ ТРЕНИРОВКУ",
    btn_back_menu: "← ВЕРНУТЬСЯ В МЕНЮ",
    rest_kicker: "УПРАЖНЕНИЕ ВЫПОЛНЕНО",
    rest_title: "ОТДЫХ",
    rest_next_label: "ДАЛЕЕ",
    results_kicker: "СЕССИЯ ЗАВЕРШЕНА",
    results_title: "ИТОГИ ТРЕНИРОВКИ",
    res_count: "ВЫПОЛНЕНО УПРАЖНЕНИЙ",
    res_dur: "ДЛИТЕЛЬНОСТЬ",
    res_status: "СТАТУС",
    res_done: "Завершено",
    cam_wait_title: "ОЖИДАНИЕ КАМЕРЫ",
    cam_wait_sub: "Встаньте в поле зрения объектива",
    privacy_note: "◈ Видео не покидает ваше устройство.",
    footer_tag: "ВАШЕ ТЕЛО — КОНТРОЛЛЕР",
    foot_guide: "Инструкция",
    foot_sensors: "Сенсоры",
    foot_privacy: "Конфиденциальность",
  },
  en: {
    nav_home: "Home",
    nav_exercises: "Exercises",
    nav_guide: "How It Works",
    nav_workout: "Workouts",
    nav_stats: "Analytics",
    library_kicker: "MOVEMENT / CATALOG",
    library_title: "EXERCISE LIBRARY",
    library_subtitle: "Choose a movement, learn its technique, and start tracking supported exercises.",
    analytics_kicker: "DATA / PROGRESS",
    analytics_title: "WORKOUT ANALYTICS",
    analytics_subtitle: "Follow your activity, repetition counts, and workout history.",
    workout_preview_kicker: "INTERFACE / PREVIEW",
    workout_preview_note: "The figures below preview the interface. Your actual results appear after a workout.",
    sensors_active: "Sensors Active",
    btn_login: "Log In",
    btn_signup: "Sign Up",
    btn_logout: "Log Out",
    tab_login: "Log In",
    tab_register: "Sign Up",
    lbl_email: "Email Address",
    lbl_password: "Password",
    lbl_forgot: "Forgot password?",
    btn_submit_login: "LOG IN TO ACCOUNT",
    auth_or: "or",
    btn_demo_athlete: "Log in as Demo Athlete (1-click)",
    lbl_name: "Full Name",
    lbl_confirm_password: "Confirm Password",
    btn_submit_register: "CREATE ACCOUNT",
    terms_note: "By signing up, you agree to service terms and on-device private processing.",
    hero_badge: "MOTION TRACKER 2.0",
    hero_h1_1: "EVERY",
    hero_h1_2: "REPETITION IS",
    hero_h1_3: "PROGRESS.",
    hero_sub: "The system tracks movement through your webcam and counts repetitions automatically, right on your device.",
    btn_start_training: "START WORKOUT",
    btn_calibrate: "CALIBRATE CAMERA",
    hero_live_stat: "33 SKELETON POINTS • 60 FPS",
    guide_kicker: "INSTRUCTIONS",
    guide_title: "HOW IT WORKS",
    guide_desc: "Only 3 simple steps to start training with your body as the controller:",
    step1_title: "Enable Webcam",
    step1_desc: "Click 'Start Workout' and grant camera permission. Video frames stay securely on your device.",
    step2_title: "Step Back 1.5–2 Meters",
    step2_desc: "Place your device at waist level and step back so your full body is in frame from head to toe.",
    step3_title: "Perform Exercises",
    step3_desc: "The system tracks joint positions and movement angles, then automatically counts correct repetitions.",
    tab_pushup: "Push-ups",
    tab_squat: "Squats",
    body_in_frame: "BODY IN FRAME",
    form_accuracy: "Form Accuracy:",
    kinematic_strip: "Kinematic Model v1.4 | Latency: 12ms",
    notice_ready: "Optimal visibility • Ready for calibration",
    btn_launch_camera: "LAUNCH CAMERA WORKOUT",
    stat_reps: "REPETITIONS",
    unit_reps: "reps",
    set_num: "Current Set:",
    motion_in_progress: "MOTION ACTIVE",
    phase_label: "MOTION PHASE:",
    phase_eccentric: "Eccentric",
    phase_concentric: "Concentric",
    phase_speed: "Velocity: 0.72 m/s",
    stat_sets: "SETS",
    stat_time: "TIME",
    stat_tempo: "Tempo: 1.2s / 2.3s",
    goal_today: "DAILY GOAL",
    goal_remaining: "40 reps remaining to beat your record",
    coach_title: "COACH TIP:",
    coach_text: "Keep your spine aligned from head to heels, lower to a 90° elbow angle. Keep hips steady on the ascent.",
    weekly_title: "WEEKLY ACTIVITY",
    weekly_sub: "Total Repetition Volume",
    weekly_record: "Thu: 120 reps (Record)",
    day_mon: "Mon",
    day_tue: "Tue",
    day_wed: "Wed",
    day_thu: "Thu",
    day_fri: "Fri",
    day_sat: "Sat",
    day_sun: "Sun",
    history_title: "WORKOUT HISTORY",
    history_count: "LAST 3 SESSIONS",
    hist_pushup: "Push-ups",
    hist_squat: "Squats",
    history_link: "VIEW FULL SESSION ANALYTICS →",
    check_cam_title: "Camera Disabled?",
    check_cam_desc: "Check camera permissions in your browser site settings.",
    check_body_title: "Body Out of Frame?",
    check_body_desc: "Take one step back and place device at waist height.",
    sensors_ok: "SENSORS 100% OK",
    cam_live: "REAL-TIME LIVE TRACKING",
    cam_title: "WORKOUT CAMERA",
    cam_intro: "Your body is the controller. Video frames are processed locally and never leave your device.",
    prog_kicker: "TRAINING PROGRAMS",
    prog_title: "CHOOSE YOUR WORKOUT",
    prog_intro: "Choose a workout to review its exercises before starting.",
    ex_next_kicker: "NEXT EXERCISE",
    btn_start_exercise: "START EXERCISE",
    btn_back_programs: "BACK TO WORKOUTS",
    btn_prep_next: "PREPARE NEXT EXERCISE",
    btn_return_programs: "← RETURN TO PROGRAMS",
    btn_repeat: "REPEAT WORKOUT",
    btn_back_menu: "← RETURN TO DASHBOARD",
    rest_kicker: "EXERCISE COMPLETED",
    rest_title: "REST & RECOVERY",
    rest_next_label: "NEXT UP",
    results_kicker: "SESSION FINISHED",
    results_title: "WORKOUT SUMMARY",
    res_count: "COMPLETED EXERCISES",
    res_dur: "DURATION",
    res_status: "STATUS",
    res_done: "Completed",
    cam_wait_title: "WAITING FOR CAMERA",
    cam_wait_sub: "Position yourself in front of the lens",
    privacy_note: "◈ Video stays on your device.",
    footer_tag: "YOUR BODY IS THE CONTROLLER",
    foot_guide: "Instructions",
    foot_sensors: "Sensors",
    foot_privacy: "Privacy",
  },
};

let currentLang = localStorage.getItem("motion_lang") || "ru";

export function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("motion_lang", lang);
  document.documentElement.lang = lang;

  // Update RU / EN buttons active state
  document.querySelector("#lang-ru")?.classList.toggle("is-active", lang === "ru");
  document.querySelector("#lang-en")?.classList.toggle("is-active", lang === "en");

  const dict = TRANSLATIONS[lang] || TRANSLATIONS.ru;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });
  setExerciseLibraryLanguage(lang);
  setAnalyticsLanguage(lang);
  translateProgramCards(lang);

  // Re-sync dynamic auth strings if logged in
  refreshAuthState();
  renderSaveStatus();
}

/* ==========================================================================
   AUTHENTICATION UI LOGIC
   ========================================================================== */

function showAuthAlert(msg, type = "error") {
  const alertEl = document.querySelector("#auth-alert");
  if (!alertEl) return;
  alertEl.className = `auth-alert is-${type}`;
  alertEl.textContent = msg;
  alertEl.hidden = false;
}

function clearAuthAlert() {
  const alertEl = document.querySelector("#auth-alert");
  if (!alertEl) return;
  alertEl.textContent = "";
  alertEl.hidden = true;
  alertEl.className = "auth-alert";
}

function switchAuthTab(tab) {
  clearAuthAlert();
  const tabLogin = document.querySelector("#tab-auth-login");
  const tabRegister = document.querySelector("#tab-auth-register");
  const formLogin = document.querySelector("#form-login");
  const formRegister = document.querySelector("#form-register");

  if (tab === "register") {
    tabLogin?.classList.remove("is-active");
    tabLogin?.setAttribute("aria-selected", "false");
    tabRegister?.classList.add("is-active");
    tabRegister?.setAttribute("aria-selected", "true");
    if (formLogin) formLogin.hidden = true;
    if (formRegister) {
      formRegister.hidden = false;
      document.querySelector("#reg-name")?.focus();
    }
  } else {
    tabRegister?.classList.remove("is-active");
    tabRegister?.setAttribute("aria-selected", "false");
    tabLogin?.classList.add("is-active");
    tabLogin?.setAttribute("aria-selected", "true");
    if (formRegister) formRegister.hidden = true;
    if (formLogin) {
      formLogin.hidden = false;
      document.querySelector("#login-email")?.focus();
    }
  }
}

export function openAuthModal(tab = "login") {
  const modal = document.querySelector("#auth-modal");
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  switchAuthTab(tab);
}

export function closeAuthModal() {
  const modal = document.querySelector("#auth-modal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  clearAuthAlert();
}

export async function refreshAuthState() {
  const generation = ++profileGeneration;
  const res = await getCurrentUser();
  if (generation !== profileGeneration) return;
  const authButtons = document.querySelector("#auth-buttons-group");
  const profileMenu = document.querySelector("#user-profile-menu");
  const displayName = document.querySelector("#user-display-name");
  const dropdownName = document.querySelector("#dropdown-name");
  const dropdownEmail = document.querySelector("#dropdown-email");
  const dropdownLevel = document.querySelector("#dropdown-level");
  const avatarImg = document.querySelector("#user-avatar-img");
  const dropdownPanel = document.querySelector("#user-dropdown-panel");

  if (res.ok && res.data) {
    const user = res.data;
    if (authButtons) authButtons.hidden = true;
    if (profileMenu) profileMenu.hidden = false;
    const firstName = user.name ? user.name.split(" ")[0] : "Атлет";
    if (displayName) displayName.textContent = firstName;
    if (dropdownName) dropdownName.textContent = user.name;
    if (dropdownEmail) dropdownEmail.textContent = user.email;
    if (dropdownLevel) dropdownLevel.textContent = currentLang === "en" ? "Athlete" : "Атлет";
    if (avatarImg && user.avatar) avatarImg.src = user.avatar;
  } else {
    if (authButtons) authButtons.hidden = false;
    if (profileMenu) profileMenu.hidden = true;
    if (dropdownPanel) dropdownPanel.hidden = true;
  }
}

function initAuthHandlers() {
  // Modal Open buttons
  document.querySelector("#btn-open-login")?.addEventListener("click", () => openAuthModal("login"));
  document.querySelector("#btn-open-signup")?.addEventListener("click", () => openAuthModal("register"));

  // Modal Close buttons & Backdrop
  document.querySelector("#auth-modal-close")?.addEventListener("click", closeAuthModal);
  document.querySelector("#auth-backdrop")?.addEventListener("click", closeAuthModal);

  // Tab switching
  document.querySelector("#tab-auth-login")?.addEventListener("click", () => switchAuthTab("login"));
  document.querySelector("#tab-auth-register")?.addEventListener("click", () => switchAuthTab("register"));

  // Escape key listener for modal and dropdown
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAuthModal();
      const dropdownPanel = document.querySelector("#user-dropdown-panel");
      if (dropdownPanel) dropdownPanel.hidden = true;
    }
  });

  // Password Visibility Toggles
  document.querySelectorAll(".btn-toggle-pwd").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;
      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
        btn.setAttribute("aria-label", "Скрыть пароль");
      } else {
        input.type = "password";
        btn.textContent = "👁";
        btn.setAttribute("aria-label", "Показать пароль");
      }
    });
  });

  // Forgot password helper
  document.querySelector("#link-forgot-pass")?.addEventListener("click", (e) => {
    e.preventDefault();
    showAuthAlert(
      currentLang === "en"
        ? "💡 For demo testing, use the 1-click 'Demo Athlete' button or create a new account."
        : "💡 Для тестирования используйте быстрый вход «Войти как демо-атлет» в 1 клик или создайте новый аккаунт.",
      "success"
    );
  });

  // Login Form Submit
  const formLogin = document.querySelector("#form-login");
  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthAlert();
    const emailInput = document.querySelector("#login-email");
    const passwordInput = document.querySelector("#login-password");
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;

    const res = await loginUser({ email, password });
    if (!res.ok) {
      showAuthAlert(res.error, "error");
      return;
    }

    showAuthAlert(
      currentLang === "en" ? "✓ Logged in successfully! Loading profile..." : "✓ Успешный вход! Загрузка профиля...",
      "success"
    );
    setTimeout(() => {
      closeAuthModal();
      formLogin.reset();
      refreshAuthState();
    }, 450);
  });

  // Register Form Submit
  const formRegister = document.querySelector("#form-register");
  formRegister?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAuthAlert();
    const nameInput = document.querySelector("#reg-name");
    const emailInput = document.querySelector("#reg-email");
    const passwordInput = document.querySelector("#reg-password");
    const confirmInput = document.querySelector("#reg-confirm-password");

    const name = nameInput?.value?.trim();
    const email = emailInput?.value?.trim();
    const password = passwordInput?.value;
    const confirm = confirmInput?.value;

    if (password !== confirm) {
      showAuthAlert(currentLang === "en" ? "Passwords do not match." : "Пароли не совпадают.", "error");
      return;
    }

    if (password.length < 6) {
      showAuthAlert(
        currentLang === "en" ? "Password must be at least 6 characters." : "Пароль должен быть не менее 6 символов.",
        "error"
      );
      return;
    }

    const res = await registerUser({ name, email, password });
    if (!res.ok) {
      showAuthAlert(res.error, "error");
      return;
    }

    showAuthAlert(
      currentLang === "en" ? "✓ Account created! Welcome aboard!" : "✓ Аккаунт успешно создан! Добро пожаловать!",
      "success"
    );
    setTimeout(() => {
      closeAuthModal();
      formRegister.reset();
      refreshAuthState();
    }, 450);
  });

  // 1-Click Demo Athlete Login
  document.querySelector("#btn-login-demo")?.addEventListener("click", async () => {
    clearAuthAlert();
    const res = await loginDemoUser();
    if (res.ok) {
      showAuthAlert(
        currentLang === "en" ? "✓ Demo account ready!" : "✓ Демо-аккаунт готов!",
        "success"
      );
      setTimeout(() => {
        closeAuthModal();
        refreshAuthState();
      }, 350);
    } else showAuthAlert(res.error, "error");
  });

  // Logout button
  document.querySelector("#btn-logout")?.addEventListener("click", async () => {
    const res = await logoutUser();
    if (!res.ok) { openAuthModal(); showAuthAlert(res.error); return; }
    const dropdownPanel = document.querySelector("#user-dropdown-panel");
    if (dropdownPanel) dropdownPanel.hidden = true;
    refreshAuthState();
  });

  // Profile Dropdown Toggle
  const userProfileBtn = document.querySelector("#user-profile-btn");
  const dropdownPanel = document.querySelector("#user-dropdown-panel");

  userProfileBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdownPanel) {
      const isHidden = dropdownPanel.hidden;
      dropdownPanel.hidden = !isHidden;
      userProfileBtn.setAttribute("aria-expanded", String(isHidden));
    }
  });

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (dropdownPanel && !dropdownPanel.hidden && !e.target.closest("#user-profile-menu")) {
      dropdownPanel.hidden = true;
      userProfileBtn?.setAttribute("aria-expanded", "false");
    }
  });
}

/* ==========================================================================
   WORKOUT SAVE STATUS
   ========================================================================== */

let profileGeneration = 0;
let saveState = null;

function renderSaveStatus() {
  let element = document.querySelector("#workout-save-status");
  const screen = document.querySelector("#results-view");
  if (!screen || !saveState) return;
  if (!element) {
    element = document.createElement("p");
    element.id = "workout-save-status";
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    screen.append(element);
  }
  const en = currentLang === "en";
  element.textContent = saveState.status === "pending" ? (en ? "Saving workout…" : "Сохраняем тренировку…")
    : saveState.status === "saved" ? (en ? "Workout saved." : "Тренировка сохранена.")
    : (en ? "Workout was not saved. Results remain on this screen. " : "Тренировка не сохранена. Результат остаётся на экране. ") + (saveState.result?.error ?? "");
}

/* ==========================================================================
   GENERAL UI & NAVIGATION
   ========================================================================== */

function initMotionFeatures() {
  // Language button event listeners
  document.querySelector("#lang-ru")?.addEventListener("click", () => applyLanguage("ru"));
  document.querySelector("#lang-en")?.addEventListener("click", () => applyLanguage("en"));
  applyLanguage(currentLang);
  initExerciseLibrary(currentLang);
  initAnalytics(currentLang);

  // Initialize Authentication
  initAuthHandlers();
  subscribeApi(event => {
    if (event.type === "auth-changing") {
      clearAnalytics();
      ++profileGeneration;
    }
    if (event.type === "auth") {
      refreshAuthState();
      refreshAnalytics();
    }
    if (event.type === "save") {
      if (event.status !== "pending" && saveState?.id !== event.id) return;
      saveState = event;
      renderSaveStatus();
      if (event.status === "saved" && !event.stale) {
        refreshAnalytics();
      }
    }
  });

  // Exercise tabs (Отжимания / Приседания) with non-repeating photos
  const tabs = document.querySelectorAll(".ex-tab");
  const previewImg = document.querySelector("#preview-exercise-img");
  const repsVal = document.querySelector("#reps-display-val");
  const phaseVal = document.querySelector("#phase-display-val");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const ex = tab.getAttribute("data-exercise");

      if (ex === "squat") {
        if (previewImg) previewImg.src = "./assets/athlete_squat_motion.jpg";
        if (repsVal) repsVal.textContent = "18";
        if (phaseVal) {
          phaseVal.textContent = currentLang === "en" ? "Concentric" : "Концентрик";
        }
      } else {
        // Distinct Push-up photo for the preview viewport
        if (previewImg) previewImg.src = "./assets/august_work.jpg";
        if (repsVal) repsVal.textContent = "24";
        if (phaseVal) {
          phaseVal.textContent = currentLang === "en" ? "Eccentric" : "Эксцентрик";
        }
      }
    });
  });

  // Launch buttons connecting to camera flow
  const startBtn = document.querySelector("#start-button");
  const quickStart = document.querySelector("#btn-quick-start");
  const quickCalibrate = document.querySelector("#btn-calibrate-quick");

  if (quickStart && startBtn) {
    quickStart.addEventListener("click", () => startBtn.click());
  }
  if (quickCalibrate && startBtn) {
    quickCalibrate.addEventListener("click", () => startBtn.click());
  }

  // Smooth scroll links
  const navWorkout = document.querySelector("#nav-workout-link");
  const navStats = document.querySelector("#nav-stats-link");
  if (navWorkout) {
    navWorkout.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#workout-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
  if (navStats) {
    navStats.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#analytics-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
  document.querySelectorAll(".topbar-nav .nav-link").forEach(link => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".topbar-nav .nav-link").forEach(item => item.classList.remove("is-active"));
      link.classList.add("is-active");
    });
  });
}

// Start everything once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMotionFeatures);
} else {
  initMotionFeatures();
}
