# LLM_Wiki — База знань про продукт / Product Knowledge Base

> **🧩 This is a GitHub template.** An LLM-native, session-free knowledge base:
> talk to an AI in plain language, it captures your knowledge as validated,
> interlinked notes. Ships empty — fork it and fill it with your own domain.
> **New here? → [GETTING_STARTED.md](GETTING_STARTED.md)** (requirements, setup,
> first session).

> 🇺🇦 [Інструкція українською](#-інструкція-українською) · 🇬🇧 [English guide](#-english-guide)

---

## 🇺🇦 Інструкція українською

### Зміст
1. [Що це](#що-це)
2. [З чого почати кожну сесію](#1-з-чого-почати-кожну-сесію)
3. [Як збирати знання](#2-як-збирати-знання-основний-режим)
4. [Подивитись зібране](#3-подивитись-що-вже-зібрано)
5. [Цілі, план розробки та дашборд](#4-цілі-план-розробки-та-дашборд)
6. [Змінити зібране](#5-змінити-вже-зібране)
7. [Збереження — автоматичне](#6-збереження--автоматичне)
8. [Налаштування](#7-налаштування-kbconfigyml)
9. [Здоров'я бази](#8-здоровя-бази)
10. [Шпаргалка команд](#9-типові-фрази-команди-шпаргалка)
11. [Правила порядку](#10-кілька-правил-які-тримають-порядок-для-довідки)

### Що це

Це **жива база знань** про продукт. Усе, що ми знаємо про продукт — бачення,
користувачів, фічі, вимоги, ринок, go-to-market — зберігається тут як набір
маленьких пов'язаних нотаток. Згодом на цій базі будуються специфікації, roadmap,
KPI та маркетингові стратегії.

**Головна ідея:** ти спілкуєшся зі мною (LLM) звичайною мовою — описуєш ідеї,
відповідаєш на питання. Я перетворюю розмову на структуровані нотатки й тримаю
все в порядку. Тобі **не потрібно** знати, як це влаштовано всередині.

### 1. З чого почати кожну сесію

Просто скажи: **«зорієнтуйся»** (або «де ми зупинились?»).

Я прочитаю поточний стан і відповім: на якій фазі ми, що вже зібрано, що робити
далі, які є відкриті питання. Це швидко й не вантажить усю базу.

> Технічно це запускає навичку `kb-orient`, але тобі достатньо просто попросити.

### 2. Як збирати знання (основний режим)

Скажи: **«давай збирати знання»** / **«продовжимо наповнювати базу»** — і ми
почнемо структуровану розмову.

Як це працює:

1. **Спочатку — карта.** Якщо база порожня, ми разом окреслимо *області*, які
   треба зібрати (бачення, користувачі, продукт, ринок, roadmap, go-to-market…).
   Це як зміст книги — каркас, який потім наповнюємо. Я запропоную стартовий
   набір; ти його коригуєш під свій продукт.
2. **Потім — згори вниз.** Беремо область → домовляємось, що в ній збирати →
   я ставлю уточнювальні питання, поки думка не стане завершеною → зберігаю її
   як нотатку.
3. **Нічого не губиться.** Якщо щось ще не з'ясовано — я фіксую це як *відкрите
   питання*, а не «забуваю».

Ти в будь-який момент можеш:
- **попросити пропозицію:** «запропонуй персони для нашого продукту»;
- **попросити дослідження:** «дослідь конкурентів у сфері бюджетування»;
- **перескочити тему:** заговорив про фічу під час обговорення бачення — нормально,
  я зафіксую й повернусь.

> Технічно це навичка `kb-elicit`.

### 3. Подивитись, що вже зібрано

- **«що ми вже знаємо про <тему>?»** — я знайду й перекажу (не читаючи всю базу).
  *(навичка `kb-recall`)*
- **«покажи карту»** — інтерактивна mind-map: у дашборді (вкладка «Мапа», з
  переходом у повний зміст нотаток) або як офлайн-файл `index/mindmap.html`.
  *(навички `kb-dashboard` / `kb-visualize`)*
- **«що ми робили сьогодні / цього тижня?»** або **«що змінилось щодо
  користувачів?»** — я зроблю короткий підсумок за період чи областю.
  *(навичка `kb-recap`)*

### 4. Цілі, план розробки та дашборд

Коли починається делівері, база стає і **PM-інструментом**:

- **Цілі.** Скажи: **«Створи Goal "Покращити комунікацію між агентами" — він
  включає: …»** — я створю ціль, знайду в базі існуючі нотатки для її складу,
  розпитаю/дослідж, сформулюю нові нотатки і додам їх у ціль. **Прогрес цілі
  рахується сам** зі статусів її задач — його не треба оновлювати руками.
  *(навичка `kb-goal`)*
- **Операційний план.** Плануй розмовою: **«зараз робимо A, потім B і C»**,
  **«E відклади в backlog»**, **«G піднімай з backlog»**, **«A зроблено»**.
  Я веду впорядковану чергу (порядок = послідовність виконання) і backlog;
  **виконане не зберігається списком — воно виводиться з історії змін плану**.
  *(навичка `kb-plan`)*
- **Timeline продукту.** Стадії розвитку одна за одною (наприклад: single-user →
  multi-user → beta → release) з плановими датами; статуси (досягнуто / в роботі /
  прострочено / наступна) і точка **«ми зараз тут»** обчислюються самі.
- **Живий дашборд.** Скажи **«відкрий дашборд»** — локальна сторінка
  (http://localhost:4321) із вкладками: **Продукт** (timeline, цілі з прогресом,
  концепція), **Розробка** (в роботі / черга / done / техборг), **Мапа**
  (інтерактивна mind-map), **KB** (здоров'я, динаміка). Клік на будь-який запис —
  повний зміст нотатки. Дашборд **тільки показує** — всі зміни йдуть через діалог,
  дані свіжі на кожне оновлення сторінки. *(навичка `kb-dashboard`)*

### 5. Змінити вже зібране

Знання еволюціонують. Просто скажи, що не так:

- **«перейменуй / уточни цю нотатку»** — я підправлю, нічого не зламавши.
- **«це насправді не вимога, а ризик»** (зміна суті/категорії) — я створю нову
  нотатку правильного типу, а стару акуратно позначу застарілою, зберігши зв'язки.
- **«об'єднай ці дві»** / **«розділи на дві»** — теж без проблем.

Я ніколи не видаляю інформацію «з кінцями» — стара завжди лишається в історії.
*(навичка `kb-evolve`; накопичений технічний борг прибирає `kb-sanitize` на запит)*

### 6. Збереження — автоматичне

Тобі **не треба думати про збереження**. Система сама зберігає зміни (через git) —
залежно від налаштування (див. розділ 7). За замовчуванням я **нагадаю**, коли
накопичиться достатньо незбережених змін, і збережу за твоїм словом.

Уся історія зберігається автоматично — будь-яку зміну згодом можна переглянути
чи відкотити.

### 7. Налаштування (`kb.config.yml`)

Один файл у корені керує поведінкою. Можеш не чіпати — дефолти безпечні. Якщо
треба:

```yaml
mode: debug            # debug = я показую деталі (ID, що змінив); autonomous = коротко й по-людськи
language: uk           # мова відповідей
owner: Andrii          # твоє ім'я

persistence:
  autocommit: manual   # off = не зберігати само; manual = нагадувати; auto = зберігати автоматично
  threshold: 10        # після скількох незбережених нотаток реагувати
  max_age_hours: 24    # або якщо найдавніша незбережена зміна старша за стільки годин
  remind_every_hours: 4 # (manual) не нагадувати частіше, ніж раз на стільки годин

health:
  duplicates:
    enabled: false     # шукати можливі дублікати нотаток (вимкнено — буває шумно)
    threshold: 0.92    # наскільки схожими мають бути назви, щоб вважатись дублем
```

**Два незалежні перемикачі:**
- `mode` — *як я говорю* (детально для тебе / коротко для не-технічного користувача).
- `persistence.autocommit` — *як зберігаються зміни* (вручну / нагадувати / автоматично).

**Поради:**
- Ти (технічний власник): `mode: debug` + `autocommit: manual` (контроль за тобою).
- Не-технічний користувач: `mode: autonomous` + `autocommit: auto` (усе само, тихо).

### 8. Здоров'я бази

Я веду звіт `index/health.md` — він показує, де база «провисає»:
- **відкриті питання / ризики / припущення** — над чим ще треба попрацювати;
- **порожні розділи карти** — області, які заявили, але не наповнили;
- **технічний борг** — посилання на застарілі нотатки, які варто оновити.

Скажи **«покажи здоров'я бази»** — і я зведу це в кілька рядків «що робити далі».

### 9. Типові фрази-команди (шпаргалка)

| Ти кажеш | Що відбувається |
|---|---|
| «зорієнтуйся» / «де ми?» | стан: фаза, план, прогрес, наступний крок |
| «давай збирати знання» | структурований діалог наповнення |
| «що ми знаємо про X?» | пошук і переказ по темі |
| «покажи карту» | інтерактивна mind-map (дашборд або файл) |
| «створи Goal "…" — включає …» | ціль зі складом і автопрогресом |
| «зараз робимо A, потім B» / «A зроблено» | операційний план: черга/backlog/done |
| «відкрий дашборд» | живий PM-дашборд у браузері |
| «що ми робили сьогодні?» | підсумок змін за період |
| «запропонуй…» / «дослідь…» | пропозиція / дослідження → у нотатки |
| «це насправді …, а не …» | безпечна зміна типу/суті нотатки |
| «покажи здоров'я бази» | сигнали: прогалини, питання, борг |
| «збережи» | зафіксувати зміни в історію |

### 10. Кілька правил, які тримають порядок (для довідки)

Це робить система сама — тобі знати не обов'язково, але якщо цікаво:

- Кожна нотатка має **сталий ідентифікатор**, який ніколи не змінюється й не
  перевикористовується — тому посилання між нотатками не ламаються.
- Папки `index/` і файли-звіти **генеруються автоматично** — їх не треба (і не
  можна) редагувати руками.
- Кожен запис нотатки автоматично доводиться до «здорового» стану (правильні
  поля, дати, зв'язки) і атомарно зберігається — пошкоджених файлів не буває.
- Система **самодостатня**: усі інструкції живуть у самому репозиторії, тож робота
  не залежить від конкретної розмови — будь-яка нова сесія продовжує з того ж місця.

**Коротко:** говори зі мною звичайною мовою про продукт. Решту — структуру,
збереження, порядок — беру на себе я.

---

## 🇬🇧 English guide

### Contents
1. [What this is](#what-this-is)
2. [Starting a session](#1-starting-a-session)
3. [Capturing knowledge](#2-capturing-knowledge-the-main-mode)
4. [Reviewing what's captured](#3-reviewing-whats-captured)
5. [Goals, delivery plan & dashboard](#4-goals-delivery-plan--dashboard)
6. [Changing what's captured](#5-changing-whats-captured)
7. [Saving is automatic](#6-saving-is-automatic)
8. [Configuration](#7-configuration-kbconfigyml)
9. [Knowledge-base health](#8-knowledge-base-health)
10. [Command cheat-sheet](#9-command-cheat-sheet)
11. [Rules that keep order](#10-rules-that-keep-order-for-reference)

### What this is

This is a **living knowledge base** about a product. Everything we know — vision,
users, features, requirements, market, go-to-market — is stored as a set of small,
interlinked notes. Specs, roadmap, KPIs, and marketing strategies are later built
on top of it.

**Core idea:** you talk to me (the LLM) in plain language — describe ideas, answer
questions. I turn the conversation into structured notes and keep everything tidy.
You **don't need** to know how it works under the hood.

### 1. Starting a session

Just say: **"orient"** (or "where did we leave off?").

I'll read the current state and tell you: what phase we're in, what's already
captured, what to do next, and any open questions. It's fast and doesn't load the
whole base.

> Technically this runs the `kb-orient` skill — but you only need to ask.

### 2. Capturing knowledge (the main mode)

Say: **"let's capture knowledge"** / **"let's keep filling the base"** — and we
start a structured conversation.

How it works:

1. **Map first.** If the base is empty, we sketch the *areas* to collect together
   (vision, users, product, market, roadmap, go-to-market…). Like a table of
   contents — a skeleton we then fill. I propose a starter set; you adapt it.
2. **Then top-down.** Pick an area → agree what to collect there → I ask clarifying
   questions until a thought is complete → I save it as a note.
3. **Nothing is lost.** Anything unresolved is recorded as an *open question*, not
   forgotten.

At any time you can:
- **ask for a proposal:** "propose personas for our product";
- **ask for research:** "research competitors in budgeting";
- **jump topics:** mention a feature while discussing vision — fine, I'll capture
  it and come back.

> Technically this is the `kb-elicit` skill.

### 3. Reviewing what's captured

- **"what do we already know about <topic>?"** — I find and summarize it (without
  reading the whole base). *(`kb-recall` skill)*
- **"show the map"** — an interactive mind-map: in the dashboard («Мапа» tab,
  with click-through to full notes) or as the offline file `index/mindmap.html`.
  *(`kb-dashboard` / `kb-visualize` skills)*
- **"what did we do today / this week?"** or **"what changed about users?"** — I
  give a short summary by period or area. *(`kb-recap` skill)*

### 4. Goals, delivery plan & dashboard

Once delivery starts, the base doubles as a **PM tool**:

- **Goals.** Say: **"Create a Goal 'Improve agent communication' — it includes: …"**
  — I create the goal, find existing notes for its scope, ask/research to
  formulate new ones, and add them. **Goal progress is computed** from the
  statuses of its items — never updated by hand. *(`kb-goal` skill)*
- **Operational plan.** Plan by talking: **"now we do A, then B and C"**,
  **"park E in the backlog"**, **"promote G from the backlog"**, **"A is done"**.
  I keep an ordered queue (order = execution sequence) and a backlog; **done is
  never stored as a list — it is derived from the plan's change history**.
  *(`kb-plan` skill)*
- **Product timeline.** Development stages one after another (e.g. single-user →
  multi-user → beta → release) with planned dates; states (reached / in work /
  overdue / next) and the **"we are here"** point are computed automatically.
- **Live dashboard.** Say **"open the dashboard"** — a local page
  (http://localhost:4321) with tabs: **Product** (timeline, goals with progress,
  vision), **Delivery** (in work / queue / done / tech debt), **Map** (interactive
  mind-map), **KB** (health, trends). Click any entry for the full note. The
  dashboard is **read-only** — all changes go through dialogue; data is fresh on
  every page refresh. *(`kb-dashboard` skill)*

### 5. Changing what's captured

Knowledge evolves. Just tell me what's off:

- **"rename / refine this note"** — I'll adjust it without breaking anything.
- **"this is actually a risk, not a requirement"** (a change of meaning/category) —
  I create a new note of the correct type and mark the old one deprecated, keeping
  the links intact.
- **"merge these two"** / **"split into two"** — no problem.

I never delete information for good — the old version always remains in history.
*(`kb-evolve` skill; accumulated technical debt is cleaned by `kb-sanitize` on request)*

### 6. Saving is automatic

You **don't need to think about saving**. The system stores changes itself (via
git), depending on the setting (see section 7). By default I'll **remind** you when
enough unsaved changes pile up, and save on your word.

All history is kept automatically — any change can later be reviewed or rolled back.

### 7. Configuration (`kb.config.yml`)

One file at the root controls behavior. You can leave it alone — defaults are safe.
If needed:

```yaml
mode: debug            # debug = I show details (IDs, what I changed); autonomous = short & human
language: uk           # response language
owner: Andrii          # your name

persistence:
  autocommit: manual   # off = don't save by itself; manual = remind; auto = save automatically
  threshold: 10        # after how many unsaved notes to react
  max_age_hours: 24    # or if the oldest unsaved change is older than this many hours
  remind_every_hours: 4 # (manual) don't remind more often than once per this many hours

health:
  duplicates:
    enabled: false     # look for possible duplicate notes (off — can be noisy)
    threshold: 0.92    # how similar titles must be to count as a duplicate
```

**Two independent switches:**
- `mode` — *how I talk* (detailed for you / short for a non-technical user).
- `persistence.autocommit` — *how changes are saved* (manual / remind / automatic).

**Tips:**
- You (technical owner): `mode: debug` + `autocommit: manual` (you stay in control).
- Non-technical user: `mode: autonomous` + `autocommit: auto` (all automatic, quiet).

### 8. Knowledge-base health

I maintain an `index/health.md` report showing where the base is thin:
- **open questions / risks / assumptions** — what still needs work;
- **empty map sections** — areas declared but not filled;
- **technical debt** — links to deprecated notes worth updating.

Say **"show the base health"** and I'll boil it down to a few "what's next" lines.

### 9. Command cheat-sheet

| You say | What happens |
|---|---|
| "orient" / "where are we?" | state: phase, plan, progress, next step |
| "let's capture knowledge" | structured capture dialogue |
| "what do we know about X?" | search and summary by topic |
| "show the map" | interactive mind-map (dashboard or file) |
| "create a Goal '…' — it includes …" | goal with scope and auto-progress |
| "now we do A, then B" / "A is done" | operational plan: queue/backlog/done |
| "open the dashboard" | live PM dashboard in the browser |
| "what did we do today?" | summary of changes over a period |
| "propose…" / "research…" | proposal / research → into notes |
| "this is actually …, not …" | safe change of a note's type/meaning |
| "show the base health" | signals: gaps, questions, debt |
| "save" | commit changes to history |

### 10. Rules that keep order (for reference)

The system does this itself — you needn't know, but if you're curious:

- Every note has a **stable identifier** that never changes or gets reused — so
  links between notes never break.
- The `index/` folder and report files are **generated automatically** — don't
  (and can't) edit them by hand.
- Every note write is automatically brought to a "healthy" state (correct fields,
  dates, links) and saved atomically — no corrupted files.
- The system is **self-contained**: all instructions live in the repository itself,
  so work doesn't depend on any one conversation — any new session continues from
  the same place.

**In short:** talk to me in plain language about the product. The rest — structure,
saving, order — is on me.
