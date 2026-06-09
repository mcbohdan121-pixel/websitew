using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

var corsOrigins = builder.Configuration.GetSection("App:CorsOrigins").Get<string[]>()
                  ?? ["http://localhost:5173"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("FrontendPolicy");

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
                       ?? "Data Source=teacher_site.db";
var adminToken = builder.Configuration["App:AdminToken"] ?? "teacher-admin-token";

Database.Initialize(connectionString);

bool IsAuthorized(HttpRequest request)
{
    var auth = request.Headers.Authorization.ToString();
    return auth == $"Bearer {adminToken}";
}

app.MapGet("/api/status", () => Results.Ok(new
{
    name = "Teacher Personal Site API",
    status = "running",
    endpoints = new[]
    {
        "/api/profile", "/api/courses", "/api/materials", "/api/announcements", "/api/publications", "/api/contacts"
    }
}));

app.MapPost("/api/auth/login", (LoginRequest request) =>
{
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "SELECT PasswordHash FROM AdminUsers WHERE Login = $login LIMIT 1";
    cmd.Parameters.AddWithValue("$login", request.Login.Trim());
    var storedHash = cmd.ExecuteScalar()?.ToString();

    if (storedHash is null || storedHash != HashPassword(request.Password))
    {
        return Results.Unauthorized();
    }

    return Results.Ok(new { token = adminToken, login = request.Login.Trim() });
});

app.MapGet("/api/profile", () =>
{
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "SELECT Id, FullName, Position, Education, Experience, Interests, About FROM TeacherProfile LIMIT 1";
    using var r = cmd.ExecuteReader();
    return r.Read()
        ? Results.Ok(new TeacherProfile(
            r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5), r.GetString(6)))
        : Results.NotFound();
});

app.MapPut("/api/profile", (HttpRequest http, TeacherProfileUpdate model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = @"
        UPDATE TeacherProfile
        SET FullName = $fullName,
            Position = $position,
            Education = $education,
            Experience = $experience,
            Interests = $interests,
            About = $about
        WHERE Id = 1";
    cmd.Parameters.AddWithValue("$fullName", model.FullName.Trim());
    cmd.Parameters.AddWithValue("$position", model.Position.Trim());
    cmd.Parameters.AddWithValue("$education", model.Education.Trim());
    cmd.Parameters.AddWithValue("$experience", model.Experience.Trim());
    cmd.Parameters.AddWithValue("$interests", model.Interests.Trim());
    cmd.Parameters.AddWithValue("$about", model.About.Trim());
    cmd.ExecuteNonQuery();
    return Results.Ok(new { message = "Профіль оновлено" });
});

app.MapGet("/api/courses", () =>
{
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "SELECT Id, Title, Description, Semester, Hours FROM Courses ORDER BY Title";
    using var r = cmd.ExecuteReader();
    var items = new List<Course>();
    while (r.Read())
    {
        items.Add(new Course(r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetInt32(4)));
    }
    return Results.Ok(items);
});

app.MapGet("/api/courses/{id:int}", (int id) =>
{
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "SELECT Id, Title, Description, Semester, Hours FROM Courses WHERE Id = $id";
    cmd.Parameters.AddWithValue("$id", id);
    using var r = cmd.ExecuteReader();
    return r.Read()
        ? Results.Ok(new Course(r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetInt32(4)))
        : Results.NotFound();
});

app.MapPost("/api/courses", (HttpRequest http, CourseInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(model.Title)) return Results.BadRequest(new { message = "Назва дисципліни є обов'язковою" });
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "INSERT INTO Courses (Title, Description, Semester, Hours) VALUES ($title, $description, $semester, $hours); SELECT last_insert_rowid();";
    cmd.Parameters.AddWithValue("$title", model.Title.Trim());
    cmd.Parameters.AddWithValue("$description", model.Description.Trim());
    cmd.Parameters.AddWithValue("$semester", model.Semester.Trim());
    cmd.Parameters.AddWithValue("$hours", model.Hours);
    var id = Convert.ToInt32(cmd.ExecuteScalar());
    return Results.Created($"/api/courses/{id}", new { id });
});

app.MapPut("/api/courses/{id:int}", (HttpRequest http, int id, CourseInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(model.Title)) return Results.BadRequest(new { message = "Назва дисципліни є обов'язковою" });
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "UPDATE Courses SET Title=$title, Description=$description, Semester=$semester, Hours=$hours WHERE Id=$id";
    cmd.Parameters.AddWithValue("$id", id);
    cmd.Parameters.AddWithValue("$title", model.Title.Trim());
    cmd.Parameters.AddWithValue("$description", model.Description.Trim());
    cmd.Parameters.AddWithValue("$semester", model.Semester.Trim());
    cmd.Parameters.AddWithValue("$hours", model.Hours);
    return cmd.ExecuteNonQuery() > 0 ? Results.Ok(new { message = "Дисципліну оновлено" }) : Results.NotFound();
});

app.MapDelete("/api/courses/{id:int}", (HttpRequest http, int id) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "DELETE FROM Courses WHERE Id=$id";
    cmd.Parameters.AddWithValue("$id", id);
    return cmd.ExecuteNonQuery() > 0 ? Results.Ok(new { message = "Дисципліну видалено" }) : Results.NotFound();
});

app.MapGet("/api/materials", (int? courseId) =>
{
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = @"
        SELECT m.Id, m.CourseId, c.Title, m.Title, m.Type, m.Url, m.Description
        FROM Materials m
        LEFT JOIN Courses c ON c.Id = m.CourseId
        WHERE $courseId IS NULL OR m.CourseId = $courseId
        ORDER BY c.Title, m.Title";
    cmd.Parameters.AddWithValue("$courseId", courseId is null ? DBNull.Value : courseId);
    using var r = cmd.ExecuteReader();
    var items = new List<Material>();
    while (r.Read())
    {
        items.Add(new Material(r.GetInt32(0), r.GetInt32(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5), r.GetString(6)));
    }
    return Results.Ok(items);
});

app.MapPost("/api/materials", (HttpRequest http, MaterialInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    if (string.IsNullOrWhiteSpace(model.Title)) return Results.BadRequest(new { message = "Назва матеріалу є обов'язковою" });
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "INSERT INTO Materials (CourseId, Title, Type, Url, Description) VALUES ($courseId, $title, $type, $url, $description); SELECT last_insert_rowid();";
    cmd.Parameters.AddWithValue("$courseId", model.CourseId);
    cmd.Parameters.AddWithValue("$title", model.Title.Trim());
    cmd.Parameters.AddWithValue("$type", model.Type.Trim());
    cmd.Parameters.AddWithValue("$url", model.Url.Trim());
    cmd.Parameters.AddWithValue("$description", model.Description.Trim());
    var id = Convert.ToInt32(cmd.ExecuteScalar());
    return Results.Created($"/api/materials/{id}", new { id });
});

app.MapPut("/api/materials/{id:int}", (HttpRequest http, int id, MaterialInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "UPDATE Materials SET CourseId=$courseId, Title=$title, Type=$type, Url=$url, Description=$description WHERE Id=$id";
    cmd.Parameters.AddWithValue("$id", id);
    cmd.Parameters.AddWithValue("$courseId", model.CourseId);
    cmd.Parameters.AddWithValue("$title", model.Title.Trim());
    cmd.Parameters.AddWithValue("$type", model.Type.Trim());
    cmd.Parameters.AddWithValue("$url", model.Url.Trim());
    cmd.Parameters.AddWithValue("$description", model.Description.Trim());
    return cmd.ExecuteNonQuery() > 0 ? Results.Ok(new { message = "Матеріал оновлено" }) : Results.NotFound();
});

app.MapDelete("/api/materials/{id:int}", (HttpRequest http, int id) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "DELETE FROM Materials WHERE Id=$id";
    cmd.Parameters.AddWithValue("$id", id);
    return cmd.ExecuteNonQuery() > 0 ? Results.Ok(new { message = "Матеріал видалено" }) : Results.NotFound();
});

app.MapGet("/api/announcements", () => QueryList<Announcement>(connectionString, "SELECT Id, Title, Content, PublishDate FROM Announcements ORDER BY PublishDate DESC", r => new Announcement(r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetString(3))));

app.MapPost("/api/announcements", (HttpRequest http, AnnouncementInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    return InsertSimple(connectionString, "Announcements", new Dictionary<string, object>
    {
        ["Title"] = model.Title.Trim(), ["Content"] = model.Content.Trim(), ["PublishDate"] = model.PublishDate.Trim()
    });
});

app.MapPut("/api/announcements/{id:int}", (HttpRequest http, int id, AnnouncementInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    return UpdateSimple(connectionString, "Announcements", id, new Dictionary<string, object>
    {
        ["Title"] = model.Title.Trim(), ["Content"] = model.Content.Trim(), ["PublishDate"] = model.PublishDate.Trim()
    }, "Оголошення оновлено");
});

app.MapDelete("/api/announcements/{id:int}", (HttpRequest http, int id) => DeleteSimple(http, connectionString, "Announcements", id, adminToken, "Оголошення видалено"));

app.MapGet("/api/publications", () => QueryList<Publication>(connectionString, "SELECT Id, Title, Source, Year, Link FROM Publications ORDER BY Year DESC, Title", r => new Publication(r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetInt32(3), r.GetString(4))));

app.MapPost("/api/publications", (HttpRequest http, PublicationInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    return InsertSimple(connectionString, "Publications", new Dictionary<string, object>
    {
        ["Title"] = model.Title.Trim(), ["Source"] = model.Source.Trim(), ["Year"] = model.Year, ["Link"] = model.Link.Trim()
    });
});

app.MapPut("/api/publications/{id:int}", (HttpRequest http, int id, PublicationInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    return UpdateSimple(connectionString, "Publications", id, new Dictionary<string, object>
    {
        ["Title"] = model.Title.Trim(), ["Source"] = model.Source.Trim(), ["Year"] = model.Year, ["Link"] = model.Link.Trim()
    }, "Публікацію оновлено");
});

app.MapDelete("/api/publications/{id:int}", (HttpRequest http, int id) => DeleteSimple(http, connectionString, "Publications", id, adminToken, "Публікацію видалено"));

app.MapGet("/api/contacts", () =>
{
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = "SELECT Id, Email, Department, ConsultationSchedule, Office, ExtraLinks FROM ContactInfo LIMIT 1";
    using var r = cmd.ExecuteReader();
    return r.Read()
        ? Results.Ok(new ContactInfo(r.GetInt32(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetString(5)))
        : Results.NotFound();
});

app.MapPut("/api/contacts", (HttpRequest http, ContactInput model) =>
{
    if (!IsAuthorized(http)) return Results.Unauthorized();
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = @"
        UPDATE ContactInfo
        SET Email=$email, Department=$department, ConsultationSchedule=$schedule, Office=$office, ExtraLinks=$links
        WHERE Id=1";
    cmd.Parameters.AddWithValue("$email", model.Email.Trim());
    cmd.Parameters.AddWithValue("$department", model.Department.Trim());
    cmd.Parameters.AddWithValue("$schedule", model.ConsultationSchedule.Trim());
    cmd.Parameters.AddWithValue("$office", model.Office.Trim());
    cmd.Parameters.AddWithValue("$links", model.ExtraLinks.Trim());
    cmd.ExecuteNonQuery();
    return Results.Ok(new { message = "Контакти оновлено" });
});

app.MapFallback(async context =>
{
    var indexPath = Path.Combine(app.Environment.WebRootPath ?? string.Empty, "index.html");
    if (File.Exists(indexPath))
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(indexPath);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        await context.Response.WriteAsync("Frontend files were not found. Run npm run build or use the prepared archive.");
    }
});

app.Run();

static string HashPassword(string password)
{
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
    return Convert.ToHexString(bytes).ToLowerInvariant();
}

static IResult QueryList<T>(string connectionString, string sql, Func<SqliteDataReader, T> map)
{
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = sql;
    using var r = cmd.ExecuteReader();
    var items = new List<T>();
    while (r.Read()) items.Add(map(r));
    return Results.Ok(items);
}

static IResult InsertSimple(string connectionString, string table, Dictionary<string, object> values)
{
    if (values.TryGetValue("Title", out var title) && string.IsNullOrWhiteSpace(title?.ToString()))
    {
        return Results.BadRequest(new { message = "Назва є обов'язковою" });
    }

    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    var columns = string.Join(", ", values.Keys);
    var parameters = string.Join(", ", values.Keys.Select(k => "$" + k));
    cmd.CommandText = $"INSERT INTO {table} ({columns}) VALUES ({parameters}); SELECT last_insert_rowid();";
    foreach (var pair in values) cmd.Parameters.AddWithValue("$" + pair.Key, pair.Value);
    var id = Convert.ToInt32(cmd.ExecuteScalar());
    return Results.Created($"/api/{table.ToLowerInvariant()}/{id}", new { id });
}

static IResult UpdateSimple(string connectionString, string table, int id, Dictionary<string, object> values, string message)
{
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    var set = string.Join(", ", values.Keys.Select(k => $"{k}=${k}"));
    cmd.CommandText = $"UPDATE {table} SET {set} WHERE Id=$id";
    cmd.Parameters.AddWithValue("$id", id);
    foreach (var pair in values) cmd.Parameters.AddWithValue("$" + pair.Key, pair.Value);
    return cmd.ExecuteNonQuery() > 0 ? Results.Ok(new { message }) : Results.NotFound();
}

static IResult DeleteSimple(HttpRequest http, string connectionString, string table, int id, string adminToken, string message)
{
    if (http.Headers.Authorization.ToString() != $"Bearer {adminToken}") return Results.Unauthorized();
    using var con = new SqliteConnection(connectionString);
    con.Open();
    using var cmd = con.CreateCommand();
    cmd.CommandText = $"DELETE FROM {table} WHERE Id=$id";
    cmd.Parameters.AddWithValue("$id", id);
    return cmd.ExecuteNonQuery() > 0 ? Results.Ok(new { message }) : Results.NotFound();
}

static class Database
{
    public static void Initialize(string connectionString)
    {
        using var con = new SqliteConnection(connectionString);
        con.Open();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"
CREATE TABLE IF NOT EXISTS TeacherProfile (
    Id INTEGER PRIMARY KEY CHECK (Id = 1),
    FullName TEXT NOT NULL,
    Position TEXT NOT NULL,
    Education TEXT NOT NULL,
    Experience TEXT NOT NULL,
    Interests TEXT NOT NULL,
    About TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Courses (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Description TEXT NOT NULL,
    Semester TEXT NOT NULL,
    Hours INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Materials (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    CourseId INTEGER NOT NULL,
    Title TEXT NOT NULL,
    Type TEXT NOT NULL,
    Url TEXT NOT NULL,
    Description TEXT NOT NULL,
    FOREIGN KEY (CourseId) REFERENCES Courses(Id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Announcements (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Content TEXT NOT NULL,
    PublishDate TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Publications (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Source TEXT NOT NULL,
    Year INTEGER NOT NULL,
    Link TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ContactInfo (
    Id INTEGER PRIMARY KEY CHECK (Id = 1),
    Email TEXT NOT NULL,
    Department TEXT NOT NULL,
    ConsultationSchedule TEXT NOT NULL,
    Office TEXT NOT NULL,
    ExtraLinks TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS AdminUsers (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Login TEXT NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    Role TEXT NOT NULL
);

INSERT OR IGNORE INTO TeacherProfile (Id, FullName, Position, Education, Experience, Interests, About)
VALUES (1,
'Іваненко Олександр Петрович',
'викладач комп’ютерних дисциплін',
'магістр комп’ютерних наук, фахівець з вебтехнологій та баз даних',
'понад 8 років педагогічної діяльності у сфері інформаційних технологій',
'веброзробка, інформаційні системи, бази даних, цифровізація освітнього процесу',
'Персональний вебсайт призначений для представлення професійної діяльності викладача, розміщення навчальних матеріалів, оголошень, публікацій і контактної інформації.'
);

INSERT OR IGNORE INTO ContactInfo (Id, Email, Department, ConsultationSchedule, Office, ExtraLinks)
VALUES (1,
'ivanenko.teacher@example.edu.ua',
'циклова комісія комп’ютерних технологій',
'понеділок, середа 14:30–16:00',
'аудиторія 214',
'ORCID: https://orcid.org/0000-0000-0000-0000; Google Scholar: https://scholar.google.com/'
);

INSERT OR IGNORE INTO AdminUsers (Id, Login, PasswordHash, Role)
VALUES (1, 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'administrator');
";
        cmd.ExecuteNonQuery();

        SeedIfEmpty(con, "Courses", @"
INSERT INTO Courses (Title, Description, Semester, Hours) VALUES
('Основи веброзробки', 'Дисципліна присвячена створенню вебсторінок, роботі з HTML, CSS, JavaScript і принципам побудови клієнтської частини вебресурсів.', '3 семестр', 90),
('Бази даних', 'Курс охоплює реляційну модель даних, SQL-запити, структурування інформації та застосування SQLite у прикладних системах.', '4 семестр', 120),
('Програмування мовою C#', 'Дисципліна спрямована на вивчення синтаксису C#, об’єктно-орієнтованого програмування та створення серверних компонентів.', '5 семестр', 120);");

        SeedIfEmpty(con, "Materials", @"
INSERT INTO Materials (CourseId, Title, Type, Url, Description) VALUES
(1, 'Методичні рекомендації до лабораторної роботи 1', 'PDF', 'https://example.com/web-lab-1.pdf', 'Матеріал містить завдання зі створення структури HTML-сторінки.'),
(1, 'Презентація: адаптивна верстка', 'Презентація', 'https://example.com/responsive-design', 'Навчальний матеріал з принципів адаптивного компонування сторінок.'),
(2, 'Приклади SQL-запитів для SQLite', 'Посилання', 'https://www.sqlite.org/lang.html', 'Добірка прикладів для роботи з таблицями, фільтрацією та сортуванням даних.'),
(3, 'Конспект: основи ASP.NET Core API', 'PDF', 'https://example.com/aspnet-api.pdf', 'Короткий конспект для створення серверної частини вебзастосунку.');");

        SeedIfEmpty(con, "Announcements", @"
INSERT INTO Announcements (Title, Content, PublishDate) VALUES
('Оновлено матеріали до дисципліни Основи веброзробки', 'До розділу навчальних матеріалів додано презентацію про адаптивну верстку та приклади практичних завдань.', '2026-06-01'),
('Графік консультацій на поточний тиждень', 'Консультації проводяться в аудиторії 214 у понеділок та середу з 14:30 до 16:00.', '2026-06-03'),
('Підготовка до модульного контролю', 'Студентам рекомендовано повторити теми, пов’язані з формами, маршрутизацією сторінок і роботою з API.', '2026-06-05');");

        SeedIfEmpty(con, "Publications", @"
INSERT INTO Publications (Title, Source, Year, Link) VALUES
('Використання вебтехнологій у цифровому освітньому середовищі', 'Збірник матеріалів науково-практичної конференції', 2025, 'https://example.com/publication-1'),
('Організація навчальних матеріалів у персональних освітніх вебресурсах', 'Фаховий електронний журнал з інформаційних технологій', 2024, 'https://example.com/publication-2'),
('Практичне застосування SQLite у навчальних вебпроєктах', 'Матеріали методичного семінару', 2023, 'https://example.com/publication-3');");
    }

    private static void SeedIfEmpty(SqliteConnection con, string table, string insertSql)
    {
        using var countCmd = con.CreateCommand();
        countCmd.CommandText = $"SELECT COUNT(*) FROM {table}";
        var count = Convert.ToInt32(countCmd.ExecuteScalar());
        if (count > 0) return;
        using var seedCmd = con.CreateCommand();
        seedCmd.CommandText = insertSql;
        seedCmd.ExecuteNonQuery();
    }
}

record LoginRequest(string Login, string Password);
record TeacherProfile(int Id, string FullName, string Position, string Education, string Experience, string Interests, string About);
record TeacherProfileUpdate(string FullName, string Position, string Education, string Experience, string Interests, string About);
record Course(int Id, string Title, string Description, string Semester, int Hours);
record CourseInput(string Title, string Description, string Semester, int Hours);
record Material(int Id, int CourseId, string CourseTitle, string Title, string Type, string Url, string Description);
record MaterialInput(int CourseId, string Title, string Type, string Url, string Description);
record Announcement(int Id, string Title, string Content, string PublishDate);
record AnnouncementInput(string Title, string Content, string PublishDate);
record Publication(int Id, string Title, string Source, int Year, string Link);
record PublicationInput(string Title, string Source, int Year, string Link);
record ContactInfo(int Id, string Email, string Department, string ConsultationSchedule, string Office, string ExtraLinks);
record ContactInput(string Email, string Department, string ConsultationSchedule, string Office, string ExtraLinks);
