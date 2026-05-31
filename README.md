# LLM_Wiki — База знань про продукт / Product Knowledge Base

> 🇺🇦 [Інструкція українською](#-інструкція-українською) · 🇬🇧 [English guide](#-english-guide)

---

## 🇺🇦 Інструкція українською

### Зміст
1. [Що це](#що-це)
2. [З чого почати кожну сесію](#1-з-чого-почати-кожну-сесію)
3. [Як збирати знання](#2-як-збирати-знання-основний-режим)
4. [Подивитись зібране](#3-подивитись-що-вже-зібрано)
5. [Змінити зібране](#4-змінити-вже-зібране)
6. [Збереження — автоматичне](#5-збереження--автоматичне)
7. [Налаштування](#6-налаштування-kbconfigyml)
8. [Здоров'я бази](#7-здоровя-бази)
9. [Шпаргалка команд](#8-типові-фрази-команди-шпаргалка)
10. [Правила порядку](#9-кілька-правил-які-тримають-порядок-для-довідки)

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
- **«покажи карту»** — я згенерую **графічну mind-map** і дам посилання, щоб
  відкрити її у браузері (інтерактивна: масштаб, згортання гілок).
  *(навичка `kb-visualize`; файл `index/mindmap.html`)*
- **«що ми робили сьогодні / цього тижня?»** або **«що змінилось щодо
  користувачів?»** — я зроблю короткий підсумок за період чи областю.
  *(навичка `kb-recap`)*

### 4. Змінити вже зібране

Знання еволюціонують. Просто скажи, що не так:

- **«перейменуй / уточни цю нотатку»** — я підправлю, нічого не зламавши.
- **«це насправді не вимога, а ризик»** (зміна суті/категорії) — я створю нову
  нотатку правильного типу, а стару акуратно позначу застарілою, зберігши зв'язки.
- **«об'єднай ці дві»** / **«розділи на дві»** — теж без проблем.

Я ніколи не видаляю інформацію «з кінцями» — стара завжди лишається в історії.
*(навичка `kb-evolve`; накопичений технічний борг прибирає `kb-sanitize` на запит)*

### 5. Збереження — автоматичне

Тобі **не треба думати про збереження**. Система сама зберігає зміни (через git) —
залежно від налаштування (див. розділ 6). За замовчуванням я **нагадаю**, коли
накопичиться достатньо незбережених змін, і збережу за твоїм словом.

Уся історія зберігається автоматично — будь-яку зміну згодом можна переглянути
чи відкотити.

### 6. Налаштування (`kb.config.yml`)

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

### 7. Здоров'я бази

Я веду звіт `index/health.md` — він показує, де база «провисає»:
- **відкриті питання / ризики / припущення** — над чим ще треба попрацювати;
- **порожні розділи карти** — області, які заявили, але не наповнили;
- **технічний борг** — посилання на застарілі нотатки, які варто оновити.

Скажи **«покажи здоров'я бази»** — і я зведу це в кілька рядків «що робити далі».

### 8. Типові фрази-команди (шпаргалка)

| Ти кажеш | Що відбувається |
|---|---|
| «зорієнтуйся» / «де ми?» | стан: фаза, прогрес, наступний крок |
| «давай збирати знання» | структурований діалог наповнення |
| «що ми знаємо про X?» | пошук і переказ по темі |
| «покажи карту» | графічна mind-map у браузері |
| «що ми робили сьогодні?» | підсумок змін за період |
| «запропонуй…» / «дослідь…» | пропозиція / дослідження → у нотатки |
| «це насправді …, а не …» | безпечна зміна типу/суті нотатки |
| «покажи здоров'я бази» | сигнали: прогалини, питання, борг |
| «збережи» | зафіксувати зміни в історію |

### 9. Кілька правил, які тримають порядок (для довідки)

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
5. [Changing what's captured](#4-changing-whats-captured)
6. [Saving is automatic](#5-saving-is-automatic)
7. [Configuration](#6-configuration-kbconfigyml)
8. [Knowledge-base health](#7-knowledge-base-health)
9. [Command cheat-sheet](#8-command-cheat-sheet)
10. [Rules that keep order](#9-rules-that-keep-order-for-reference)

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
- **"show the map"** — I generate a **graphical mind-map** and give you a link to
  open it in a browser (interactive: zoom, collapse branches).
  *(`kb-visualize` skill; file `index/mindmap.html`)*
- **"what did we do today / this week?"** or **"what changed about users?"** — I
  give a short summary by period or area. *(`kb-recap` skill)*

### 4. Changing what's captured

Knowledge evolves. Just tell me what's off:

- **"rename / refine this note"** — I'll adjust it without breaking anything.
- **"this is actually a risk, not a requirement"** (a change of meaning/category) —
  I create a new note of the correct type and mark the old one deprecated, keeping
  the links intact.
- **"merge these two"** / **"split into two"** — no problem.

I never delete information for good — the old version always remains in history.
*(`kb-evolve` skill; accumulated technical debt is cleaned by `kb-sanitize` on request)*

### 5. Saving is automatic

You **don't need to think about saving**. The system stores changes itself (via
git), depending on the setting (see section 6). By default I'll **remind** you when
enough unsaved changes pile up, and save on your word.

All history is kept automatically — any change can later be reviewed or rolled back.

### 6. Configuration (`kb.config.yml`)

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

### 7. Knowledge-base health

I maintain an `index/health.md` report showing where the base is thin:
- **open questions / risks / assumptions** — what still needs work;
- **empty map sections** — areas declared but not filled;
- **technical debt** — links to deprecated notes worth updating.

Say **"show the base health"** and I'll boil it down to a few "what's next" lines.

### 8. Command cheat-sheet

| You say | What happens |
|---|---|
| "orient" / "where are we?" | state: phase, progress, next step |
| "let's capture knowledge" | structured capture dialogue |
| "what do we know about X?" | search and summary by topic |
| "show the map" | graphical mind-map in the browser |
| "what did we do today?" | summary of changes over a period |
| "propose…" / "research…" | proposal / research → into notes |
| "this is actually …, not …" | safe change of a note's type/meaning |
| "show the base health" | signals: gaps, questions, debt |
| "save" | commit changes to history |

### 9. Rules that keep order (for reference)

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
