const API = '/api';
const TOKEN_KEY = 'teacher_site_token';
const app = document.getElementById('app');
const nav = document.getElementById('nav');
let state = { profile: null, courses: [], materials: [], announcements: [], publications: [], contacts: null };

const pages = [
  ['home', 'Головна'], ['profile', 'Профіль'], ['courses', 'Дисципліни'],
  ['materials', 'Матеріали'], ['announcements', 'Оголошення'], ['publications', 'Публікації'],
  ['contacts', 'Контакти'], ['admin', 'Адміністрування']
];

function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(value) { localStorage.setItem(TOKEN_KEY, value); }
function logout() { localStorage.removeItem(TOKEN_KEY); render('admin'); }
function h(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(`Помилка запиту: ${response.status}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadData() {
  const [profile, courses, materials, announcements, publications, contacts] = await Promise.all([
    request('/profile'), request('/courses'), request('/materials'), request('/announcements'), request('/publications'), request('/contacts')
  ]);
  state = { profile, courses, materials, announcements, publications, contacts };
}

function renderNav(active) {
  nav.innerHTML = pages.map(([id, label]) => `<button class="${active === id ? 'active' : ''}" onclick="render('${id}')">${label}</button>`).join('');
}

function renderHome() {
  const p = state.profile || {};
  const recent = state.announcements.slice(0, 2).map(a => `<div class="item"><h3>${h(a.title)}</h3><div class="meta">${h(a.publishDate)}</div><p>${h(a.content)}</p></div>`).join('');
  app.innerHTML = `
    <section class="hero">
      <div class="panel">
        <span class="badge">Освітній вебресурс</span>
        <h1>${h(p.fullName || 'Персональний вебсайт викладача')}</h1>
        <p>${h(p.about || 'Сайт призначений для представлення професійної діяльності викладача та доступу до навчальних матеріалів.')}</p>
        <div class="actions">
          <button class="primary" onclick="render('courses')">Перейти до дисциплін</button>
          <button class="secondary" onclick="render('materials')">Переглянути матеріали</button>
        </div>
      </div>
      <div class="panel">
        <h2>Актуальні оголошення</h2>
        <div class="list">${recent || '<p>Оголошення відсутні.</p>'}</div>
      </div>
    </section>
    <section class="grid">
      <div class="card"><h3>Навчальні дисципліни</h3><p>Структурований перелік дисциплін з описом і матеріалами.</p></div>
      <div class="card"><h3>Профіль викладача</h3><p>Професійні відомості, досвід, освіта й напрями роботи.</p></div>
      <div class="card"><h3>Адміністрування</h3><p>Оновлення змісту через захищену панель керування.</p></div>
    </section>`;
}

function renderProfile() {
  const p = state.profile || {};
  app.innerHTML = `<div class="panel"><h2>Профіль викладача</h2><div class="grid two">
    <div class="card"><h3>Посада</h3><p>${h(p.position)}</p></div>
    <div class="card"><h3>Освіта</h3><p>${h(p.education)}</p></div>
    <div class="card"><h3>Досвід</h3><p>${h(p.experience)}</p></div>
    <div class="card"><h3>Професійні інтереси</h3><p>${h(p.interests)}</p></div>
  </div><p>${h(p.about)}</p></div>`;
}

function renderCourses() {
  app.innerHTML = `<div class="panel"><h2>Навчальні дисципліни</h2><div class="grid">${state.courses.map(c => `<div class="card"><h3>${h(c.title)}</h3><p>${h(c.description)}</p><p class="meta">${h(c.semester)} · ${h(c.hours)} год.</p><button class="secondary" onclick="renderMaterials(${c.id})">Матеріали дисципліни</button></div>`).join('')}</div></div>`;
}

function renderMaterials(courseId = null) {
  const materials = courseId ? state.materials.filter(m => m.courseId === courseId) : state.materials;
  app.innerHTML = `<div class="panel"><h2>Навчальні матеріали</h2><div class="list">${materials.map(m => `<div class="item"><h3>${h(m.title)}</h3><div class="meta">${h(m.courseTitle)} · ${h(m.type)}</div><p>${h(m.description)}</p><a class="link" href="${h(m.url)}" target="_blank">Відкрити ресурс</a></div>`).join('') || '<p>Матеріали відсутні.</p>'}</div></div>`;
}

function renderAnnouncements() {
  app.innerHTML = `<div class="panel"><h2>Оголошення</h2><div class="list">${state.announcements.map(a => `<div class="item"><h3>${h(a.title)}</h3><div class="meta">${h(a.publishDate)}</div><p>${h(a.content)}</p></div>`).join('')}</div></div>`;
}

function renderPublications() {
  app.innerHTML = `<div class="panel"><h2>Публікації</h2><div class="table-wrap"><table><thead><tr><th>Назва</th><th>Джерело</th><th>Рік</th><th>Посилання</th></tr></thead><tbody>${state.publications.map(p => `<tr><td>${h(p.title)}</td><td>${h(p.source)}</td><td>${h(p.year)}</td><td><a class="link" href="${h(p.link)}" target="_blank">Перейти</a></td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderContacts() {
  const c = state.contacts || {};
  app.innerHTML = `<div class="panel"><h2>Контактна інформація</h2><div class="grid two">
    <div class="card"><h3>Електронна пошта</h3><p>${h(c.email)}</p></div>
    <div class="card"><h3>Кафедра</h3><p>${h(c.department)}</p></div>
    <div class="card"><h3>Графік консультацій</h3><p>${h(c.consultationSchedule)}</p></div>
    <div class="card"><h3>Кабінет</h3><p>${h(c.office)}</p></div>
  </div><p>${h(c.extraLinks)}</p></div>`;
}

function renderAdmin(message = '') {
  if (!token()) {
    app.innerHTML = `<div class="form-card"><h2>Вхід до адміністративної частини</h2>${message ? `<div class="notice error">${h(message)}</div>` : ''}
      <label>Логін</label><input id="login" value="admin" />
      <label>Пароль</label><input id="password" type="password" value="admin123" />
      <button class="primary" onclick="loginAdmin()">Увійти</button>
      <p class="meta">Дані для входу: admin / admin123</p>
    </div>`;
    return;
  }
  app.innerHTML = `<div class="panel"><h2>Панель адміністрування</h2>${message ? `<div class="notice">${h(message)}</div>` : ''}
    <div class="actions"><button class="danger" onclick="logout()">Вийти</button></div>
    <div class="grid two">
      <div class="form-card"><h3>Додати оголошення</h3><label>Заголовок</label><input id="aTitle" /><label>Текст</label><textarea id="aContent"></textarea><label>Дата</label><input id="aDate" type="date" /><button class="primary" onclick="addAnnouncement()">Зберегти</button></div>
      <div class="form-card"><h3>Додати дисципліну</h3><label>Назва</label><input id="cTitle" /><label>Опис</label><textarea id="cDesc"></textarea><label>Семестр</label><input id="cSem" /><label>Години</label><input id="cHours" type="number" value="90" /><button class="primary" onclick="addCourse()">Зберегти</button></div>
      <div class="form-card"><h3>Додати матеріал</h3><label>Дисципліна</label><select id="mCourse">${state.courses.map(c => `<option value="${c.id}">${h(c.title)}</option>`).join('')}</select><label>Назва</label><input id="mTitle" /><label>Тип</label><input id="mType" value="Посилання" /><label>URL</label><input id="mUrl" value="https://example.com" /><label>Опис</label><textarea id="mDesc"></textarea><button class="primary" onclick="addMaterial()">Зберегти</button></div>
      <div class="form-card"><h3>Оновити контакти</h3><label>Email</label><input id="email" value="${h(state.contacts.email)}" /><label>Кафедра</label><input id="department" value="${h(state.contacts.department)}" /><label>Графік</label><input id="schedule" value="${h(state.contacts.consultationSchedule)}" /><label>Кабінет</label><input id="office" value="${h(state.contacts.office)}" /><label>Посилання</label><textarea id="links">${h(state.contacts.extraLinks)}</textarea><button class="primary" onclick="updateContacts()">Оновити</button></div>
    </div>
  </div>`;
}

async function loginAdmin() {
  try {
    const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ login: document.getElementById('login').value, password: document.getElementById('password').value }) });
    setToken(data.token);
    renderAdmin('Авторизацію виконано успішно.');
  } catch { renderAdmin('Неправильний логін або пароль.'); }
}

async function addAnnouncement() {
  await request('/announcements', { method: 'POST', body: JSON.stringify({ title: aTitle.value, content: aContent.value, publishDate: aDate.value || new Date().toISOString().slice(0,10) }) });
  await refresh('Оголошення додано.');
}
async function addCourse() {
  await request('/courses', { method: 'POST', body: JSON.stringify({ title: cTitle.value, description: cDesc.value, semester: cSem.value, hours: Number(cHours.value || 0) }) });
  await refresh('Дисципліну додано.');
}
async function addMaterial() {
  await request('/materials', { method: 'POST', body: JSON.stringify({ courseId: Number(mCourse.value), title: mTitle.value, type: mType.value, url: mUrl.value, description: mDesc.value }) });
  await refresh('Матеріал додано.');
}
async function updateContacts() {
  await request('/contacts', { method: 'PUT', body: JSON.stringify({ email: email.value, department: department.value, consultationSchedule: schedule.value, office: office.value, extraLinks: links.value }) });
  await refresh('Контакти оновлено.');
}
async function refresh(msg) { await loadData(); renderAdmin(msg); }

async function render(page) {
  renderNav(page);
  try {
    if (!state.profile) await loadData();
    if (page === 'home') renderHome();
    if (page === 'profile') renderProfile();
    if (page === 'courses') renderCourses();
    if (page === 'materials') renderMaterials();
    if (page === 'announcements') renderAnnouncements();
    if (page === 'publications') renderPublications();
    if (page === 'contacts') renderContacts();
    if (page === 'admin') renderAdmin();
  } catch (e) {
    app.innerHTML = `<div class="notice error">Не вдалося завантажити дані. Перевірте, чи запущено backend. ${h(e.message)}</div>`;
  }
}

window.render = render;
window.renderMaterials = renderMaterials;
window.loginAdmin = loginAdmin;
window.logout = logout;
window.addAnnouncement = addAnnouncement;
window.addCourse = addCourse;
window.addMaterial = addMaterial;
window.updateContacts = updateContacts;
render('home');
