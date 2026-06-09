import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api, setAuthToken, getAuthToken, clearAuthToken } from './services/api.js';

const menu = [
  { id: 'home', title: 'Головна' },
  { id: 'profile', title: 'Профіль' },
  { id: 'courses', title: 'Дисципліни' },
  { id: 'materials', title: 'Матеріали' },
  { id: 'announcements', title: 'Оголошення' },
  { id: 'publications', title: 'Публікації' },
  { id: 'contacts', title: 'Контакти' },
  { id: 'admin', title: 'Адміністрування' }
];

function App() {
  const [page, setPage] = useState(() => window.location.hash.replace('#', '') || 'home');
  const [data, setData] = useState({ profile: null, contacts: null, courses: [], materials: [], announcements: [], publications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const onHashChange = () => setPage(window.location.hash.replace('#', '') || 'home');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profile, contacts, courses, materials, announcements, publications] = await Promise.all([
        api.get('/profile'),
        api.get('/contacts'),
        api.get('/courses'),
        api.get('/materials'),
        api.get('/announcements'),
        api.get('/publications')
      ]);
      setData({ profile, contacts, courses, materials, announcements, publications });
    } catch (err) {
      setError(err.message || 'Не вдалося отримати дані з backend-частини');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const navigate = (id) => {
    window.location.hash = id;
    setPage(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const content = useMemo(() => {
    if (loading) return <StatusCard title="Завантаження даних" text="Зачекайте, виконується запит до серверної частини." />;
    if (error) return <StatusCard title="Помилка підключення" text={error} tone="danger" />;

    switch (page) {
      case 'profile': return <ProfilePage profile={data.profile} publications={data.publications} />;
      case 'courses': return <CoursesPage courses={data.courses} materials={data.materials} />;
      case 'materials': return <MaterialsPage courses={data.courses} materials={data.materials} />;
      case 'announcements': return <AnnouncementsPage announcements={data.announcements} />;
      case 'publications': return <PublicationsPage publications={data.publications} />;
      case 'contacts': return <ContactsPage contacts={data.contacts} />;
      case 'admin': return <AdminPage data={data} reload={loadData} />;
      default: return <HomePage data={data} navigate={navigate} />;
    }
  }, [page, loading, error, data]);

  return (
    <>
      <Header page={page} navigate={navigate} />
      <main className="main-container">{content}</main>
      <Footer />
    </>
  );
}

function Header({ page, navigate }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate('home')}>
          <span className="brand-mark">IT</span>
          <span>Персональний сайт викладача</span>
        </button>
        <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Відкрити меню">☰</button>
        <nav className={open ? 'nav open' : 'nav'}>
          {menu.map(item => (
            <button
              key={item.id}
              className={page === item.id ? 'nav-link active' : 'nav-link'}
              onClick={() => { navigate(item.id); setOpen(false); }}
            >
              {item.title}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function HomePage({ data, navigate }) {
  const latest = data.announcements.slice(0, 2);
  return (
    <section className="page-grid">
      <div className="hero-card">
        <p className="eyebrow">Освітній вебресурс</p>
        <h1>{data.profile.fullName}</h1>
        <p className="lead">{data.profile.about}</p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => navigate('courses')}>Перейти до дисциплін</button>
          <button className="secondary-button" onClick={() => navigate('contacts')}>Контактна інформація</button>
        </div>
      </div>
      <div className="summary-card">
        <h2>Профіль викладача</h2>
        <p><b>Посада:</b> {data.profile.position}</p>
        <p><b>Досвід:</b> {data.profile.experience}</p>
        <p><b>Інтереси:</b> {data.profile.interests}</p>
      </div>
      <div className="wide-section">
        <SectionTitle title="Основні розділи" subtitle="Швидкий перехід до навчальної, професійної та контактної інформації" />
        <div className="card-grid three">
          <FeatureCard title="Навчальні дисципліни" text="Перелік курсів, короткі описи, навчальні години та зв’язок із матеріалами." onClick={() => navigate('courses')} />
          <FeatureCard title="Навчальні матеріали" text="Методичні рекомендації, презентації, завдання й корисні посилання." onClick={() => navigate('materials')} />
          <FeatureCard title="Оголошення" text="Актуальні повідомлення щодо консультацій, робіт і організації навчання." onClick={() => navigate('announcements')} />
        </div>
      </div>
      <div className="wide-section split">
        <div>
          <SectionTitle title="Актуальні оголошення" subtitle="Останні повідомлення для здобувачів освіти" />
          <div className="stack">
            {latest.map(item => <AnnouncementCard key={item.id} item={item} />)}
          </div>
        </div>
        <div>
          <SectionTitle title="Контакти" subtitle="Канали професійного зв’язку" />
          <InfoList items={[
            ['Електронна пошта', data.contacts.email],
            ['Кафедра', data.contacts.department],
            ['Консультації', data.contacts.consultationSchedule]
          ]} />
        </div>
      </div>
    </section>
  );
}

function ProfilePage({ profile, publications }) {
  return (
    <section>
      <SectionTitle title="Профіль викладача" subtitle="Професійна, навчально-методична та наукова інформація" />
      <div className="content-card profile-card">
        <h2>{profile.fullName}</h2>
        <InfoList items={[
          ['Посада', profile.position],
          ['Освіта', profile.education],
          ['Педагогічний досвід', profile.experience],
          ['Професійні інтереси', profile.interests]
        ]} />
        <p>{profile.about}</p>
      </div>
      <SectionTitle title="Останні публікації" subtitle="Фрагмент академічного профілю викладача" />
      <div className="card-grid two">
        {publications.slice(0, 4).map(item => <PublicationCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function CoursesPage({ courses, materials }) {
  return (
    <section>
      <SectionTitle title="Навчальні дисципліни" subtitle="Курси, які супроводжуються через персональний вебсайт" />
      <div className="card-grid two">
        {courses.map(course => (
          <article className="content-card" key={course.id}>
            <span className="badge">{course.semester}</span>
            <h2>{course.title}</h2>
            <p>{course.description}</p>
            <p><b>Обсяг:</b> {course.hours} год.</p>
            <h3>Матеріали дисципліни</h3>
            <ul className="plain-list">
              {materials.filter(m => m.courseId === course.id).map(m => <li key={m.id}>{m.title}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function MaterialsPage({ courses, materials }) {
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const visible = selectedCourseId === 'all' ? materials : materials.filter(item => String(item.courseId) === selectedCourseId);
  return (
    <section>
      <SectionTitle title="Навчальні матеріали" subtitle="Методичні файли, презентації, завдання та посилання" />
      <div className="filter-panel">
        <label>Фільтр за дисципліною</label>
        <select value={selectedCourseId} onChange={event => setSelectedCourseId(event.target.value)}>
          <option value="all">Усі дисципліни</option>
          {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </div>
      <div className="card-grid two">
        {visible.map(item => <MaterialCard key={item.id} item={item} />)}
      </div>
    </section>
  );
}

function AnnouncementsPage({ announcements }) {
  return (
    <section>
      <SectionTitle title="Оголошення" subtitle="Актуальні повідомлення щодо навчального процесу" />
      <div className="stack">{announcements.map(item => <AnnouncementCard key={item.id} item={item} />)}</div>
    </section>
  );
}

function PublicationsPage({ publications }) {
  return (
    <section>
      <SectionTitle title="Публікації" subtitle="Наукові та навчально-методичні матеріали" />
      <div className="card-grid two">{publications.map(item => <PublicationCard key={item.id} item={item} />)}</div>
    </section>
  );
}

function ContactsPage({ contacts }) {
  return (
    <section>
      <SectionTitle title="Контакти" subtitle="Відомості для професійного зв’язку й консультацій" />
      <div className="content-card contact-card">
        <InfoList items={[
          ['Електронна пошта', contacts.email],
          ['Підрозділ', contacts.department],
          ['Графік консультацій', contacts.consultationSchedule],
          ['Кабінет', contacts.office],
          ['Професійні посилання', contacts.extraLinks]
        ]} />
      </div>
    </section>
  );
}

function AdminPage({ data, reload }) {
  const [token, setToken] = useState(getAuthToken());
  if (!token) return <LoginForm onLogin={(newToken) => { setAuthToken(newToken); setToken(newToken); }} />;
  return <Dashboard data={data} reload={reload} onLogout={() => { clearAuthToken(); setToken(''); }} />;
}

function LoginForm({ onLogin }) {
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const result = await api.post('/auth/login', { login, password });
      onLogin(result.token);
    } catch (err) {
      setMessage('Невірні облікові дані або backend-частина недоступна.');
    }
  };

  return (
    <section>
      <SectionTitle title="Адміністрування" subtitle="Вхід до панелі керування контентом" />
      <form className="content-card form-card" onSubmit={submit}>
        <label>Логін<input value={login} onChange={e => setLogin(e.target.value)} /></label>
        <label>Пароль<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="primary-button" type="submit">Увійти</button>
        <p className="hint">Демо-доступ: admin / admin123</p>
        {message && <p className="message danger">{message}</p>}
      </form>
    </section>
  );
}

function Dashboard({ data, reload, onLogout }) {
  const [tab, setTab] = useState('profile');
  const [message, setMessage] = useState('');

  const refresh = async (text) => {
    await reload();
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  };

  return (
    <section>
      <div className="admin-header">
        <SectionTitle title="Панель керування" subtitle="Редагування змісту персонального вебсайту" />
        <button className="secondary-button" onClick={onLogout}>Вийти</button>
      </div>
      <div className="admin-tabs">
        {[
          ['profile', 'Профіль'], ['courses', 'Дисципліни'], ['materials', 'Матеріали'],
          ['announcements', 'Оголошення'], ['publications', 'Публікації'], ['contacts', 'Контакти']
        ].map(([id, title]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{title}</button>)}
      </div>
      {message && <p className="message success">{message}</p>}
      {tab === 'profile' && <ProfileEditor profile={data.profile} refresh={refresh} />}
      {tab === 'courses' && <CourseEditor courses={data.courses} refresh={refresh} />}
      {tab === 'materials' && <MaterialEditor courses={data.courses} materials={data.materials} refresh={refresh} />}
      {tab === 'announcements' && <AnnouncementEditor announcements={data.announcements} refresh={refresh} />}
      {tab === 'publications' && <PublicationEditor publications={data.publications} refresh={refresh} />}
      {tab === 'contacts' && <ContactEditor contacts={data.contacts} refresh={refresh} />}
    </section>
  );
}

function ProfileEditor({ profile, refresh }) {
  const [form, setForm] = useState(profile);
  const save = async (event) => {
    event.preventDefault();
    await api.put('/profile', form);
    refresh('Профіль оновлено');
  };
  return <EditorForm form={form} setForm={setForm} onSubmit={save} fields={[
    ['fullName', 'ПІБ'], ['position', 'Посада'], ['education', 'Освіта'], ['experience', 'Досвід'], ['interests', 'Інтереси'], ['about', 'Опис', 'textarea']
  ]} submitText="Зберегти профіль" />;
}

function ContactEditor({ contacts, refresh }) {
  const [form, setForm] = useState(contacts);
  const save = async (event) => {
    event.preventDefault();
    await api.put('/contacts', form);
    refresh('Контакти оновлено');
  };
  return <EditorForm form={form} setForm={setForm} onSubmit={save} fields={[
    ['email', 'Електронна пошта'], ['department', 'Кафедра'], ['consultationSchedule', 'Графік консультацій'], ['office', 'Кабінет'], ['extraLinks', 'Додаткові посилання', 'textarea']
  ]} submitText="Зберегти контакти" />;
}

function CourseEditor({ courses, refresh }) {
  const empty = { title: '', description: '', semester: '', hours: 90 };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const save = async (event) => {
    event.preventDefault();
    editId ? await api.put(`/courses/${editId}`, form) : await api.post('/courses', form);
    setForm(empty); setEditId(null); refresh('Дисципліни оновлено');
  };
  return <CrudEditor title="Дисципліни" items={courses} form={form} setForm={setForm} onSubmit={save} onEdit={(item) => { setEditId(item.id); setForm(item); }} onDelete={async (id) => { await api.del(`/courses/${id}`); refresh('Дисципліну видалено'); }} fields={[
    ['title', 'Назва'], ['description', 'Опис', 'textarea'], ['semester', 'Семестр'], ['hours', 'Години', 'number']
  ]} editId={editId} cancel={() => { setEditId(null); setForm(empty); }} />;
}

function MaterialEditor({ courses, materials, refresh }) {
  const empty = { courseId: courses[0]?.id || 1, title: '', type: 'PDF', url: '', description: '' };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const save = async (event) => {
    event.preventDefault();
    const payload = { ...form, courseId: Number(form.courseId) };
    editId ? await api.put(`/materials/${editId}`, payload) : await api.post('/materials', payload);
    setForm(empty); setEditId(null); refresh('Матеріали оновлено');
  };
  return <CrudEditor title="Навчальні матеріали" items={materials} form={form} setForm={setForm} onSubmit={save} onEdit={(item) => { setEditId(item.id); setForm({ courseId: item.courseId, title: item.title, type: item.type, url: item.url, description: item.description }); }} onDelete={async (id) => { await api.del(`/materials/${id}`); refresh('Матеріал видалено'); }} fields={[
    ['courseId', 'Дисципліна', 'select', courses.map(c => [c.id, c.title])], ['title', 'Назва'], ['type', 'Тип'], ['url', 'Посилання'], ['description', 'Опис', 'textarea']
  ]} editId={editId} cancel={() => { setEditId(null); setForm(empty); }} />;
}

function AnnouncementEditor({ announcements, refresh }) {
  const empty = { title: '', content: '', publishDate: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const save = async (event) => {
    event.preventDefault();
    editId ? await api.put(`/announcements/${editId}`, form) : await api.post('/announcements', form);
    setForm(empty); setEditId(null); refresh('Оголошення оновлено');
  };
  return <CrudEditor title="Оголошення" items={announcements} form={form} setForm={setForm} onSubmit={save} onEdit={(item) => { setEditId(item.id); setForm({ title: item.title, content: item.content, publishDate: item.publishDate }); }} onDelete={async (id) => { await api.del(`/announcements/${id}`); refresh('Оголошення видалено'); }} fields={[
    ['title', 'Заголовок'], ['content', 'Текст', 'textarea'], ['publishDate', 'Дата', 'date']
  ]} editId={editId} cancel={() => { setEditId(null); setForm(empty); }} />;
}

function PublicationEditor({ publications, refresh }) {
  const empty = { title: '', source: '', year: new Date().getFullYear(), link: '' };
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const save = async (event) => {
    event.preventDefault();
    const payload = { ...form, year: Number(form.year) };
    editId ? await api.put(`/publications/${editId}`, payload) : await api.post('/publications', payload);
    setForm(empty); setEditId(null); refresh('Публікації оновлено');
  };
  return <CrudEditor title="Публікації" items={publications} form={form} setForm={setForm} onSubmit={save} onEdit={(item) => { setEditId(item.id); setForm(item); }} onDelete={async (id) => { await api.del(`/publications/${id}`); refresh('Публікацію видалено'); }} fields={[
    ['title', 'Назва'], ['source', 'Джерело'], ['year', 'Рік', 'number'], ['link', 'Посилання']
  ]} editId={editId} cancel={() => { setEditId(null); setForm(empty); }} />;
}

function CrudEditor({ title, items, form, setForm, onSubmit, onEdit, onDelete, fields, editId, cancel }) {
  return (
    <div className="admin-grid">
      <div>
        <h2>{editId ? `Редагування: ${title}` : `Додавання: ${title}`}</h2>
        <EditorForm form={form} setForm={setForm} onSubmit={onSubmit} fields={fields} submitText={editId ? 'Зберегти зміни' : 'Додати запис'} />
        {editId && <button className="secondary-button full" onClick={cancel}>Скасувати редагування</button>}
      </div>
      <div>
        <h2>Наявні записи</h2>
        <div className="stack small">
          {items.map(item => (
            <div className="list-row" key={item.id}>
              <div><b>{item.title || item.fullName}</b><p>{item.description || item.content || item.source || item.courseTitle || ''}</p></div>
              <div className="row-actions">
                <button onClick={() => onEdit(item)}>Редагувати</button>
                <button className="danger-button" onClick={() => window.confirm('Видалити запис?') && onDelete(item.id)}>Видалити</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorForm({ form, setForm, onSubmit, fields, submitText }) {
  const update = (field, value) => setForm({ ...form, [field]: value });
  return (
    <form className="content-card form-card" onSubmit={onSubmit}>
      {fields.map(([field, label, type, options]) => (
        <label key={field}>{label}
          {type === 'textarea' ? (
            <textarea value={form[field] ?? ''} onChange={e => update(field, e.target.value)} />
          ) : type === 'select' ? (
            <select value={form[field] ?? ''} onChange={e => update(field, e.target.value)}>
              {options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
            </select>
          ) : (
            <input type={type || 'text'} value={form[field] ?? ''} onChange={e => update(field, e.target.value)} />
          )}
        </label>
      ))}
      <button className="primary-button" type="submit">{submitText}</button>
    </form>
  );
}

function SectionTitle({ title, subtitle }) {
  return <div className="section-title"><p className="eyebrow">{subtitle}</p><h1>{title}</h1></div>;
}

function FeatureCard({ title, text, onClick }) {
  return <article className="content-card feature" onClick={onClick}><h2>{title}</h2><p>{text}</p><button>Відкрити</button></article>;
}

function MaterialCard({ item }) {
  return <article className="content-card"><span className="badge">{item.type}</span><h2>{item.title}</h2><p>{item.description}</p><p><b>Дисципліна:</b> {item.courseTitle}</p><a className="text-link" href={item.url} target="_blank" rel="noreferrer">Відкрити матеріал</a></article>;
}

function AnnouncementCard({ item }) {
  return <article className="content-card"><span className="badge">{item.publishDate}</span><h2>{item.title}</h2><p>{item.content}</p></article>;
}

function PublicationCard({ item }) {
  return <article className="content-card"><span className="badge">{item.year}</span><h2>{item.title}</h2><p>{item.source}</p><a className="text-link" href={item.link} target="_blank" rel="noreferrer">Перейти до джерела</a></article>;
}

function InfoList({ items }) {
  return <dl className="info-list">{items.map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl>;
}

function StatusCard({ title, text, tone = 'default' }) {
  return <div className={`content-card status ${tone}`}><h1>{title}</h1><p>{text}</p></div>;
}

function Footer() {
  return <footer className="footer">Персональний вебсайт викладача · React + C# + SQLite</footer>;
}

createRoot(document.getElementById('root')).render(<App />);
