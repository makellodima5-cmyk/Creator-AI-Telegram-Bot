import type { Bindings } from '../env';
import { ensureUser, addTransaction } from '../billing/credits';
import { getPrice, getPackage, getPlan, getHistoryDuration } from '../config';
import { createTextSource, createDocumentSource } from '../files/source';
import { createJob } from '../jobs/create';
import { daysForPlan, storeContentPlan } from '../jobs/plan-store';
import { plainResult, resultMarkup } from '../jobs/runner';
import { answerCallback, answerPreCheckoutQuery, deleteMessage, editMessageText, sendInvoice, sendMessage } from './api';
import {
  mainMenu, persistentMenu, postConfig, scriptConfig, planConfig, repurposeTargets,
  postResult, historyItem, styleExamples, insufficientKeyboard, errorKeyboard,
  settingsKeyboard, languageKeyboard, notificationKeyboard, creditsKeyboard, optionKeyboard
} from './keyboards';
import { ru } from '../text';
import { ensureAdminSeed, isAdmin, adminAction, applyAdminValue, openAdmin } from '../admin';

type Any = Record<string, any>;
const parse = (v: any): Any => { try { return v ? JSON.parse(String(v)) : {}; } catch { return {}; } };
const userById = (env: Bindings, id: number) => env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first<Any>();
const sessionByUser = (env: Bindings, id: number) => env.DB.prepare('SELECT * FROM user_sessions WHERE user_id=?').bind(id).first<Any>();

export async function handleWebhook(env: Bindings, update: unknown) {
  const u = update as Any;
  await ensureAdminSeed(env);
  const updateId = Number(u.update_id || 0);
  if (updateId) {
    const r = await env.DB.prepare('INSERT OR IGNORE INTO update_receipts(update_id,created_at) VALUES(?,?)').bind(updateId, Date.now()).run();
    if (r.meta.changes !== 1) return;
  }
  if (u.pre_checkout_query) return handlePreCheckout(env, u.pre_checkout_query);

  const message = u.message;
  const cb = u.callback_query;
  const from = message?.from || cb?.from;
  if (!from) return;
  const chatId = String(message?.chat?.id || cb?.message?.chat?.id || '');
  const user = await ensureUser(env, String(from.id), from.first_name, from.username);
  if (message?.successful_payment) {
    await completePayment(env, user.id, message.successful_payment);
    return openMain(env, user.id, chatId);
  }

  if (await hasGenerationLock(env, user.id) && !allowedDuringLock(String(cb?.data || ''))) {
    if (message?.text || message?.document || cb) await sendMessage(env, chatId, ru.locked);
    return;
  }

  if (message?.text === '/start') return openMain(env, user.id, chatId);
  if (message?.text === '/paysupport') return sendMessage(env, chatId, ru.help);
  if (message?.text === '/admin' && await isAdmin(env, String(from.id))) return openAdmin(env, chatId);

  if (message?.document) {
    const s = await sessionByUser(env, user.id);
    if (s?.flow === 'repurpose' && s.step === 'source') return handleDocument(env, user.id, chatId, message, s, updateId);
  }

  if (message?.text) {
    const handled = await handleText(env, user.id, chatId, String(message.text), Number(message.message_id), updateId);
    if (handled) return;
    const menus: Record<string, string> = {
      '📝 Пост':'menu:post', '🎬 Сценарий':'menu:script', '♻️ Переработка':'menu:repurpose',
      '📅 Контент-план':'menu:plan', '👤 Мой стиль':'menu:style', '🕘 История':'menu:history',
      '💎 Тарифы':'menu:pricing', '⭐ Credits':'menu:credits', '⚙️ Настройки':'menu:settings'
    };
    if (menus[String(message.text).trim()]) {
      await openAction(env, user.id, chatId, menus[String(message.text).trim()], null, updateId);
      await deleteMessage(env, chatId, Number(message.message_id)).catch(() => {});
      return;
    }
  }
  if (cb) {
    await answerCallback(env, String(cb.id)).catch(() => {});
    return openAction(env, user.id, chatId, String(cb.data || ''), cb.message, updateId);
  }
}

function allowedDuringLock(data: string) {
  return data === 'menu:pricing' || data === 'menu:credits' || data === 'settings:profile' ||
    data === 'settings:terms' || data.startsWith('buy:') || data.startsWith('terms:accept:');
}
async function hasGenerationLock(env: Bindings, userId: number) {
  const x = await env.DB.prepare('SELECT generation_lock_job_id FROM users WHERE id=?').bind(userId).first<Any>();
  return !!x?.generation_lock_job_id;
}
async function saveSession(env: Bindings, userId: number, flow: string, step: string, draft: Any, msgId?: number, chatId?: string, ttl = 7200000, activeJobId: number | null = null) {
  const n = Date.now();
  await env.DB.prepare('INSERT INTO user_sessions(user_id,flow,step,working_message_id,working_chat_id,active_job_id,draft_json,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET flow=excluded.flow,step=excluded.step,working_message_id=COALESCE(excluded.working_message_id,user_sessions.working_message_id),working_chat_id=COALESCE(excluded.working_chat_id,user_sessions.working_chat_id),active_job_id=excluded.active_job_id,draft_json=excluded.draft_json,expires_at=excluded.expires_at,updated_at=excluded.updated_at')
    .bind(userId, flow, step, msgId || null, chatId || null, activeJobId, JSON.stringify(draft || {}), n + ttl, n).run();
}

async function handleText(env: Bindings, userId: number, chatId: string, value: string, messageId: number, updateId: number) {
  const s = await sessionByUser(env, userId);
  if (!s) return false;
  const text = value.trim();
  if (!text) return true;
  if (s.flow === 'admin') return applyAdminValue(env, userId, chatId, text);
  const d = parse(s.draft_json);

  if (s.flow === 'style') {
    const examples = Array.isArray(d.examples) ? d.examples : [];
    if (examples.length >= 20) return true;
    examples.push(text.slice(0, 4000));
    await saveSession(env, userId, 'style', 'examples', { examples }, Number(s.working_message_id || 0), chatId, 14400000, null);
    await deleteMessage(env, chatId, messageId).catch(() => {});
    return editMessageText(env, chatId, Number(s.working_message_id), ru.styleReady(examples.length), styleExamples(examples.length >= 5));
  }

  if (s.flow === 'repurpose' && s.step === 'source') {
    if (text.length > 4000) { await sendMessage(env, chatId, ru.sourceInvalid); return true; }
    try {
      const sourceId = await createTextSource(env, userId, text);
      const wm = Number(s.working_message_id || 0);
      await deleteMessage(env, chatId, messageId).catch(() => {});
      await editMessageText(env, chatId, wm, '🧠 Анализирую материал…').catch(() => {});
      await saveSession(env, userId, 'repurpose', 'analysis', { sourceId, selectedOutputs: [] }, wm, chatId, 7200000, null);
      await createJob(env, { userId, chatId, type:'source_analysis', input:{ sourceId }, cost:0, workingMessageId:wm, sourceId, idempotencyKey:'source-analysis:'+updateId });
    } catch { await sendMessage(env, chatId, ru.sourceInvalid); }
    return true;
  }

  if (s.flow === 'edit' && s.step === 'instruction') {
    await deleteMessage(env, chatId, messageId).catch(() => {});
    const r = await resultRow(env, userId, Number(d.resultId));
    if (!r) return true;
    const textType = String(r.result_type);
    const cost = await editCost(env, textType);
    const m = await sendMessage(env, chatId, '⏳ Создаю новый вариант…');
    await createJob(env, {
      userId, chatId, type:'repurpose_result',
      input:{ resultType:textType.replace(/^repurpose_/,'') , editInstruction:text, previousResult:parse(r.content_json), sourceText:await sourceForResult(env,r), parameters:{ instruction:text } },
      cost, workingMessageId:m.message_id, sourceId:r.source_id || null, parentJobId:r.job_id,
      idempotencyKey:'edit:'+updateId
    });
    return true;
  }

  if (['post','script','plan'].includes(String(s.flow)) && s.step === 'topic') {
    d.topic = text.slice(0, 12000);
    await deleteMessage(env, chatId, messageId).catch(() => {});
    await saveSession(env, userId, s.flow, 'config', d, Number(s.working_message_id), chatId, 7200000, null);
    const p = await getPrice(env, s.flow === 'plan' ? 'content_plan' : s.flow);
    const body = s.flow === 'post' ? ru.postConfig(p,d) : s.flow === 'script' ? ru.scriptConfig(p,d) : ru.planConfig(p,d);
    const kb = s.flow === 'post' ? postConfig(d) : s.flow === 'script' ? scriptConfig(d) : planConfig(d);
    await editMessageText(env, chatId, Number(s.working_message_id), body, kb).catch(() => {});
    return true;
  }
  return false;
}

async function openAction(env: Bindings, userId: number, chatId: string, data: string, msg: Any, updateId: number) {
  const u = await userById(env,userId);
  if (data.startsWith('admin:')) return (await isAdmin(env,String(u?.telegram_id || ''))) ? adminAction(env,userId,chatId,data,msg) : undefined;
  if (data.startsWith('cfg:')) return configOptions(env,userId,chatId,data,msg);
  if (data.startsWith('cfgback:')) return renderConfig(env,userId,chatId,data.slice(7),msg);
  if (data.startsWith('sel:')) return selectParam(env,userId,chatId,data.slice(4),msg);
  if (data.startsWith('target:')) return selectTarget(env,userId,chatId,data.slice(7),msg);
  if (data === 'create') return createCurrent(env,userId,chatId,msg,updateId);
  if (data === 'back' || data === 'menu:back') return openMain(env,userId,chatId,msg);
  if (data === 'menu:post') return openFeature(env,userId,chatId,'post',msg);
  if (data === 'menu:script') return openFeature(env,userId,chatId,'script',msg);
  if (data === 'menu:repurpose') return openFeature(env,userId,chatId,'repurpose',msg);
  if (data === 'menu:plan') return openFeature(env,userId,chatId,'plan',msg);
  if (data === 'menu:style') return openStyle(env,userId,chatId,msg);
  if (data === 'menu:history') return showHistory(env,userId,chatId,msg,0);
  if (data === 'menu:pricing') return showPricing(env,userId,chatId,msg);
  if (data === 'menu:credits') return showCredits(env,userId,chatId,msg);
  if (data === 'menu:settings') return showSettings(env,userId,chatId,msg);
  if (data === 'settings:profile') return showAccount(env,userId,chatId,msg);
  if (data === 'settings:language') return editMessageText(env,chatId,Number(msg?.message_id),ru.language,languageKeyboard);
  if (data.startsWith('settings:language:')) { await env.DB.prepare('UPDATE users SET language=?,updated_at=? WHERE id=?').bind(data.split(':')[2],Date.now(),userId).run(); return showSettings(env,userId,chatId,msg); }
  if (data === 'settings:notifications') { const x=await userById(env,userId); return editMessageText(env,chatId,Number(msg?.message_id),ru.notifications(!!x?.notifications_enabled),notificationKeyboard(!!x?.notifications_enabled)); }
  if (data === 'settings:toggle') { const x=await userById(env,userId); await env.DB.prepare('UPDATE users SET notifications_enabled=?,updated_at=? WHERE id=?').bind(x?.notifications_enabled?0:1,Date.now(),userId).run(); return showSettings(env,userId,chatId,msg); }
  if (data === 'settings:support') return sendMessage(env,chatId,ru.help);
  if (data === 'settings:terms') return sendMessage(env,chatId,'⚖️ Условия использования\\n\\nУсловия сервиса доступны по опубликованной ссылке.'+(env.TERMS_URL?'\\n\\n'+env.TERMS_URL:''));
  if (data === 'settings:privacy') return sendMessage(env,chatId,'🛡️ Конфиденциальность\\n\\nПолитика конфиденциальности доступна по опубликованной ссылке.'+(env.PRIVACY_URL?'\\n\\n'+env.PRIVACY_URL:''));
  if (data === 'style:analyze') return startStyle(env,userId,chatId,msg,updateId);
  if (data.startsWith('copy:') || data.startsWith('hcopy:')) return copyResult(env,userId,chatId,Number(data.split(':')[1]));
  if (data.startsWith('save:')) return saveResult(env,userId,chatId,Number(data.split(':')[1]));
  if (data.startsWith('edit:')) return editResult(env,userId,chatId,Number(data.split(':')[1]));
  if (data.startsWith('variant:')) return variantResult(env,userId,chatId,Number(data.split(':')[1]),updateId);
  if (data.startsWith('retry:')) return retryJob(env,userId,chatId,Number(data.split(':')[1]),updateId);
  if (data.startsWith('rep-retry:')) return retryRepurpose(env,userId,chatId,Number(data.split(':')[1]),updateId);
  if (data.startsWith('hcontinue:')) return continueHistory(env,userId,chatId,Number(data.split(':')[1]));
  if (data.startsWith('hitem:')) return historyOpen(env,userId,chatId,Number(data.split(':')[1]));
  if (data.startsWith('hdelete:')) return deleteHistory(env,userId,chatId,Number(data.split(':')[1]));
  if (data.startsWith('hpage:')) return showHistory(env,userId,chatId,msg,Number(data.split(':')[1]));
  if (data.startsWith('day:')) return createPlanDay(env,userId,chatId,Number(data.split(':')[1]),Number(data.split(':')[2]),updateId);
  if (data.startsWith('buy:')) return purchase(env,userId,chatId,data.slice(4),msg);
  if (data.startsWith('terms:accept:')) { const key=data.slice(13); await env.DB.prepare('UPDATE users SET terms_accepted_at=?,updated_at=? WHERE id=?').bind(Date.now(),Date.now(),userId).run(); return issueInvoice(env,userId,chatId,key); }
  if (data.startsWith('deliver-retry:')) return retryDelivery(env,Number(data.split(':')[1]),chatId);
}

async function openMain(env: Bindings,userId:number,chatId:string,msg?:Any){const u=await userById(env,userId),text=ru.start(String(u?.first_name||'Creator'));if(msg?.message_id){await editMessageText(env,chatId,msg.message_id,text,mainMenu).catch(()=>{});return saveSession(env,userId,'ui','menu',{},msg.message_id,chatId,86400000,null)}const m=await sendMessage(env,chatId,text,mainMenu);await saveSession(env,userId,'ui','menu',{},m.message_id,chatId,86400000,null);await sendMessage(env,chatId,'\\u2063',persistentMenu)}
async function openFeature(env:Bindings,userId:number,chatId:string,flow:string,msg?:Any){const d=flow==='post'?{topic:'',platform:'telegram',style:'conversational',length:'short'}:flow==='script'?{topic:'',platform:'tiktok',style:'dynamic',duration:'30'}:flow==='plan'?{topic:'',goal:'growth',platform:'telegram',style:'expert'}:{sourceId:null,selectedOutputs:[]};const body=flow==='post'?ru.postEntry:flow==='script'?ru.scriptEntry:flow==='plan'?ru.planEntry:ru.repEntry;const kb={inline_keyboard:[[{text:'← Назад',callback_data:'back'}]]};if(msg?.message_id){await editMessageText(env,chatId,msg.message_id,body,kb);await saveSession(env,userId,flow,flow==='repurpose'?'source':'topic',d,msg.message_id,chatId,7200000,null)}else{const m=await sendMessage(env,chatId,body,kb);await saveSession(env,userId,flow,flow==='repurpose'?'source':'topic',d,m.message_id,chatId,7200000,null)}}
async function openStyle(env:Bindings,userId:number,chatId:string,msg?:Any){const d={examples:[]};if(msg?.message_id){await editMessageText(env,chatId,msg.message_id,ru.styleEntry,styleExamples(false));return saveSession(env,userId,'style','examples',d,msg.message_id,chatId,14400000,null)}const m=await sendMessage(env,chatId,ru.styleEntry,styleExamples(false));await saveSession(env,userId,'style','examples',d,m.message_id,chatId,14400000,null)}
async function configOptions(env:Bindings,userId:number,chatId:string,data:string,msg:Any){const s=await sessionByUser(env,userId);const d=parse(s?.draft_json);if(!s)return;const opts:Record<string,{title:string,items:{text:string,data:string}[];back:string}>={
'cfg:post:platform':{title:'📱 Площадка',items:[['📱 Telegram','telegram'],['📸 Instagram','instagram'],['🎵 TikTok','tiktok'],['▶️ YouTube','youtube']].map(x=>({text:x[0],data:'sel:'+x[1]})),back:'cfgback:post'},
'cfg:post:style':{title:'🎨 Стиль',items:[['💼 Экспертный','expert'],['😎 Разговорный','conversational'],['📰 Новостной','news'],['💰 Продающий','sales']].map(x=>({text:x[0],data:'sel:'+x[1]})),back:'cfgback:post'},
'cfg:post:length':{title:'📏 Размер',items:[['⚡ Короткая','short'],['📝 Средняя','medium'],['📚 Длинная','long']].map(x=>({text:x[0],data:'sel:'+x[1]})),back:'cfgback:post'},
'cfg:script:platform':{title:'📱 Формат',items:[['🎵 TikTok','tiktok'],['📸 Reels','instagram'],['▶️ YouTube Shorts','youtube']].map(x=>({text:x[0],data:'sel:'+x[1]})),back:'cfgback:script'},
'cfg:script:style':{title:'🎨 Стиль',items:[['💼 Экспертная','expert'],['😎 Разговорная','conversational'],['⚡ Динамичная','dynamic'],['💰 Продающая','sales']].map(x=>({text:x[0],data:'sel:'+x[1]})),back:'cfgback:script'},
'cfg:script:duration':{title:'⏱️ Длительность',items:['15','30','45','60'].map(x=>({text:x+' сек',data:'sel:'+x})),back:'cfgback:script'},
'cfg:plan:goal':{title:'🎯 Цель',items:[['📈 Рост','growth'],['💰 Продажи','sales'],['❤️ Вовлечение','engagement'],['🧠 Экспертность','expertise']].map(x=>({text:x[0],data:'sel:'+x[1]})),back:'cfgback:plan'},
'cfg:plan:platform':{title:'📱 Площадка',items:[['📱 Telegram','telegram'],['📸 Instagram','instagram'],['🎵 TikTok','tiktok'],['▶️ YouTube','youtube']].map(x=>({text:x[0],data:'sel:'+x[1]})),back:'cfgback:plan'},
'cfg:plan:style':{title:'🎨 Стиль',items:[['💼 Экспертный','expert'],['😎 Разговорный','conversational'],['📰 Новостной','news'],['💰 Продающий','sales']].map(x=>({text:x[0],data:'sel:'+x[1]})),back:'cfgback:plan'}};const x=opts[data];if(!x)return;return editMessageText(env,chatId,msg.message_id,x.title,optionKeyboard(x.items,x.back))}
async function renderConfig(env:Bindings,userId:number,chatId:string,flow:string,msg:Any){const s=await sessionByUser(env,userId),d=parse(s?.draft_json);if(!s)return;const p=await getPrice(env,flow==='plan'?'content_plan':flow);return editMessageText(env,chatId,msg.message_id,flow==='post'?ru.postConfig(p,d):flow==='script'?ru.scriptConfig(p,d):ru.planConfig(p,d),flow==='post'?postConfig(d):flow==='script'?scriptConfig(d):planConfig(d))}
async function selectParam(env:Bindings,userId:number,chatId:string,key:string,msg:Any){const s=await sessionByUser(env,userId);if(!s)return;const d=parse(s.draft_json);if(s.flow==='post'){if(['telegram','instagram','tiktok','youtube'].includes(key))d.platform=key;else if(['expert','conversational','news','sales'].includes(key))d.style=key;else d.length=key;return renderSelected(env,userId,chatId,'post',d,msg)}if(s.flow==='script'){if(['tiktok','instagram','youtube'].includes(key))d.platform=key;else if(['expert','conversational','dynamic','sales'].includes(key))d.style=key;else d.duration=key;return renderSelected(env,userId,chatId,'script',d,msg)}if(s.flow==='plan'){if(['growth','sales','engagement','expertise'].includes(key))d.goal=key;else if(['telegram','instagram','tiktok','youtube'].includes(key))d.platform=key;else d.style=key;return renderSelected(env,userId,chatId,'plan',d,msg)}}
async function renderSelected(env:Bindings,userId:number,chatId:string,flow:string,d:Any,msg:Any){await saveSession(env,userId,flow,'config',d,msg.message_id,chatId);const p=await getPrice(env,flow==='plan'?'content_plan':flow);return editMessageText(env,chatId,msg.message_id,flow==='post'?ru.postConfig(p,d):flow==='script'?ru.scriptConfig(p,d):ru.planConfig(p,d),flow==='post'?postConfig(d):flow==='script'?scriptConfig(d):planConfig(d))}
async function selectTarget(env:Bindings,userId:number,chatId:string,key:string,msg:Any){const s=await sessionByUser(env,userId);if(!s)return;const d=parse(s.draft_json);const a=Array.isArray(d.selectedOutputs)?d.selectedOutputs:[];d.selectedOutputs=a.includes(key)?a.filter((x:string)=>x!==key):a.concat(key);d.credits=await repurposeTotal(env,d.selectedOutputs);await saveSession(env,userId,'repurpose','select',d,msg.message_id,chatId);return editMessageText(env,chatId,msg.message_id,ru.repSelect(d.credits),repurposeTargets(d.selectedOutputs,d.credits))}
async function createCurrent(env:Bindings,userId:number,chatId:string,msg:Any,updateId:number){const s=await sessionByUser(env,userId);if(!s)return;const d=parse(s.draft_json),flow=String(s.flow);let type=flow,cost=0,sourceId:null|number=null;if(flow==='plan'){type='content_plan';cost=await getPrice(env,'content_plan')}else if(flow==='post'||flow==='script')cost=await getPrice(env,flow);else{if(!d.selectedOutputs?.length)return sendMessage(env,chatId,'⚠️ Выбери хотя бы один результат.');cost=await repurposeTotal(env,d.selectedOutputs);sourceId=Number(d.sourceId)}return createJob(env,{userId,chatId,type,input:d,cost,workingMessageId:Number(s.working_message_id||msg?.message_id||0),sourceId,idempotencyKey:'create:'+updateId})}
async function startStyle(env:Bindings,userId:number,chatId:string,msg:Any,updateId:number){const s=await sessionByUser(env,userId);const d=parse(s?.draft_json);if((d.examples||[]).length<5)return;return createJob(env,{userId,chatId,type:'style_profile',input:d,cost:await getPrice(env,'style_profile'),workingMessageId:Number(s?.working_message_id||msg?.message_id||0),idempotencyKey:'style:'+updateId})}
async function editResult(env:Bindings,userId:number,chatId:string,id:number){const r=await resultRow(env,userId,id);if(!r)return;if(['post','script'].includes(r.result_type))return sendMessage(env,chatId,'✏️ Изменить\\n\\nОтправь одним сообщением, что нужно изменить.').then(m=>saveSession(env,userId,'edit','instruction',{resultId:id},m.message_id,chatId));const m=await sendMessage(env,chatId,'✏️ Изменить\\n\\nОтправь одним сообщением, что нужно изменить.');return saveSession(env,userId,'edit','instruction',{resultId:id},m.message_id,chatId)}
async function variantResult(env:Bindings,userId:number,chatId:string,id:number,updateId:number){const r=await resultRow(env,userId,id);if(!r)return;const type=String(r.result_type),base=type==='post'?'post_variant':type==='script'?'script_variant':'repurpose_'+type.replace(/^repurpose_/,'');const m=await sendMessage(env,chatId,'⏳ Создаю другой вариант…');return createJob(env,{userId,chatId,type:type.startsWith('repurpose_')?'repurpose_result':type,input:{resultType:type.replace(/^repurpose_/,'').replace(/^content_plan$/,'content_plan'),previousResult:parse(r.content_json),sourceText:await sourceForResult(env,r),parameters:parse(r.job_input)},cost:await getPrice(env,base),workingMessageId:m.message_id,sourceId:r.source_id||null,parentJobId:r.job_id,idempotencyKey:'variant:'+updateId})}
async function retryJob(env:Bindings,userId:number,chatId:string,id:number,updateId:number){const j=await env.DB.prepare('SELECT * FROM jobs WHERE id=? AND user_id=? AND status=\'failed\'').bind(id,userId).first<Any>();if(!j)return;const d=parse(j.input_json),cost=j.type==='post'?await getPrice(env,'post'):j.type==='script'?await getPrice(env,'script'):j.type==='content_plan'?await getPrice(env,'content_plan'):await getPrice(env,'repurpose_'+String(d.resultType||'telegram'));const m=await sendMessage(env,chatId,'⏳ Повторяю генерацию…');return createJob(env,{userId,chatId,type:j.type,input:d,cost,workingMessageId:m.message_id,sourceId:j.source_id||null,parentJobId:j.id,idempotencyKey:'retry:'+updateId})}
async function retryRepurpose(env:Bindings,userId:number,chatId:string,id:number,updateId:number){const j=await env.DB.prepare('SELECT * FROM jobs WHERE id=? AND user_id=?').bind(id,userId).first<Any>();if(!j)return;const rows=await env.DB.prepare('SELECT result_type FROM job_results WHERE job_id=? AND status=\'failed\' ORDER BY position').bind(id).all<Any>(),outs=(rows.results||[]).map((x:any)=>String(x.result_type));if(!outs.length)return;const d=parse(j.input_json);d.selectedOutputs=outs;const m=await sendMessage(env,chatId,'⏳ Повторяю неудачные результаты…');return createJob(env,{userId,chatId,type:'repurpose',input:d,cost:await repurposeTotal(env,outs),workingMessageId:m.message_id,sourceId:j.source_id||null,parentJobId:j.id,idempotencyKey:'rep-retry:'+updateId})}
async function resultRow(env:Bindings,userId:number,id:number){return env.DB.prepare('SELECT jr.*,j.input_json job_input,j.source_id,j.job_id FROM job_results jr JOIN jobs j ON j.id=jr.job_id WHERE jr.id=? AND jr.user_id=?').bind(id,userId).first<Any>()}
async function sourceForResult(env:Bindings,r:Any){if(r.source_id){const x=await env.DB.prepare('SELECT extracted_text FROM sources WHERE id=?').bind(r.source_id).first<Any>();return String(x?.extracted_text||'')}const d=parse(r.job_input);return String(d.topic||d.sourceText||'')}
async function editCost(env:Bindings,t:string){if(t==='post')return getPrice(env,'post_edit');if(t==='script')return getPrice(env,'script_edit');if(t==='content_plan')return getPrice(env,'content_plan_variant');return getPrice(env,'repurpose_'+t.replace(/^repurpose_/,''))
}
async function saveResult(env:Bindings,userId:number,chatId:string,id:number){const r=await resultRow(env,userId,id);if(!r)return;if(await env.DB.prepare('SELECT id FROM history WHERE result_id=? AND deleted_at IS NULL').bind(id).first<any>())return sendMessage(env,chatId,ru.alreadySaved);const u=await userById(env,userId),days=await getHistoryDuration(env,String(u?.plan||'free'));await env.DB.prepare('INSERT INTO history(user_id,result_id,result_type,title,expires_at,created_at) VALUES(?,?,?,?,?,?)').bind(userId,id,r.result_type,String(parse(r.content_json).title||r.result_type).slice(0,80),Date.now()+days*86400000,Date.now()).run();await sendMessage(env,chatId,ru.saved)}
async function copyResult(env:Bindings,userId:number,chatId:string,id:number){const r=await resultRow(env,userId,id);if(r)await sendMessage(env,chatId,plainResult(String(r.result_type),parse(r.content_json)).slice(0,4000))}
async function showHistory(env:Bindings,userId:number,chatId:string,msg:Any,offset:number){const rows=await env.DB.prepare('SELECT id,title,result_type FROM history WHERE user_id=? AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT 2 OFFSET ?').bind(userId,Date.now(),offset).all<Any>();const a=rows.results||[],kb:any[][]=a.map((x:any)=>[{text:'▶️ '+String(x.title).slice(0,45),callback_data:'hitem:'+x.id}]);const nav:any[]=[];if(offset>0)nav.push({text:'◀️',callback_data:'hpage:'+(offset-2)});if(a.length===2)nav.push({text:'▶️',callback_data:'hpage:'+(offset+2)});if(nav.length)kb.push(nav);kb.push([{text:'← Назад',callback_data:'menu:back'}]);return msg?.message_id?editMessageText(env,chatId,msg.message_id,a.length?ru.history:ru.noHistory,{inline_keyboard:kb}):sendMessage(env,chatId,a.length?ru.history:ru.noHistory,{inline_keyboard:kb})}
async function historyOpen(env:Bindings,userId:number,chatId:string,id:number){const h=await env.DB.prepare('SELECT result_id FROM history WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(id,userId).first<Any>();if(!h)return;const r=await resultRow(env,userId,Number(h.result_id));if(r)await sendMessage(env,chatId,resultMarkup(r.result_type,parse(r.content_json)),postResult(Number(r.id)))}
async function continueHistory(env:Bindings,userId:number,chatId:string,id:number){return historyOpen(env,userId,chatId,id)}
async function deleteHistory(env:Bindings,userId:number,chatId:string,id:number){await env.DB.prepare('UPDATE history SET deleted_at=? WHERE id=? AND user_id=?').bind(Date.now(),id,userId).run();await sendMessage(env,chatId,ru.deleted)}
async function showPricing(env:Bindings,userId:number,chatId:string,msg:Any){const a=await getPlan(env,'creator'),b=await getPlan(env,'pro'),df=await getHistoryDuration(env,'free'),dc=await getHistoryDuration(env,'creator'),dp=await getHistoryDuration(env,'pro'),t=ru.tariffs({free:df+' дней',creator:dc+' дней',pro:dp+' дней'},{creatorStars:Number(a?.stars_price||99),creatorCredits:Number(a?.included_credits||100),proStars:Number(b?.stars_price||299),proCredits:Number(b?.included_credits||500)}),kb={inline_keyboard:[[{text:'⚡ Взять CREATOR — '+Number(a?.stars_price||99)+' ⭐',callback_data:'buy:creator'}],[{text:'🚀 Взять PRO — '+Number(b?.stars_price||299)+' ⭐',callback_data:'buy:pro'}],[{text:'⭐ Купить Credits',callback_data:'menu:credits'}]]};return msg?.message_id?editMessageText(env,chatId,msg.message_id,t,kb):sendMessage(env,chatId,t,kb)}
async function showCredits(env:Bindings,userId:number,chatId:string,msg:Any){const u=await userById(env,userId),a=await Promise.all([50,100,250,500].map(x=>getPackage(env,x))),t=ru.credits(Number(u?.credits_balance||0),a.map(x=>x.stars)),kb=creditsKeyboard([50,100,250,500]);return msg?.message_id?editMessageText(env,chatId,msg.message_id,t,kb):sendMessage(env,chatId,t,kb)}
async function showSettings(env:Bindings,userId:number,chatId:string,msg:Any){return msg?.message_id?editMessageText(env,chatId,msg.message_id,ru.settings,settingsKeyboard):sendMessage(env,chatId,ru.settings,settingsKeyboard)}
async function showAccount(env:Bindings,userId:number,chatId:string,msg:Any){const u=await userById(env,userId),s=await env.DB.prepare('SELECT expires_at FROM subscriptions WHERE user_id=? AND status=\'active\' ORDER BY expires_at DESC LIMIT 1').bind(userId).first<Any>(),date=s?.expires_at?new Date(Number(s.expires_at)).toLocaleDateString('ru-RU'):'—',t=ru.account(String(u?.first_name||'Creator'),String(u?.telegram_id||''),Number(u?.credits_balance||0),String(u?.plan||'free').toUpperCase(),date);return msg?.message_id?editMessageText(env,chatId,msg.message_id,t,settingsKeyboard):sendMessage(env,chatId,t,settingsKeyboard)}
async function purchase(env:Bindings,userId:number,chatId:string,key:string,msg:Any){const u=await userById(env,userId);if(!u)return;if(!u.terms_accepted_at)return sendMessage(env,chatId,'⚖️ Перед оплатой\\n\\nПодтверди, что ты принимаешь Условия использования Creator AI.',{inline_keyboard:[[{text:'✅ Принимаю условия',callback_data:'terms:accept:'+key}],[{text:'⚖️ Открыть условия',callback_data:'settings:terms'}]]});return issueInvoice(env,userId,chatId,key)}
async function issueInvoice(env:Bindings,userId:number,chatId:string,key:string){let stars=0,title=key,credits=0;if(key==='creator'||key==='pro'){const p=await getPlan(env,key);stars=Number(p?.stars_price||0);credits=Number(p?.included_credits||0)}else if(key.startsWith('credits:')){credits=Number(key.slice(8));const p=await getPackage(env,credits);stars=p.stars}if(!stars)return;const payload='creatorai:'+userId+':'+key+':'+crypto.randomUUID();await env.DB.prepare('INSERT INTO payments(user_id,provider,kind,invoice_payload,currency,stars_amount,status,product_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(userId,'telegram_stars',key.startsWith('credits:')?'credits':'subscription',payload,'XTR',stars,'pending',key,Date.now()).run();return sendInvoice(env,chatId,title,'Creator AI — '+(credits?credits+' credits':'subscription'),payload,stars)}
async function handlePreCheckout(env:Bindings,q:Any){const p=await env.DB.prepare('SELECT * FROM payments WHERE invoice_payload=? AND status=\'pending\'').bind(String(q.invoice_payload)).first<Any>(),u=await env.DB.prepare('SELECT id FROM users WHERE telegram_id=?').bind(String(q.from?.id||'')).first<Any>(),ok=!!p&&!!u&&Number(p.user_id)===Number(u.id)&&q.currency==='XTR'&&Number(q.total_amount)===Number(p.stars_amount);return answerPreCheckoutQuery(env,String(q.id),ok,ok?undefined:'Платёж недоступен или данные заказа не совпадают.')}
async function completePayment(env:Bindings,userId:number,p:Any){const row=await env.DB.prepare('SELECT * FROM payments WHERE invoice_payload=?').bind(String(p.invoice_payload)).first<Any>();if(!row||Number(row.user_id)!==userId)return;const ok=await env.DB.prepare('UPDATE payments SET status=\'paid\',telegram_payment_charge_id=? WHERE id=? AND status=\'pending\' AND currency=\'XTR\' AND stars_amount=?').bind(p.telegram_payment_charge_id,row.id,p.total_amount).run();if(ok.meta.changes!==1)return;const u=await userById(env,userId);const key=String(row.product_key||'');if(key.startsWith('credits:')){const x=await getPackage(env,Number(key.slice(8))),bal=Number(u?.credits_balance||0)+x.credits;await env.DB.prepare('UPDATE users SET credits_balance=?,updated_at=? WHERE id=?').bind(bal,Date.now(),userId).run();return addTransaction(env,userId,'purchase',x.credits,bal,null,row.id,null,'payment:'+row.id)}const plan=await getPlan(env,key);if(!plan)return;const exp=Date.now()+Number(plan.duration_days||30)*86400000,bal=Number(u?.credits_balance||0)+Number(plan.included_credits||0);await env.DB.prepare('UPDATE users SET plan=?,tariff_id=?,credits_balance=?,credits_reset_at=?,updated_at=? WHERE id=?').bind(key,Number(plan.id),bal,exp,Date.now(),userId).run();await addTransaction(env,userId,'purchase',Number(plan.included_credits||0),bal,null,row.id,null,'subscription:'+row.id);await env.DB.prepare('INSERT INTO subscriptions(user_id,plan,provider,stars_amount,status,current_period_start,expires_at,telegram_payment_charge_id,invoice_payload,is_recurring,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(userId,key,'telegram_stars',row.stars_amount,'active',Date.now(),exp,p.telegram_payment_charge_id,row.invoice_payload,0,Date.now(),Date.now()).run()}
async function handleDocument(env:Bindings,userId:number,chatId:string,message:Any,s:Any,updateId:number){try{const x=await createDocumentSource(env,userId,message.document),wm=Number(s.working_message_id||0);await deleteMessage(env,chatId,message.message_id).catch(()=>{});await editMessageText(env,chatId,wm,'🧠 Анализирую материал…').catch(()=>{});await saveSession(env,userId,'repurpose','analysis',{sourceId:x.sourceId,selectedOutputs:[]},wm,chatId,7200000,null);await createJob(env,{userId,chatId,type:'source_analysis',input:{sourceId:x.sourceId},cost:0,workingMessageId:wm,sourceId:x.sourceId,idempotencyKey:'source-analysis:'+updateId})}catch{await sendMessage(env,chatId,ru.unsupported)}}
async function repurposeTotal(env:Bindings,outs:string[]){let n=0;for(const x of outs)n+=await getPrice(env,'repurpose_'+x);return n}
async function createPlanDay(env:Bindings,userId:number,chatId:string,jobId:number,pos:number,updateId:number){const j=await env.DB.prepare('SELECT * FROM jobs WHERE id=? AND user_id=? AND type=\'content_plan\'').bind(jobId,userId).first<Any>();if(!j)return;const plan=await env.DB.prepare('SELECT * FROM content_plans WHERE job_id=?').bind(jobId).first<Any>(),days=plan?await daysForPlan(env,plan.id):[];if(!plan||!days[pos])return;const d=days[pos];if(d.status==='⏳')return;await env.DB.prepare('UPDATE content_plan_days SET status=\'⏳\',updated_at=? WHERE id=? AND status!=\'⏳\'').bind(Date.now(),d.id).run();const base=parse(j.input_json),short=String(d.format).toLowerCase().includes('short'),input=short?{topic:d.title,platform:base.platform||'tiktok',style:'dynamic',duration:'30',contentPlanDayId:d.id}:{topic:d.title,platform:base.platform||'telegram',style:base.style||'expert',length:'medium',contentPlanDayId:d.id},m=await sendMessage(env,chatId,'⏳ Создаю '+d.day+'…');return createJob(env,{userId,chatId,type:short?'script':'post',input,cost:await getPrice(env,short?'script':'post'),workingMessageId:m.message_id,parentJobId:jobId,sourceId:j.source_id||null,idempotencyKey:'plan-day:'+updateId})}
async function retryDelivery(env:Bindings,resultId:number,chatId:string){const d=await env.DB.prepare('SELECT id FROM deliveries WHERE result_id=?').bind(resultId).first<Any>();if(!d)return;await env.DB.prepare('UPDATE deliveries SET status=\'queued\',next_retry_at=NULL WHERE id=?').bind(d.id).run();await env.DELIVERY_QUEUE.send({deliveryId:Number(d.id)});return sendMessage(env,chatId,'✅ Повторная доставка поставлена в очередь.')}
async function repurposeRetryDummy(){return}
