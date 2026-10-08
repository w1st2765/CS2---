const app = document.getElementById("app");
const authArea = document.getElementById("auth-area");
const modalRoot = document.getElementById("modal-root");

const state = {
  user: null,
  options: { maps: [], weapons: [], avatars: [] },
  route: "/",
};

const MAP_INFO = {
  "Dust II": ["🏜️", "Классика дефьюза", "Самая узнаваемая карта серии. Средний боец, длинные углы и бесконечные дуэли на A-short."],
  "Mirage": ["🕌", "Фаворит соревнований", "Сбалансированный дефьюз с сильными A-site позициями и любимым A-ramp."],
  "Inferno": ["🌋", "Кофе и гранаты", "Плотные угры,香蕉 и обязательные молотовы на B-site."],
  "Nuke": ["☢️", "Два этажа", "Вертикальные бои, ротации через вентиляцию и рискованные ретейки."],
  "Overpass": ["🌉", "Водные пути", "Открытые длинные периметры, A-short и тяжёлые B-anchor."],
  "Ancient": ["🗿", "Джунгли Ацтеков", "Карта с акцентом на контроль средней зоны и быстрые ротации."],
  "Anubis": ["🐪", "Пустынный шторм", "Много воды, мостов и неожиданных fluk-угров."],
  "Train": ["🚂", "Железная дорога", "Возвращённая классика: состав, вагоны и тайминги на B."],
  "Vertigo": ["🏢", "Высотка", "Небольшая карта с высоким темпом и опасными падениями."],
  "Office": ["📠", "Заложники", "Армейский режим: тесные коридоры и круговая оборона."],
};

const WEAPON_INFO = {
  "AK-47": ["Даунтиер шот", "Убивает с одного в голову без шлема. Обязательный тир-1 на T-стороне."],
  "M4A4": ["CT-стандарт", "Стабильная очередь, высокий спред-контроль на средней дистанции."],
  "M4A1-S": ["Тихий убийца", "Приглушённый выстрел и минимальный спред — любовь снайперов-фраггеров."],
  "AWP": ["Один выстрел", "Легендарная винтовка. Экономит раунд или стоит круглых денег."],
  "Desert Eagle": ["Пистолет-икона", "Револьвер за 700$: один точный дроб в голову меняет раунд."],
  "Glock-18": ["Старт T", "Штатный пистолет террористов, 20 патронов и всплеск огня."],
  "USP-S": ["Старт CT", "Точный и тихий — идеален на дистанции до 20 метров."],
  "MP9": ["ECO-стрейф", "Дешёвый SMG для агрессивных анти-эко раундов."],
  "MP5-SD": ["Приглушённый SMG", "Компромисс между уроном и скоростью передвижения."],
  "Galil AR": ["Бюджетный тир-1", "Дешёвая винтовка, когда денег чуть не хватает на AK."],
  "FAMAS": ["CT-бюджет", "Винтовка за 1950$ с очередью и очередным режимом."],
  "SSG 08": ["Снайперский скаут", "Лёгкая винтовка для прыжков и быстрых pick'ов."],
};

const RANKS = [
  "Silver I", "Silver II", "Silver III", "Silver IV", "Silver Elite", "Silver Elite Master",
  "Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master",
  "Master Guardian I", "Master Guardian II", "Master Guardian Elite",
  "Legendary Eagle", "Legendary Eagle Master", "Supreme Master First Class", "The Global Elite",
];

const COLORS = ["#f7b731", "#ff5e57", "#20bf6b", "#3dc1d3", "#5b7fff", "#a55eea", "#fd79a8", "#e17055", "#00d2d3", "#ffffff"];

/* ---------------- api ---------------- */
async function api(path, body) {
  const opts = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {};
  const res = await fetch(path, opts);
  let data = {};
  try { data = await res.json(); } catch (e) { data = { error: "Ошибка сервера" }; }
  if (!res.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function applyTheme(color) {
  document.documentElement.style.setProperty("--accent", color);
}

function avatarHtml(user, cls = "") {
  const c = user?.avatar_color || "#f7b731";
  const e = user?.avatar_emoji || "🎯";
  return `<div class="avatar ${cls}" style="background:${esc(c)}">${esc(e)}</div>`;
}

/* ---------------- header ---------------- */
function renderAuthArea() {
  if (state.user) {
    authArea.innerHTML = `
      <div class="user-chip" onclick="location.hash='#/profile'">
        ${avatarHtml(state.user, "sm")}
        <span>${esc(state.user.display_name)}</span>
      </div>
      <button class="auth-btn" onclick="location.hash='#/settings'">Настройки</button>
      <button class="auth-btn" id="logout-btn">Выйти</button>`;
    document.getElementById("logout-btn").onclick = async () => {
      await api("/api/logout", {});
      state.user = null;
      applyTheme("#f7b731");
      renderAuthArea();
      location.hash = "#/";
      render();
    };
  } else {
    authArea.innerHTML = `
      <button class="auth-btn" id="login-btn">Войти</button>
      <button class="auth-btn primary" id="reg-btn">Регистрация</button>`;
    document.getElementById("login-btn").onclick = () => openAuthModal("login");
    document.getElementById("reg-btn").onclick = () => openAuthModal("register");
  }
}

/* ---------------- auth modal ---------------- */
function openAuthModal(tab = "login") {
  modalRoot.innerHTML = `
    <div class="overlay" id="overlay">
      <div class="modal">
        <div class="tabs">
          <button data-tab="login" class="${tab === "login" ? "active" : ""}">Вход</button>
          <button data-tab="register" class="${tab === "register" ? "active" : ""}">Регистрация</button>
        </div>
        <div id="modal-error"></div>
        <form id="auth-form">
          <div class="field">
            <label>Ник</label>
            <input name="username" maxlength="20" autocomplete="username" required placeholder="например, s1mple_fan">
          </div>
          <div class="field">
            <label>Пароль</label>
            <input name="password" type="password" minlength="4" autocomplete="current-password" required placeholder="••••••">
          </div>
          <button class="btn accent" style="width:100%" type="submit">
            ${tab === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
        <p class="muted" style="margin-top:14px;font-size:13px;text-align:center">
          Аккаунт хранится локально на этом сервере.
        </p>
      </div>
    </div>`;

  const overlay = document.getElementById("overlay");
  overlay.onclick = (e) => { if (e.target === overlay) modalRoot.innerHTML = ""; };
  modalRoot.querySelectorAll("[data-tab]").forEach((b) => {
    b.onclick = () => openAuthModal(b.dataset.tab);
  });

  document.getElementById("auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { username: fd.get("username"), password: fd.get("password") };
    try {
      const data = await api(tab === "login" ? "/api/login" : "/api/register", payload);
      state.user = data.user;
      applyTheme(data.user.accent_color);
      modalRoot.innerHTML = "";
      renderAuthArea();
      render();
    } catch (err) {
      document.getElementById("modal-error").innerHTML =
        `<div class="error-box">${esc(err.message)}</div>`;
    }
  };
}

/* ---------------- pages ---------------- */
function pageHome() {
  const featured = [
    ["Dust II", "Самая iconic карта серии ждёт твои клины"],
    ["Mirage", "Приёмы на A-ramp и контроль middle"],
    ["Inferno", "Гранаты, которые выигрывают B-site"],
  ];
  return `
    <section class="hero">
      <h1>Сообщество любителей <em>Counter-Strike 2</em></h1>
      <p>Карты, оружие, статистика, свой профиль и свой цвет оформления.
         Регистрируйся, настраивай аккаунт и попадай в рейтинг игроков.</p>
      <div class="hero-actions">
        ${state.user
          ? `<a class="btn accent" href="#/settings">Настроить профиль</a>
             <a class="btn" href="#/leaderboard">Таблица рейтинга</a>`
          : `<button class="btn accent" onclick="openAuthModal('register')">Создать аккаунт</button>
             <a class="btn" href="#/maps">Смотреть карты</a>`}
      </div>
    </section>

    <h2 class="section-title">Популярные карты</h2>
    <div class="grid">
      ${featured.map(([name, desc]) => `
        <div class="card">
          <div class="map-visual">${MAP_INFO[name][0]}</div>
          <h3>${name}</h3><p>${desc}</p>
          <div class="tags"><span class="tag">Active Duty</span></div>
        </div>`).join("")}
    </div>

    <h2 class="section-title">Что есть на сайте</h2>
    <div class="grid">
      <div class="card"><h3>🎨 Выбор цвета</h3><p>Свой акцентный цвет интерфейса и цвет аватара — палитра или любой HEX.</p></div>
      <div class="card"><h3>👤 Аккаунты</h3><p>Регистрация и вход, личный профиль с ником, статусом и био.</p></div>
      <div class="card"><h3>⚙️ Настройки профиля</h3><p>Ранг, любимая карта и оружие, Steam ID, смена пароля.</p></div>
      <div class="card"><h3>🏆 Рейтинг</h3><p>Таблица лидеров по победам и фрагам — докажи, что ты топ-1.</p></div>
    </div>`;
}

function pageMaps() {
  return `
    <h2 class="section-title">Карты CS2</h2>
    <div class="grid">
      ${Object.entries(MAP_INFO).map(([name, [emoji, tag, desc]]) => `
        <div class="card">
          <div class="map-visual">${emoji}</div>
          <h3>${name}</h3>
          <div class="tags"><span class="tag">${tag}</span></div>
          <p style="margin-top:12px">${desc}</p>
        </div>`).join("")}
    </div>`;
}

function pageWeapons() {
  return `
    <h2 class="section-title">Арсенал</h2>
    <div class="grid">
      ${Object.entries(WEAPON_INFO).map(([name, [tag, desc]]) => `
        <div class="card">
          <div class="weapon-visual">🔫</div>
          <h3>${name}</h3>
          <div class="tags"><span class="tag">${tag}</span></div>
          <p style="margin-top:12px">${desc}</p>
        </div>`).join("")}
    </div>`;
}

async function pageLeaderboard() {
  const data = await api("/api/leaderboard");
  if (!data.users.length) {
    return `<h2 class="section-title">Рейтинг игроков</h2>
      <div class="card"><p>Пока пусто. Зарегистрируйся и стань первым в таблице!</p></div>`;
  }
  return `
    <h2 class="section-title">Рейтинг игроков</h2>
    <table class="table">
      <thead><tr><th>#</th><th>Игрок</th><th>Ранг</th><th>Победы</th><th>Убийства</th><th>K/D</th><th>Часы</th></tr></thead>
      <tbody>
        ${data.users.map((u, i) => `
          <tr onclick="location.hash='#/user/${u.id}'" style="cursor:pointer">
            <td class="num">${i + 1}</td>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                ${avatarHtml(u, "sm")}<b>${esc(u.display_name)}</b>
              </div>
            </td>
            <td>${esc(u.rank)}</td>
            <td class="num">${u.wins}</td>
            <td>${u.kills}</td>
            <td>${u.kd}</td>
            <td>${u.hours}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function profileHtml(u, isOwner) {
  return `
    <div class="profile-head">
      ${avatarHtml(u, "lg")}
      <div>
        <h1>${esc(u.display_name)}</h1>
        <div class="meta">@${esc(u.username)} · на сайте с ${new Date(u.created_at * 1000).toLocaleDateString("ru-RU")}</div>
        <div class="badge">${esc(u.rank)}</div>
        ${u.steam_id ? `<div class="meta">Steam: ${esc(u.steam_id)}</div>` : ""}
        ${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : ""}
        ${isOwner ? `<div style="margin-top:16px"><a class="btn" href="#/settings">Редактировать профиль</a></div>` : ""}
      </div>
    </div>

    <div class="stats-row">
      <div class="stat"><b>${u.wins}</b><span>Побед</span></div>
      <div class="stat"><b>${u.kills}</b><span>Убийств</span></div>
      <div class="stat"><b>${u.deaths}</b><span>Смертей</span></div>
      <div class="stat"><b>${u.kd}</b><span>K/D</span></div>
      <div class="stat"><b>${u.hours}</b><span>Часов в игре</span></div>
    </div>

    <div class="grid">
      <div class="card"><h3>🗺️ Любимая карта</h3><p>${u.fav_map ? esc(u.fav_map) : "не выбрана"}</p></div>
      <div class="card"><h3>🔫 Любимое оружие</h3><p>${u.fav_weapon ? esc(u.fav_weapon) : "не выбрано"}</p></div>
      <div class="card"><h3>🎨 Акцентный цвет</h3>
        <p><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${esc(u.accent_color)};vertical-align:middle"></span>
        ${esc(u.accent_color)}</p>
      </div>
    </div>`;
}

function pageProfile() {
  if (!state.user) {
    return `<div class="card"><h3>Нужен аккаунт</h3><p>Войди, чтобы увидеть свой профиль.</p>
      <div style="margin-top:14px"><button class="btn accent" onclick="openAuthModal('login')">Войти</button></div></div>`;
  }
  return profileHtml(state.user, true);
}

async function pageUser(id) {
  try {
    const data = await api(`/api/user/${id}`);
    const isOwner = state.user && state.user.id === data.user.id;
    if (isOwner) return profileHtml(data.user, true);
    return profileHtml(data.user, false);
  } catch (e) {
    return `<div class="card"><h3>Игрок не найден</h3><p>${esc(e.message)}</p></div>`;
  }
}

function pageSettings() {
  if (!state.user) {
    return `<div class="card"><h3>Нужен аккаунт</h3><p>Войди, чтобы настраивать профиль.</p>
      <div style="margin-top:14px"><button class="btn accent" onclick="openAuthModal('login')">Войти</button></div></div>`;
  }
  const u = state.user;
  return `
    <h2 class="section-title">Настройки профиля</h2>
    <div id="settings-msg"></div>
    <form id="settings-form" class="form">
      <div class="form-row">
        <div class="field">
          <label>Отображаемое имя</label>
          <input name="display_name" maxlength="24" value="${esc(u.display_name)}">
        </div>
        <div class="field">
          <label>Steam ID / ссылка</label>
          <input name="steam_id" maxlength="32" value="${esc(u.steam_id)}" placeholder="STEAM_1:0:123456">
        </div>
      </div>

      <div class="field">
        <label>О себе</label>
        <textarea name="bio" maxlength="200" placeholder="Расскажи о своём стиле игры...">${esc(u.bio)}</textarea>
      </div>

      <div class="form-row">
        <div class="field">
          <label>Ранг</label>
          <select name="rank">
            ${RANKS.map((r) => `<option ${r === u.rank ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Любимая карта</label>
          <select name="fav_map">
            <option value="">— не выбрана —</option>
            ${state.options.maps.map((m) => `<option ${m === u.fav_map ? "selected" : ""}>${m}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="field">
        <label>Любимое оружие</label>
        <select name="fav_weapon">
          <option value="">— не выбрано —</option>
          ${state.options.weapons.map((w) => `<option ${w === u.fav_weapon ? "selected" : ""}>${w}</option>`).join("")}
        </select>
      </div>

      <div class="field">
        <label>Аватар</label>
        <input type="hidden" name="avatar_emoji" value="${esc(u.avatar_emoji)}">
        <div class="emoji-grid" id="emoji-grid">
          ${state.options.avatars.map((e) => `
            <div type="button" class="emoji-opt ${e === u.avatar_emoji ? "selected" : ""}" data-emoji="${e}">${e}</div>`).join("")}
        </div>
      </div>

      <div class="form-row">
        <div class="field">
          <label>Цвет аватара</label>
          <div class="swatches" id="avatar-swatches">
            ${COLORS.map((c) => `<div class="swatch ${c === u.avatar_color ? "selected" : ""}" data-color="${c}" style="background:${c}"></div>`).join("")}
          </div>
          <div class="color-input">
            <input type="color" id="avatar-color-input" name="avatar_color" value="${esc(u.avatar_color)}">
            <span class="hint">свой цвет</span>
          </div>
        </div>

        <div class="field">
          <label>Акцентный цвет сайта</label>
          <div class="swatches" id="accent-swatches">
            ${COLORS.map((c) => `<div class="swatch ${c === u.accent_color ? "selected" : ""}" data-color="${c}" style="background:${c}"></div>`).join("")}
          </div>
          <div class="color-input">
            <input type="color" id="accent-color-input" name="accent_color" value="${esc(u.accent_color)}">
            <span class="hint">свой цвет</span>
          </div>
        </div>
      </div>

      <div class="field">
        <label>Предпросмотр</label>
        <div class="preview-box">
          <div class="avatar lg" id="preview-avatar" style="background:${esc(u.avatar_color)}">${esc(u.avatar_emoji)}</div>
          <div>
            <div class="name" id="preview-name">${esc(u.display_name)}</div>
            <div class="sub" id="preview-rank">${esc(u.rank)}</div>
            <div class="sub">акцент: <span id="preview-accent" style="color:${esc(u.accent_color)}">${esc(u.accent_color)}</span></div>
          </div>
        </div>
      </div>

      <h3 style="margin:22px 0 12px">Смена пароля</h3>
      <div class="form-row">
        <div class="field">
          <label>Новый пароль</label>
          <input name="password" type="password" minlength="4" placeholder="оставь пустым, если не меняешь">
        </div>
        <div class="field">
          <label>Повтори новый пароль</label>
          <input name="password2" type="password" minlength="4" placeholder="••••">
        </div>
      </div>

      <button class="btn accent" type="submit" style="width:100%">Сохранить настройки</button>
    </form>`;
}

function bindSettings() {
  const form = document.getElementById("settings-form");
  if (!form) return;

  const pick = (name, value) => {
    form.querySelector(`[name="${name}"]`).value = value;
    updatePreview();
  };

  const wireSwatches = (containerId, name) => {
    const box = document.getElementById(containerId);
    box.querySelectorAll(".swatch").forEach((s) => {
      s.onclick = () => {
        box.querySelectorAll(".swatch").forEach((x) => x.classList.remove("selected"));
        s.classList.add("selected");
        pick(name, s.dataset.color);
        if (name === "accent_color") applyTheme(s.dataset.color);
      };
    });
  };
  wireSwatches("avatar-swatches", "avatar_color");
  wireSwatches("accent-swatches", "accent_color");

  form.querySelectorAll(".emoji-opt").forEach((el) => {
    el.onclick = () => {
      form.querySelectorAll(".emoji-opt").forEach((x) => x.classList.remove("selected"));
      el.classList.add("selected");
      pick("avatar_emoji", el.dataset.emoji);
    };
  });

  document.getElementById("avatar-color-input").oninput = (e) => {
    document.querySelectorAll("#avatar-swatches .swatch").forEach((x) => x.classList.remove("selected"));
    pick("avatar_color", e.target.value);
  };
  document.getElementById("accent-color-input").oninput = (e) => {
    document.querySelectorAll("#accent-swatches .swatch").forEach((x) => x.classList.remove("selected"));
    pick("accent_color", e.target.value);
    applyTheme(e.target.value);
  };

  form.display_name.oninput = () => updatePreview();
  form.rank.onchange = () => updatePreview();

  function updatePreview() {
    document.getElementById("preview-avatar").style.background = form.avatar_color.value;
    document.getElementById("preview-avatar").textContent = form.avatar_emoji.value;
    document.getElementById("preview-name").textContent = form.display_name.value || "Без имени";
    document.getElementById("preview-rank").textContent = form.rank.value;
    const a = form.accent_color.value;
    document.getElementById("preview-accent").textContent = a;
    document.getElementById("preview-accent").style.color = a;
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById("settings-msg");
    const payload = {
      display_name: form.display_name.value.trim(),
      steam_id: form.steam_id.value.trim(),
      bio: form.bio.value.trim(),
      rank: form.rank.value,
      fav_map: form.fav_map.value,
      fav_weapon: form.fav_weapon.value,
      avatar_emoji: form.avatar_emoji.value,
      avatar_color: form.avatar_color.value,
      accent_color: form.accent_color.value,
    };
    if (form.password.value || form.password2.value) {
      if (form.password.value !== form.password2.value) {
        msg.innerHTML = `<div class="error-box">Пароли не совпадают</div>`;
        return;
      }
      payload.password = form.password.value;
    }
    try {
      const data = await api("/api/profile", payload);
      state.user = data.user;
      applyTheme(data.user.accent_color);
      renderAuthArea();
      msg.innerHTML = `<div class="ok-box">Настройки сохранены ✓</div>`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      msg.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  };
}

/* ---------------- router ---------------- */
async function render() {
  const hash = location.hash.replace(/^#/, "") || "/";
  state.route = hash;
  document.querySelectorAll(".nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === hash.split("/").slice(0, 2).join("/") || a.dataset.nav === hash);
  });

  let html = "";
  try {
    if (hash === "/") html = pageHome();
    else if (hash === "/maps") html = pageMaps();
    else if (hash === "/weapons") html = pageWeapons();
    else if (hash === "/leaderboard") html = await pageLeaderboard();
    else if (hash === "/profile") html = pageProfile();
    else if (hash === "/settings") html = pageSettings();
    else if (hash.startsWith("/user/")) html = await pageUser(hash.split("/")[2]);
    else html = `<div class="card"><h3>404 — страница не найдена</h3>
      <p><a href="#/">Вернуться на главную</a></p></div>`;
  } catch (err) {
    html = `<div class="card"><h3>Ошибка</h3><p>${esc(err.message)}</p></div>`;
  }

  app.innerHTML = html;
  bindSettings();
}

/* ---------------- init ---------------- */
async function init() {
  try {
    const [me, opts] = await Promise.all([api("/api/me"), api("/api/options")]);
    state.user = me.user;
    state.options = opts;
    if (state.user) applyTheme(state.user.accent_color);
  } catch (e) { /* сервер недоступен */ }

  renderAuthArea();
  window.addEventListener("hashchange", render);
  render();
}

init();
