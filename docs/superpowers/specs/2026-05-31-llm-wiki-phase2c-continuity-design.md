# LLM-Wiki Phase 2c: Continuity — Design Spec

- **Дата:** 2026-05-31
- **Статус:** Draft (design) — очікує review
- **Репозиторій:** `abc-budget/requirements`
- **Спирається на:** Phase 1 + 2a + 2b (merged, 93 tests)
- **Попередні специфікації:** knowledge-system-design, phase2a, phase2b

---

## 1. Мета і скоуп

Зробити роботу **безперервною між сесіями** — нічого не губиться, навіть якщо
користувач не знає про git і ніколи не просить підсумків. Це остання
інфраструктурна підсистема (**2c**).

**Ключове прозріння (визначило весь дизайн):** персистентність і recap — це **дві
незалежні системи**, які я спершу плутав:

1. **Персистентність** — *автоматична, обов'язкова, невидима.* Гарантує «нічого
   не губиться»: незакоммічені зміни в `knowledge/` надійно потрапляють у git.
   Працює завжди, незалежно від recap.
2. **Recap** — *опційний, на вимогу, read-only, ефемерний.* Відповідає на питання
   про історію наративом. Користувач не питає — система чудово живе без жодного
   recap. Recap нічого не зберігає й не рухає станів.

git-історія — **єдине сховище** історії змін. Немає `journal/`, немає чекпоінтів
(обидва відкинуто як зайве дублювання git).

**Поза скоупом 2c:** повна полірувка autonomous-тону в усіх скілах (поведінкова,
не інфраструктурна), Phase 3 (генерація `docs/`).

---

## 2. Система 1 — Персистентність (автокоміт)

### 2.1 Принцип

Скрипт-оцінювач запускається на **кожне повідомлення користувача**
(UserPromptSubmit hook — природне «тікання годинника»), оцінює стан і, за
конфігом, або комітить, або тихо натякає, або мовчить.

«Незакоммічена зміна» = будь-який запис у `knowledge/` зі станом git
**`??` (untracked) / `M` (modified) / `D` (deleted)**. Untracked критично: на
старті база порожня й **усі** нотатки untracked — оцінювач мусить їх бачити.

### 2.2 `tools/should-commit.mjs` — оцінювач

Чиста функція + CLI. Повертає рішення без побічних дій:
```
{ shouldRemindOrCommit: bool, reason, count, oldestAgeHours }
```
Логіка (пороги з конфігу, «АБО»):
1. **Об'єм:** `count` незакоммічених файлів у `knowledge/` ≥ `threshold`.
2. **Вік:** найдавніша незакоммічена зміна старша за `max_age_hours`.

**Вік рахується через git-маркер, НЕ через mtime файлу** (mtime на Windows
ненадійний — зачіпається checkout/reindex). Механізм: невеликий маркер-файл
(напр. `.git/kb-oldest-dirty`, поза версіонуванням) зберігає час, коли робоче
дерево *вперше* розійшлося з HEAD після чистого стану. Оновлюється так:
- якщо дерево чисте (немає `??`/`M`/`D` у `knowledge/`) → маркер видаляється;
- якщо дерево брудне, а маркера немає → маркер створюється з поточним часом;
- після коміту (дерево знову чисте) → маркер видаляється.
`oldestAgeHours` = (зараз − час у маркері). Час інжектується (узгоджено з
обмеженням «Date.now недоступний у деяких контекстах» — CLI передає поточний час).

### 2.3 Поведінка за конфігом `persistence.autocommit`

Тривимірний перемикач, **незалежний від `mode`** (`mode` = тон спілкування;
`autocommit` = поведінка git — два окремі виміри):

| `autocommit` | Оцінювач запускається? | Дія при перевищенні порогів |
|---|---|---|
| **`off`** | ні | нічого; git цілком на користувачеві |
| **`manual`** | так | **тільки натякає** (`ℹ N незбережених нотаток, найстарішій Xг`); коміт ручний |
| **`auto`** | так | **автоматичний коміт** |

**Анти-шум для `manual` (дебаунс за часом):** натяк показується не частіше, ніж
раз на `remind_every_hours`, навіть якщо пороги перевищені на кожному
повідомленні. Окремий маркер часу останнього натяку (напр. `.git/kb-last-remind`);
мовчимо, поки не мине інтервал. Без цього `manual` шумів би на кожне повідомлення.

### 2.4 Автокоміт (`auto`) — `tools/auto-commit.mjs`

Коли `auto` і пороги перевищені:
1. `node tools/reindex.mjs` (свіжі індекси) + `node tools/graph.mjs` (health).
2. `git add knowledge/ index/` — **виключно** ці шляхи (безпека: ніякого коду/
   секретів/іншого; blast radius мінімальний — текстова база, кожна нотатка вже
   пройшла `validate`+atomic-write).
3. `git commit` з авто-повідомленням із дельти (перевикористовуємо
   `session-delta.mjs` §3): напр. `kb: +3 notes, 1 updated`.
4. Скинути git-маркери (§2.2, §2.3).

### 2.5 UserPromptSubmit hook

Новий hook у `.claude/settings.json`. Запускає `should-commit.mjs`; за
`persistence.autocommit`:
- `off` → no-op;
- `manual` → якщо дебаунс дозволяє і пороги перевищені, вивести натяк (текст
  потрапляє в контекст як нагадування);
- `auto` → якщо пороги перевищені, виконати `auto-commit.mjs`.

Рекомендовані дефолти: `manual` (безпечно — нічого не комітить само, але страхує).
Для autonomous-розгортання сетап виставляє `auto`.

---

## 3. Система 2 — Recap (опційний, read-only)

### 3.1 Принцип

Recap — **гнучкий запит по git-історії**, не механізм збереження. Генерується на
вимогу, показується, нічого не пише (ефемерний). `journal/` не існує.

### 3.2 `tools/session-delta.mjs` — факти з git, параметризовані за діапазоном

Чиста функція + CLI. Приймає **діапазон** і повертає структуровані факти:
```
sessionDelta({ since, area }) → { added, updated, deprecated, openQuestions, range }
```
Діапазон задає користувач природною мовою, LLM мапить на параметри:
- «за сьогодні» / «з минулого тижня» → `since` (git `--since=...`);
- «що ми обговорювали стосовно <області>» → `area` (фільтр по папці/`topic`);
- «від останнього коміту» → відповідний git-ref.
Факти беруться з `git log`/`git diff` по `knowledge/` у межах діапазону:
додані/змінені/deprecated нотатки, нові `Q-`/`RISK-`/`ASMP-`. LLM пише наратив
поверх фактів (факти від машини — точність; наратив від LLM — сенс).

### 3.3 Скіл `kb-recap`

`.claude/skills/kb-recap/SKILL.md`. **Опційний**, на запит користувача.
1. Розпарсити запитаний діапазон (час / область / ref) → параметри.
2. `node tools/session-delta.mjs` з цими параметрами → факти.
3. Написати наратив: що додано/змінено/застаріло/нові питання у цьому діапазоні.
4. `debug`: з ID; `autonomous`: людською мовою без ID/механіки.
Нічого не зберігає. Якщо діапазон порожній — «змін у цьому періоді немає».

---

## 4. Конфіг (`kb.config.yml` + `lib/config.mjs`)

Нова секція `persistence` (опційна; дефолти у `lib/config.mjs` через той самий
вкладений мердж, що й `health`):
```yaml
mode: debug              # тон: debug | autonomous (незалежно від autocommit)
language: uk
owner: Andrii
health:
  duplicates: { enabled: false, threshold: 0.92 }
persistence:
  autocommit: manual     # off | manual | auto
  threshold: 10          # незакоммічених файлів → дія (auto/manual)
  max_age_hours: 24      # вік найдавнішої незакоммічаної зміни → дія
  remind_every_hours: 4  # manual: анти-шум дебаунс натяку
```
`lib/config.mjs` `DEFAULTS` розширюється секцією `persistence` з цими значеннями;
глибокий мердж гарантує дефолти при відсутній/частковій секції.

---

## 5. Файлова структура (нове/змінене)

```
lib/config.mjs                   # MODIFY — persistence defaults (nested merge)
kb.config.yml                    # MODIFY — persistence section
lib/git-status.mjs               # NEW — parse `git status --porcelain` for knowledge/ (??/M/D)
tools/should-commit.mjs          # NEW — evaluator {shouldRemindOrCommit, reason, count, oldestAgeHours}
tools/auto-commit.mjs            # NEW — reindex+graph + git add knowledge/ index/ + commit
tools/session-delta.mjs          # NEW — facts from git by range (since/area)
tools/user-prompt-hook.mjs       # NEW — UserPromptSubmit entry: dispatch off/manual/auto
.claude/settings.json            # MODIFY — add UserPromptSubmit hook
.claude/skills/kb-recap/SKILL.md # NEW — optional read-only recap
CLAUDE.md                        # MODIFY — document persistence + kb-recap + autocommit modes
STATE.md                         # MODIFY — Phase 2c available
test/git-status.test.mjs         # NEW
test/should-commit.test.mjs      # NEW
test/session-delta.test.mjs      # NEW
```

Примітка: маркери `.git/kb-oldest-dirty`, `.git/kb-last-remind` живуть у `.git/`
(не версіонуються; локальний стан персистентності).

---

## 6. Тестова стратегія

- **`git-status.mjs` (юніт):** парсить `??`/`M`/`D` у `knowledge/`; ігнорує інші
  шляхи; чисте дерево → порожньо. (Через tmp git-репо у фікстурі.)
- **`should-commit.mjs` (юніт):** об'єм-поріг спрацьовує; вік-поріг спрацьовує
  (інжектований «зараз» + маркер); обидва нижче → false; untracked рахуються;
  маркер створюється/видаляється коректно.
- **`session-delta.mjs` (юніт):** факти за діапазоном `since`; фільтр за `area`;
  класифікація added/updated/deprecated; порожній діапазон → порожньо.
- **`config.mjs` (юніт):** `persistence` дефолти при відсутній/частковій секції;
  існуючі `mode`/`health` не ламаються.
- **Інтеграція (smoke):** у tmp-репо — створити N нотаток (untracked), оцінювач
  каже commit, `auto-commit` комітить тільки `knowledge/`+`index/`, маркери
  скинуті, друге опитування → false.
- **Скіл `kb-recap`:** валідність frontmatter; ручний прохід — не юніт.
- **Регресія:** наявні 93 тести лишаються зеленими.

---

## 7. Відкриті питання (реалізаційні)

- `Q-2C-001`: формат авто-повідомлення коміту — `kb: +N notes, M updated, K deprecated`?
  Уточнити при реалізації `auto-commit.mjs` (перевикористати факти session-delta).
- `Q-2C-002`: як натяк `manual` потрапляє «в контекст» — UserPromptSubmit hook
  друкує рядок, що додається до контексту LLM, який його переказує користувачу.
  Уточнити механіку виводу hook при реалізації (узгодити з тим, як CC показує
  UserPromptSubmit-вивід).
- `Q-2C-003`: чи виносити автокоміт-`reindex`/`graph` у спільний крок із наявним
  Stop-hook reindex, щоб не дублювати. Ймовірно — `auto-commit` сам викликає
  reindex, а Stop-hook лишається для не-autocommit потоку. Вирішити при реалізації.
