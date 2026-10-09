export type Lang="ru"|"en";

const ruBase={
start:(name:string)=>`🤖 Привет, ${name}!

Creator AI превращает идеи и готовые материалы в контент:

✦ Посты и сценарии
✦ Repurpose и контент-планы
✦ Адаптация под разные площадки
✦ Твой стиль

⚡ Меньше времени. Больше контента.

Что создаём сегодня? 👇`,
postEntry:`✦ Creator AI / Post Maker

Превратим твою идею в сильный пост.

Напиши тему или набросок.

Я помогу:
— Hook
— структура
— главная мысль
— адаптация под площадку

Начни с идеи — остальное сделаем вместе.`,
scriptEntry:`✦ Creator AI / Script Maker

Превратим твою идею в ролик, который хочется досмотреть.

Напиши тему, идею или что хочешь донести зрителю.

Я помогу:
— создать сильный Hook с первых секунд
— выстроить сценарий и динамику
— написать текст для диктора
— подобрать визуал
— добавить текст на экран и CTA

Начни с идеи — сценарий соберём вместе.`,
repEntry:`✦ Creator AI / Repurpose

Превратим твой готовый материал в контент для разных площадок.

Отправь один материал:

📝 Текст — одним сообщением, до 4 000 символов

📄 Документ — PDF, DOC или TXT, до 5 MB и до 20 000 символов текста после обработки

Один материал. Несколько форматов. Больше контента.`,
planEntry:`✦ Creator AI / Content Plan

Создадим контент-план на 7 дней, чтобы тебе не приходилось каждый день думать, что публиковать.

Напиши свою тему, нишу или цель — например, что хочешь продвигать или о чём рассказывать.

7 дней. 7 идей. Один понятный план действий.`,
styleEntry:`✦ Creator AI / My Style

Научим Creator AI писать контент в твоей манере.

Отправь свои посты или другие материалы, которые хорошо передают твой стиль.

📚 Можно отправить от 5 до 20 примеров.
Отправляй их по одному или несколько подряд.

Я помогу:
— проанализировать твою манеру общения
— определить тон и характер текста
— понять структуру твоих публикаций
— выделить характерные слова и приёмы
— использовать этот стиль при создании нового контента

💡 Совет:
Лучше отправлять материалы, которые максимально похожи на то, как ты обычно пишешь.

🔹 Получено: 0 / 20

После 5 примеров можно будет запустить анализ.

Твой стиль. Твои мысли. Creator AI помогает оформить их в контент.`,
styleCollecting:(count:number)=>`🧠 Готово.

Теперь отправляй свои тексты один за другим.

Для первого анализа нужно минимум 5 примеров.
Можно отправить до 20.

Получено: ${count} / 20`,
styleProgress:(count:number)=>`🧠 Готово.

Теперь отправляй свои тексты один за другим.

Для первого анализа нужно минимум 5 примеров.
Можно отправить до 20.

Получено: ${count} / 20`,
styleReady:(count:number)=>`✦ Creator AI / My Style

Отлично. Уже достаточно примеров для первого анализа.

🔹 Получено: ${count} / 20

Можешь отправить ещё примеры, чтобы Creator AI точнее понял твою манеру, или запустить анализ уже сейчас.`,
styleDone:`🧠 Получено 20/20 примеров.

Этого достаточно для анализа твоего стиля.`,
history:`✦ CREATOR AI / HISTORY

Твоя личная библиотека важных материалов.

Сюда попадает только то, что ты сам решил сохранить.

⭐ Сохраняй нужное. Возвращайся к важному. Продолжай работу.`,
noHistory:`✦ CREATOR AI / HISTORY

Пока ничего не сохранено.`,
repSelect:(price:number)=>`♻️ Creator AI / Repurpose

Материал проанализирован.
Теперь выбери, какой контент создать из него.

💳 Стоимость: ${price} 🔹`,
settings:`⚙️ Creator AI / Настройки

Здесь можно изменить основные параметры Creator AI.`,
account:(name:string,id:string,credits:number,plan:string,date:string)=>`👤 CREATOR AI / АККАУНТ

Твоя информация в Creator AI.

👤 ${name}
ID: ${id}

🔹 ${credits} кредитов
💎 ${plan}
📅 Подписка до: ${date}`,
language:`🌐 CREATOR AI / ЯЗЫК

Выбери язык интерфейса и общения с Creator AI.`,
notifications:(enabled:boolean)=>`🔔 CREATOR AI / УВЕДОМЛЕНИЯ

Будь в курсе новых возможностей Creator AI.

📢 Новости и обновления
Получать сообщения о новых функциях, важных изменениях и событиях Creator AI.

${enabled?"🔔 Уведомления включены":"🔕 Уведомления выключены"}`,
help:`💬 Помощь

Возник вопрос или нужна помощь?

Наша поддержка поможет разобраться с Creator AI и ответит на твои вопросы.`,
terms:`⚖️ Условия использования

Здесь размещены актуальные Условия использования Creator AI.`,
privacy:`🛡️ Конфиденциальность

Здесь размещена актуальная Политика конфиденциальности Creator AI.`,
locked:`⏳ Генерация ещё выполняется…

Creator AI сейчас создаёт твой контент.

Дождись завершения текущей операции и попробуй снова.`,
aiError:`😔 Ой, что-то пошло не так

Не удалось создать контент.

Кредиты не списаны.

Попробуй запустить генерацию ещё раз.`,
deliveryError:`⚠️ Не удалось отправить результат

Контент был успешно создан, но Telegram не смог его доставить.

Мы сохранили результат и попробуем отправить его снова.`,
unsupported:`⚠️ Этот формат пока не поддерживается

Отправь текст, PDF, DOC или TXT.`,
sourceInvalid:`⚠️ Материал не прошёл проверку

Проверь формат и размер файла или отправь другой материал.`,
saved:`⭐ Сохранено в историю.`,
alreadySaved:`⭐ Этот результат уже сохранён в историю.`,
deleted:`🗑 Удалено из истории.`,
insufficient:(required:number,available:number)=>`⚠️ Недостаточно кредитов

Для этой генерации нужно ${required} 🔹, а у тебя сейчас ${available} 🔹.

Пополни баланс или выбери другой тариф, чтобы продолжить.`,
notificationsTitle:`🔔 CREATOR AI / УВЕДОМЛЕНИЯ`,
tariffs:(p:any,d:any)=>`💎 CREATOR AI / ТАРИФЫ

Выбирай уровень, который подходит твоему темпу создания контента.

✨ FREE
10 кредитов в месяц
Для знакомства с Creator AI.
🕘 История — ${d.free}

⚡ CREATOR
${p.creatorStars} ⭐ / месяц
${p.creatorCredits} кредитов
Для регулярного создания контента.
🕘 История — ${d.creator}

🚀 PRO
${p.proStars} ⭐ / месяц
${p.proCredits} кредитов
Для тех, кто создаёт контент каждый день.
🕘 История — ${d.pro}

Больше контента. Меньше ограничений.`,
credits:(balance:number,p:number[])=>`💎 CREATOR AI / КРЕДИТЫ

Твой текущий баланс:

🔹 ${balance} кредитов

Не хочешь менять тариф?
Просто пополни баланс и продолжай создавать контент.

✨ Выбери пакет кредитов:

🔹 50 кредитов — ${p[0]} ⭐
🔹 100 кредитов — ${p[1]} ⭐
🔹 250 кредитов — ${p[2]} ⭐
🔹 500 кредитов — ${p[3]} ⭐

⚡ Кредиты можно использовать для любых доступных генераций.

Купи только то, что тебе действительно нужно.`,
postConfig:(price:number,d:any)=>`✦ Creator AI / Post Maker

Твоя идея готова.
Теперь настроим, как она будет выглядеть.

💳 Стоимость генерации: ${price} 🔹

📱 Площадка: ${d.platform}
🎨 Стиль: ${d.style}
📏 Размер: ${d.length}`,
scriptConfig:(price:number,d:any)=>`🎬 Creator AI / Script Maker

Выбери, каким будет твой ролик.

💳 Стоимость генерации: ${price} 🔹

📱 Формат: ${d.platform}
🎨 Стиль: ${d.style}
⏱️ Длительность: ${d.duration} сек`,
planConfig:(price:number,d:any)=>`📅 Creator AI / Content Plan

Настрой параметры контент-плана.

💳 Стоимость генерации: ${price} 🔹

🎯 Цель: ${d.goal}
📱 Площадка: ${d.platform}
🎨 Стиль: ${d.style}`,
processingSteps:(type:string)=>type==="post"?["🧠 Анализирую материал…","🔎 Выделяю главное…","✍️ Адаптирую контент…","✨ Финальные штрихи…"]:type==="script"?["🧠 Анализирую идею…","🔥 Собираю сильный Hook…","✍️ Пишу сценарий…","✨ Финальные штрихи…"]:type==="content_plan"?["🧠 Анализирую тему…","🎯 Определяю цели контента…","💡 Придумываю идеи на неделю…","✨ Формирую контент-план…"]:["🧠 Анализирую материал…","🔎 Выделяю главное…","✍️ Адаптирую контент…","✨ Финальные штрихи…"]
};

const enBase={
start:(name:string)=>`🤖 Hi, ${name}!

Creator AI turns ideas and ready-made materials into content:

✦ Posts and scripts
✦ Repurpose and content plans
✦ Adaptation for different platforms
✦ Your style

⚡ Less time. More content.

What shall we create today? 👇`,
postEntry:`✦ Creator AI / Post Maker

Turn your idea into a strong post.

Send a topic or draft.

I'll help with:
— Hook
— structure
— main idea
— platform adaptation

Start with an idea — we'll do the rest together.`,
scriptEntry:`✦ Creator AI / Script Maker

Turn your idea into a video people want to finish.

Send a topic, idea or what you want the viewer to understand.

I'll help with:
— a strong opening Hook
— script flow and dynamics
— voice-over text
— visuals
— on-screen text and CTA

Start with an idea — we'll build the script together.`,
repEntry:`✦ Creator AI / Repurpose

Turn your ready material into content for different platforms.

Send one material:

📝 Text — one message, up to 4,000 characters

📄 Document — PDF, DOC or TXT, up to 5 MB and up to 20,000 extracted text characters

One material. Multiple formats. More content.`,
planEntry:`✦ Creator AI / Content Plan

Create a 7-day content plan so you do not have to think about what to publish every day.

Send your topic, niche or goal.

7 days. 7 ideas. One clear action plan.`,
styleEntry:`✦ Creator AI / My Style

Teach Creator AI to write in your manner.

Send your posts or other materials that represent your style well.

📚 Send 5 to 20 examples.
Send them one by one or several in a row.

🔹 Received: 0 / 20

You can start analysis after 5 examples.`,
styleCollecting:(count:number)=>`🧠 Done.

Now send your texts one by one.

First analysis needs at least 5 examples.
You can send up to 20.

Received: ${count} / 20`,
styleProgress:(count:number)=>`🧠 Done.

Now send your texts one by one.

First analysis needs at least 5 examples.
You can send up to 20.

Received: ${count} / 20`,
styleReady:(count:number)=>`✦ Creator AI / My Style

Great. There are enough examples for the first analysis.

🔹 Received: ${count} / 20

You can add more examples or start the analysis now.`,
styleDone:`🧠 Received 20/20 examples.

That is enough to analyze your style.`,
history:`✦ CREATOR AI / HISTORY

Your personal library of important materials.

Only items you explicitly saved appear here.

⭐ Save what matters. Return to what is important. Keep working.`,
noHistory:`✦ CREATOR AI / HISTORY

Nothing saved yet.`,
repSelect:(price:number)=>`♻️ Creator AI / Repurpose

The material was analyzed.
Now choose what to create from it.

💳 Cost: ${price} 🔹`,
settings:`⚙️ Creator AI / Settings

Change the main Creator AI settings here.`,
account:(name:string,id:string,credits:number,plan:string,date:string)=>`👤 CREATOR AI / ACCOUNT

Your Creator AI information.

👤 ${name}
ID: ${id}

🔹 ${credits} credits
💎 ${plan}
📅 Subscription until: ${date}`,
language:`🌐 CREATOR AI / LANGUAGE

Choose the language for the Creator AI interface and conversations.`,
notifications:(enabled:boolean)=>`🔔 CREATOR AI / NOTIFICATIONS

Stay up to date with new Creator AI features.

📢 News and updates
Receive messages about new features, important changes and events.

${enabled?"🔔 Notifications enabled":"🔕 Notifications disabled"}`,
help:`💬 Help

Have a question or need help?

Our support team can help with Creator AI and answer your questions.`,
terms:`⚖️ Terms of Use

Current Creator AI Terms of Use.`,
privacy:`🛡️ Privacy

Current Creator AI Privacy Policy.`,
locked:`⏳ Generation is still running…

Creator AI is creating your content.

Wait for the current operation to finish and try again.`,
aiError:`😔 Something went wrong

We could not create the content.

No credits were charged.

Try the generation again.`,
deliveryError:`⚠️ Could not deliver the result

The content was created successfully, but Telegram could not deliver it.

We saved the result and will retry delivery.`,
unsupported:`⚠️ This format is not supported yet

Send text, PDF, DOC or TXT.`,
sourceInvalid:`⚠️ The material could not be processed

Check the format and size or send another material.`,
saved:`⭐ Saved to history.`,
alreadySaved:`⭐ This result is already saved to history.`,
deleted:`🗑 Removed from history.`,
insufficient:(required:number,available:number)=>`⚠️ Not enough credits

This generation needs ${required} 🔹, but you have ${available} 🔹.

Add credits or change your plan to continue.`,
tariffs:(p:any,d:any)=>`💎 CREATOR AI / PLANS

Choose the level that fits your content pace.

✨ FREE
10 credits per month
For trying Creator AI.
🕘 History — ${d.free}

⚡ CREATOR
${p.creatorStars} ⭐ / month
${p.creatorCredits} credits
For regular content creation.
🕘 History — ${d.creator}

🚀 PRO
${p.proStars} ⭐ / month
${p.proCredits} credits
For daily creators.
🕘 History — ${d.pro}

More content. Fewer limits.`,
credits:(balance:number,p:number[])=>`💎 CREATOR AI / CREDITS

Your current balance:

🔹 ${balance} credits

Do not want to change plans?
Just add credits and keep creating.

✨ Choose a credit pack:

🔹 50 credits — ${p[0]} ⭐
🔹 100 credits — ${p[1]} ⭐
🔹 250 credits — ${p[2]} ⭐
🔹 500 credits — ${p[3]} ⭐

⚡ Credits can be used for all available generations.

Buy only what you need.`,
postConfig:(price:number,d:any)=>`✦ Creator AI / Post Maker

Your idea is ready.
Now tune how it should look.

💳 Generation cost: ${price} 🔹

📱 Platform: ${d.platform}
🎨 Style: ${d.style}
📏 Size: ${d.length}`,
scriptConfig:(price:number,d:any)=>`🎬 Creator AI / Script Maker

Choose what your video will be like.

💳 Generation cost: ${price} 🔹

📱 Format: ${d.platform}
🎨 Style: ${d.style}
⏱️ Duration: ${d.duration} sec`,
planConfig:(price:number,d:any)=>`📅 Creator AI / Content Plan

Tune your content plan parameters.

💳 Generation cost: ${price} 🔹

🎯 Goal: ${d.goal}
📱 Platform: ${d.platform}
🎨 Style: ${d.style}`,
processingSteps:(type:string)=>type==="post"?["🧠 Analyzing the material…","🔎 Finding the key points…","✍️ Adapting the content…","✨ Final touches…"]:type==="script"?["🧠 Analyzing the idea…","🔥 Building the Hook…","✍️ Writing the script…","✨ Final touches…"]:["🧠 Analyzing the topic…","🎯 Defining content goals…","💡 Creating ideas for the week…","✨ Forming the content plan…"]
};

export const copyFor=(lang:Lang)=>lang==="en"?enBase:ruBase;
export const ru=copyFor("ru");
export const enCopy=copyFor("en");
