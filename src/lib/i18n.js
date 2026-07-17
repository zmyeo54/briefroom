/** App UI locale (separate from interview Q&A language). */

export const UI_LANGS = [
  { id: "en", label: "EN", native: "English" },
  { id: "zh", label: "中文", native: "简体中文" },
];

export const DEFAULT_UI_LANG = "en";

/**
 * Voice: calm, confident interview coach.
 * Encourage practice. Clear next steps. No jargon.
 */
const en = {
  "nav.home": "Home",
  "nav.settings": "Settings",
  "nav.keyNeeded": "Key",
  "nav.uiLang": "App language",

  "brand.name": "Line Check",
  "brand.tagline": "Your interview coach",

  "install.kickerAndroid": "One-tap practice",
  "install.kickerIos": "Two-tap install",
  "install.title": "Keep practice on your phone",
  "install.titleAndroid": "Install {brand} for One-Tap Practice",
  "install.titleIos": "Add {brand} to Home Screen",
  "install.cta": "Add to Home Screen",
  "install.dismiss": "Not Now",
  "install.hintAndroid":
    "Open like an app — your resume stays ready, no hunting for the link.",
  "install.hintIos":
    "Two taps. Then your coach lives next to your other apps.",
  "install.badgeAndroid": "Android · One tap",
  "install.badgeIos": "iPhone · Safari",
  "install.step1Label": "Tap Share",
  "install.step1Hint": "Bottom of Safari",
  "install.step2Label": "Add to Home Screen",
  "install.step2Hint": "Then tap Add",

  "home.eyebrow": "Your interview coach",
  "home.tagline":
    "Turn your story into answers you can say out loud — then practice until they feel natural.",
  "home.prepLabel": "Warm-up",
  "home.prepTitle": "Set up this rehearsal",
  "home.prepHint": "Choose the language you’ll speak and how long each answer should run.",

  "home.interviewLang": "Practice language",
  "home.interviewLangHint":
    "Start in English, or switch to 中文 / Mix for the room you’ll walk into.",
  "home.answerLength": "Answer length",
  "home.answerLengthHint": "Match the pace of the round you’re preparing for.",
  "home.interviewerRole": "Interviewer role",
  "home.interviewerRoleHint": "Optional — invented questions will sound like this person is asking.",
  "home.focusThemes": "What to lean into",
  "home.focusThemesHint":
    "Pick the themes you want practiced — leadership, delivery, gaps, and more. Selected themes shape the invented questions and how answers are framed.",
  "home.focusSelected": "{n} selected",
  "home.focusSelectedLabel": "selected",
  "home.focusSelectedPrefix": "",
  "home.focusSelectedSuffix": "selected",
  "home.standardThemes": "Solid defaults",
  "home.suggested": "Strong for this round",
  "home.optionalExtras": "Optional extras",

  "home.resume": "Your resume",
  "home.resumeHint": "PDF, Word, photo, or paste — scans work too.",
  "home.jd": "The role",
  "home.jdHint": "Job link, upload, or paste the posting.",
  "home.resumePlaceholder": "Drop in your resume…",
  "home.jdPlaceholder": "Drop in the job description…",
  "home.nameFromResume": "We’ll call you: {name}",
  "home.nameFromSettings": "We’ll call you: {name}",

  "home.targetQs": "Questions you want to nail",
  "home.targetQsHint":
    "Add the questions that make you nervous. They sit under your three foundations — and never replace them.",
  "home.autoInvent": "Also draft likely questions from my resume and this role",
  "home.genPrompt": "Generation prompt",
  "home.systemInSettings": "System prompt is edited in",
  "home.editUserPrompt": "Edit user prompt before send",
  "home.userPrompt": "User prompt",
  "home.generate": "Build My Answers",
  "home.generating": "Coaching Your Answers…",
  "home.saveDraft": "Save Progress",
  "home.resetAll": "New Interview",
  "home.resetAllHint": "Clear role, questions, and answers. Your resume and Settings stay.",
  "home.resetAllConfirm":
    "Start a new interview?\nThis clears the role, target questions, and answers.\nYour resume and Settings stay.",
  "home.clearAnswers": "Start Fresh",

  "home.questions": "Your practice set",
  "home.questionsHint":
    "Foundations stay on top. Tap to open an answer, pick what you’ll rehearse, then say it out loud.",
  "home.items": "{n} ready",
  "home.itemsLabel": "ready",
  "home.speak": "Practice ({n})",
  "home.stop": "Stop",
  "home.saveAudio": "Export Audio ({n})",
  "home.saveAudioHint":
    "Download one MP3 with every selected Q&A merged in order — replay anywhere outside the app.",
  "home.exportingAudio": "Building your audio export…",
  "home.exportingAudioShort": "Exporting…",
  "home.flash.audioSaved":
    "Exported — one MP3 with {n} Q&A is in Downloads. Replay it anywhere outside the app.",
  "home.flash.audioFailed": "Couldn’t export the audio. {detail}",

  "home.flash.lang":
    "Language set to {lang}. Foundation questions updated — regenerate when you’re ready for full answers in this language.",
  "home.flash.themes": "Themes refreshed from your materials. You’ve got a sharper focus now.",
  "home.flash.draft": "Progress saved. Come back whenever you’re ready.",
  "home.flash.resetAll": "Ready for a new interview. Resume kept — drop in the next role.",
  "home.flash.cleared": "Answers cleared. Fresh page — same coach energy.",
  "home.flash.needKey": "Add your Gemini API key in Settings so we can build answers.",
  "home.flash.needDocs": "Add your resume and the role first — then we’ll coach from your real story.",
  "home.flash.generating": "Crafting answers you can actually say…",
  "home.flash.generated":
    "Ready: {n} in {lang}. Your three foundations{addons} are pinned on top — start practicing.",
  "home.flash.addons": " + {n} of yours",
  "home.flash.selectAnswer": "Pick at least one question that has an answer, then try again.",
  "home.flash.copied": "Copied — keep going.",

  "doc.ready": "{title} locked in",
  "doc.fromUpload": "From your upload",
  "doc.fromLink": "From the job link",
  "doc.fromPaste": "From your paste",
  "doc.changeFile": "Swap File",
  "doc.changeLink": "Swap Link",
  "doc.pasteInstead": "Paste Instead",
  "doc.drop": "Drop files here, or tap to upload",
  "doc.extracting": "Reading…",
  "doc.formats": "PDF, Word, images (multi OK), or text",
  "doc.orUrl": " · or use the URL above",
  "doc.hidePaste": "Hide Paste",
  "doc.showPaste": "Paste Text Instead",
  "doc.pasteHint": "Paste your text, then tap Apply.",
  "doc.applyPaste": "Apply",
  "doc.cancel": "Cancel",
  "doc.clear": "Clear",
  "doc.extract": "Pull Text",
  "doc.fetching": "Opening the link…",
  "doc.reading": "Reading your file…",
  "doc.multiFiles": "{n} files",
  "doc.readingN": "Reading {n}/{total}: {name}",
  "doc.urlPlaceholder": "https://… job posting URL",

  "qa.emptyTitle": "Your set is empty — let’s fill it",
  "qa.emptyHint":
    "Add your resume and the role, then tap Build my answers. Select questions and practice them out loud.",
  "qa.selectAll": "Select All",
  "qa.deselectAll": "Clear Selection",
  "qa.selected": "{n}/{total} selected",
  "qa.selectedSuffix": "selected",
  "qa.pickHint": " · choose what to practice",
  "qa.mustAsk": "Foundation",
  "qa.addon": "Yours",
  "qa.noAnswer": "No answer yet — generate again or tweak your materials.",
  "qa.speak": "Practice",
  "qa.saveAudio": "Export This One",
  "qa.copy": "Copy",
  "qa.copied": "Copied",

  "settings.eyebrow": "Your setup",
  "settings.title": "Settings",
  "settings.apiKey": "Gemini API key",
  "settings.apiKeyPlaceholder": "Paste your Gemini API key",
  "settings.pasteKey": "Paste key",
  "settings.clearKey": "Remove key",
  "settings.pasteEmpty": "Clipboard is empty — copy a key first.",
  "settings.pasteFailed": "Couldn’t paste — allow clipboard access, or type the key.",
  "settings.keyCleared": "Personal key removed. Using env/server key if available.",
  "settings.keyFromEnv": "Using the shared env key on this build.",
  "settings.keyFromServer": "Using the server key (Vercel GEMINI_API_KEY).",
  "settings.name": "Your name",
  "settings.namePlaceholder": "How you introduce yourself",
  "settings.nameHint":
    "Filled from your resume when we spot a name. Edit anytime — your edit wins.",
  "settings.keyLoaded": "Key ready ({preview}… · {n} chars). Paste a new one anytime to replace it.",
  "settings.noKey": "No key yet — paste a Gemini API key, or set GEMINI_API_KEY on Vercel.",
  "settings.interviewLang": "Practice language",
  "settings.interviewLangHint":
    "Questions and answers will be written in this language.",
  "settings.gender": "Your gender",
  "settings.genderHint":
    "Keeps pronouns right. Male defaults to a female interviewer voice (and the reverse). Change voices anytime below.",
  "settings.gender.male": "Male",
  "settings.gender.female": "Female",
  "settings.voiceQ": "Interviewer voice",
  "settings.voiceA": "Your voice",
  "settings.voiceHint":
    "Practice mode plays the interviewer first, then you — so it feels like a real room.",
  "settings.ttsOffline": "Practice voice isn’t ready yet. Hang on — we’re reconnecting.",
  "settings.ttsOnline": "Practice voice is ready.",
  "settings.rate": "Speaking pace {rate}",
  "settings.systemPrompt": "Coach instructions",
  "settings.unlock": "Unlock to Edit",
  "settings.lock": "Lock",
  "settings.restoreDefault": "Restore Default",
  "settings.promptRestored": "Coach instructions restored to default.",
  "settings.saveBack": "Save & Keep Practicing",
  "settings.testQa": "Hear a Sample Q + A",
  "settings.playing": "Playing…",
  "settings.cancel": "Back",
  "settings.saved": "Saved.",
  "settings.playingSample": "Playing sample question, then answer…",
  "settings.testDone": "Sounds good — you’re set.",
  "settings.keySaved": "Key saved on this device only.",

  "lang.en.eyebrow": "Default",
  "lang.en.label": "English",
  "lang.en.detail": "Practice in English",
  "lang.zh.eyebrow": "Mandarin",
  "lang.zh.label": "中文",
  "lang.zh.detail": "全程中文练习",
  "lang.both.eyebrow": "Bilingual",
  "lang.both.label": "Mix",
  "lang.both.detail": "English → 中文",

  "length.brief.eyebrow": "Warm-up",
  "length.brief.label": "Brief",
  "length.brief.short": "30 sec",
  "length.brief.hint": "One point, one proof — sharp and calm.",
  "length.standard.eyebrow": "Most rounds",
  "length.standard.label": "Standard",
  "length.standard.short": "75 sec",
  "length.standard.hint": "A clear story you can finish without rushing.",
  "length.deep.eyebrow": "Panel / VP",
  "length.deep.label": "Deep Dive",
  "length.deep.short": "2–3 min",
  "length.deep.hint": "More ownership — stakes, trade-offs, and the win.",

  "role.any.eyebrow": "Optional",
  "role.any.label": "Any",
  "role.any.hint": "No role bias — typical mixed interview questions.",
  "role.hr.eyebrow": "Recruiter",
  "role.hr.label": "HR",
  "role.hr.hint": "Screening, motivation, culture, logistics.",
  "role.manager.eyebrow": "Hiring Mgr",
  "role.manager.label": "Line Manager",
  "role.manager.hint": "Day-to-day ownership, delivery, team fit.",
  "role.exec.eyebrow": "Leadership",
  "role.exec.label": "Exec / VP",
  "role.exec.hint": "Strategy, judgment, scale, executive presence.",

  "focus.leadership.label": "Leadership",
  "focus.leadership.hint": "Decisions you owned",
  "focus.delivery.label": "Delivery",
  "focus.delivery.hint": "Deadlines, SLAs, scale",
  "focus.customer.label": "Customer",
  "focus.customer.hint": "Hard moments & recovery",
  "focus.rolefit.label": "Role Fit",
  "focus.rolefit.hint": "Why this job, why now",
  "focus.gaps.label": "Gaps",
  "focus.gaps.hint": "Tenure, title, pivots",
  "focus.stakeholder.label": "Stakeholders",
  "focus.stakeholder.hint": "Conflict & alignment",
  "focus.culture.label": "Culture",
  "focus.culture.hint": "Values under pressure",
  "focus.domain.label": "Domain",
  "focus.domain.hint": "Industry judgment",
};

const zh = {
  "nav.home": "首页",
  "nav.settings": "设置",
  "nav.keyNeeded": "密钥",
  "nav.uiLang": "界面语言",

  "brand.name": "对词间",
  "brand.tagline": "你的面试教练",

  "install.kickerAndroid": "一键开口练",
  "install.kickerIos": "两步安装",
  "install.title": "把练习留在手机上",
  "install.titleAndroid": "安装{brand}，一键开始练习",
  "install.titleIos": "把{brand}加到主屏幕",
  "install.cta": "添加到主屏幕",
  "install.dismiss": "暂时不用",
  "install.hintAndroid": "像 App 一样打开——简历还在，不用再找链接。",
  "install.hintIos": "两步就好。之后教练就在你的主屏幕上。",
  "install.badgeAndroid": "Android · 一键安装",
  "install.badgeIos": "iPhone · Safari",
  "install.step1Label": "点分享",
  "install.step1Hint": "Safari 底部",
  "install.step2Label": "添加到主屏幕",
  "install.step2Hint": "再点添加",

  "home.eyebrow": "你的面试教练",
  "home.tagline":
    "把真实经历练成能说出口的回答——反复开口，直到从容自然。",
  "home.prepLabel": "热身",
  "home.prepTitle": "先设好这场练习",
  "home.prepHint": "选好你要说的语言，以及每道回答大概多长。",

  "home.interviewLang": "练习语言",
  "home.interviewLangHint": "默认英文；若面试是中文或中英混合，在这里切换。",
  "home.answerLength": "回答时长",
  "home.answerLengthHint": "按你即将面对的那一轮来选。",
  "home.interviewerRole": "面试官角色",
  "home.interviewerRoleHint": "可选——自动出题会按这位面试官的口吻来问。",
  "home.focusThemes": "重点方向",
  "home.focusThemesHint":
    "勾选你想练的方向——领导力、交付、缺口等。已选主题会决定自动出题覆盖什么，以及回答怎么组织。",
  "home.focusSelected": "已选 {n} 项",
  "home.focusSelectedLabel": "项",
  "home.focusSelectedPrefix": "已选",
  "home.focusSelectedSuffix": "项",
  "home.standardThemes": "稳妥默认",
  "home.suggested": "这轮更吃香",
  "home.optionalExtras": "可选补充",

  "home.resume": "你的简历",
  "home.resumeHint": "PDF、Word、截图或粘贴均可，扫描件也能读。",
  "home.jd": "目标岗位",
  "home.jdHint": "职位链接、上传文件，或直接粘贴描述。",
  "home.resumePlaceholder": "放进你的简历…",
  "home.jdPlaceholder": "放进职位描述…",
  "home.nameFromResume": "练习时称呼你：{name}",
  "home.nameFromSettings": "练习时称呼你：{name}",

  "home.targetQs": "你最想练透的题",
  "home.targetQsHint":
    "把心里没底的问题写进来。它们排在三个基础题后面——不会挤掉它们。",
  "home.autoInvent": "再根据我的简历和岗位，补一些很可能被问到的题",
  "home.genPrompt": "生成提示词",
  "home.systemInSettings": "系统提示词请到",
  "home.editUserPrompt": "发送前编辑用户提示词",
  "home.userPrompt": "用户提示词",
  "home.generate": "生成我的回答",
  "home.generating": "正在打磨你的回答…",
  "home.saveDraft": "保存进度",
  "home.resetAll": "新一场面试",
  "home.resetAllHint": "清空岗位、题目和回答。简历与设置会保留。",
  "home.resetAllConfirm":
    "开始新一场面试？\n会清空岗位、目标题和回答。\n简历与设置会保留。",
  "home.clearAnswers": "清空重来",

  "home.questions": "你的练习清单",
  "home.questionsHint":
    "基础题固定在最上。点开看回答，勾选要练的，然后大声说出来。",
  "home.items": "{n} 题就绪",
  "home.itemsLabel": "就绪",
  "home.speak": "开口练（{n}）",
  "home.stop": "停止",
  "home.saveAudio": "导出音频（{n}）",
  "home.saveAudioHint": "下载一个合并 MP3：所选问答按顺序串成一条，可在应用外随时回放练习。",
  "home.exportingAudio": "正在生成导出音频…",
  "home.exportingAudioShort": "导出中…",
  "home.flash.audioSaved":
    "已导出——含 {n} 组问答的 MP3 在下载文件夹，可在应用外随时回放。",
  "home.flash.audioFailed": "音频导出失败。{detail}",

  "home.flash.lang":
    "已切到 {lang}。基础题标题已更新——准备好后重新生成，拿到完整口语回答。",
  "home.flash.themes": "已根据材料刷新方向，焦点更准了。",
  "home.flash.draft": "进度已保存，随时回来继续练。",
  "home.flash.resetAll": "可以开始新一场面试了。简历已保留——放入下一个岗位即可。",
  "home.flash.cleared": "回答已清空。新的一页，同样认真练。",
  "home.flash.needKey": "请先在设置里填入 Gemini API 密钥，我们才能帮你生成回答。",
  "home.flash.needDocs": "先放上简历和岗位——我们要基于你的真实经历来练。",
  "home.flash.generating": "正在写出你能说出口的回答…",
  "home.flash.generated":
    "就绪：{n} 题（{lang}）。三个基础题{addons}已置顶——可以开始开口了。",
  "home.flash.addons": " + 你的 {n} 题",
  "home.flash.selectAnswer": "请至少选一道已有回答的题，再试一次。",
  "home.flash.copied": "已复制——继续练。",

  "doc.ready": "{title} 已就绪",
  "doc.fromUpload": "来自你的上传",
  "doc.fromLink": "来自职位链接",
  "doc.fromPaste": "来自粘贴",
  "doc.changeFile": "换文件",
  "doc.changeLink": "换链接",
  "doc.pasteInstead": "改为粘贴",
  "doc.drop": "拖到这里，或点一下上传（可多图）",
  "doc.extracting": "读取中…",
  "doc.formats": "支持 PDF、Word、多张图片或文本",
  "doc.orUrl": " · 或用上方链接",
  "doc.hidePaste": "收起粘贴",
  "doc.showPaste": "改为粘贴文字",
  "doc.pasteHint": "粘贴后点「应用」。",
  "doc.applyPaste": "应用",
  "doc.cancel": "取消",
  "doc.clear": "清除",
  "doc.extract": "提取文字",
  "doc.fetching": "正在打开链接…",
  "doc.reading": "正在读你的文件…",
  "doc.multiFiles": "{n} 个文件",
  "doc.readingN": "正在读 {n}/{total}：{name}",
  "doc.urlPlaceholder": "https://… 职位链接",

  "qa.emptyTitle": "清单还空着——我们一起填满",
  "qa.emptyHint":
    "加上简历和岗位，再点「生成我的回答」。勾选题目，大声练出来。",
  "qa.selectAll": "全选",
  "qa.deselectAll": "取消全选",
  "qa.selected": "已选 {n}/{total}",
  "qa.selectedSuffix": "已选",
  "qa.pickHint": " · 选好要练的题",
  "qa.mustAsk": "基础",
  "qa.addon": "你的题",
  "qa.noAnswer": "这题还没有回答——再生成一次，或先完善材料。",
  "qa.speak": "开口练",
  "qa.saveAudio": "导出本条",
  "qa.copy": "复制",
  "qa.copied": "已复制",

  "settings.eyebrow": "你的设置",
  "settings.title": "设置",
  "settings.apiKey": "Gemini API 密钥",
  "settings.apiKeyPlaceholder": "粘贴你的 Gemini API 密钥",
  "settings.pasteKey": "粘贴密钥",
  "settings.clearKey": "移除密钥",
  "settings.pasteEmpty": "剪贴板是空的——先复制密钥。",
  "settings.pasteFailed": "无法粘贴——请允许剪贴板权限，或手动输入。",
  "settings.keyCleared": "已移除本机密钥。若有环境/服务器密钥会继续使用。",
  "settings.keyFromEnv": "正在使用本构建的环境密钥。",
  "settings.keyFromServer": "正在使用服务器密钥（Vercel GEMINI_API_KEY）。",
  "settings.name": "你的姓名",
  "settings.namePlaceholder": "自我介绍时怎么称呼自己",
  "settings.nameHint":
    "放进简历后会自动识别姓名。可随时改——你改的优先。",
  "settings.keyLoaded": "密钥已就绪（{preview}… · {n} 字符）。随时可粘贴新密钥覆盖。",
  "settings.noKey": "还没有密钥——粘贴 Gemini 密钥，或在 Vercel 设置 GEMINI_API_KEY。",
  "settings.interviewLang": "练习语言",
  "settings.interviewLangHint": "问题与回答都会按此语言生成。",
  "settings.gender": "你的性别",
  "settings.genderHint":
    "用于人称。男性默认女面试官音色（反之亦然）。仍可在下方随时改音色。",
  "settings.gender.male": "男",
  "settings.gender.female": "女",
  "settings.voiceQ": "面试官音色",
  "settings.voiceA": "你的音色",
  "settings.voiceHint": "练习时先听面试官提问，再听你的回答——更像真实面试。",
  "settings.ttsOffline": "练习语音还没就绪，稍等一下——我们正在重连。",
  "settings.ttsOnline": "练习语音已就绪。",
  "settings.rate": "语速 {rate}",
  "settings.systemPrompt": "教练说明",
  "settings.unlock": "解锁编辑",
  "settings.lock": "锁定",
  "settings.restoreDefault": "恢复默认",
  "settings.promptRestored": "教练说明已恢复为默认。",
  "settings.saveBack": "保存并继续练习",
  "settings.testQa": "试听问答音色",
  "settings.playing": "播放中…",
  "settings.cancel": "返回",
  "settings.saved": "已保存。",
  "settings.playingSample": "正在播放示例问题，再播放回答…",
  "settings.testDone": "听感不错——可以开始了。",
  "settings.keySaved": "密钥仅保存在本机。",

  "lang.en.eyebrow": "默认",
  "lang.en.label": "English",
  "lang.en.detail": "用英文练习",
  "lang.zh.eyebrow": "普通话",
  "lang.zh.label": "中文",
  "lang.zh.detail": "全程中文练习",
  "lang.both.eyebrow": "双语",
  "lang.both.label": "混合",
  "lang.both.detail": "英文 → 中文",

  "length.brief.eyebrow": "热身",
  "length.brief.label": "简短",
  "length.brief.short": "30 秒",
  "length.brief.hint": "一个观点、一个证据——干净有力。",
  "length.standard.eyebrow": "多数面试",
  "length.standard.label": "标准",
  "length.standard.short": "75 秒",
  "length.standard.hint": "故事清楚，说完不赶场。",
  "length.deep.eyebrow": "Panel / VP",
  "length.deep.label": "深聊",
  "length.deep.short": "2–3 分钟",
  "length.deep.hint": "更多主导权——利害、取舍、结果。",

  "role.any.eyebrow": "可选",
  "role.any.label": "不限",
  "role.any.hint": "不偏向某一角色——常见综合面试题。",
  "role.hr.eyebrow": "招聘",
  "role.hr.label": "HR",
  "role.hr.hint": "初筛：动机、文化、沟通与行程。",
  "role.manager.eyebrow": "用人经理",
  "role.manager.label": "直线经理",
  "role.manager.hint": "日常交付、团队协作与岗位判断。",
  "role.exec.eyebrow": "高层",
  "role.exec.label": "高管 / VP",
  "role.exec.hint": "战略判断、影响力与高管气场。",

  "focus.leadership.label": "领导力",
  "focus.leadership.hint": "你拍板的决策",
  "focus.delivery.label": "交付",
  "focus.delivery.hint": "期限、SLA、规模",
  "focus.customer.label": "客户",
  "focus.customer.hint": "难关与补救",
  "focus.rolefit.label": "岗位契合",
  "focus.rolefit.hint": "为何此岗、为何现在",
  "focus.gaps.label": "缺口",
  "focus.gaps.hint": "年限、职级、转型",
  "focus.stakeholder.label": "干系人",
  "focus.stakeholder.hint": "冲突与对齐",
  "focus.culture.label": "文化",
  "focus.culture.hint": "压力下的价值观",
  "focus.domain.label": "领域",
  "focus.domain.hint": "行业判断",
};

const TABLES = { en, zh };

/** One example set is picked per page load (no rotation loop). Keep lines short for mobile. */
export const TARGET_PLACEHOLDERS = {
  en: [
    "A time you turned an unhappy customer around\nHow you lead under pressure\n…",
    "A hard decision you owned end-to-end\nWhat your last manager says is your edge\n…",
    "A project that nearly missed — what changed?\nHow you prioritize when everything is urgent\n…",
    "A conflict with a stakeholder — how it ended\nWhy this role, and why now?\n…",
    "A time you influenced without authority\nA weakness you’re actively fixing\n…",
    "Onboarding into a messy process and still delivering\nCoaching someone who was struggling\n…",
    "Your proudest metric — how you moved it\nAmbiguous goals from leadership — your approach\n…",
    "Shipping on a tight deadline with incomplete specs\nQuestions you’d ask in week one\n…",
  ],
  zh: [
    "一次挽回不满客户的经历\n压力下你怎么带团队？\n…",
    "一次你拍板落地的艰难决策\n上一任老板会说你的优势是？\n…",
    "一个差点延期的项目——你改了什么？\n事事都急时，你怎么排优先级？\n…",
    "一次和干系人起冲突，最后怎么收场\n为什么是这个岗位，为什么是现在？\n…",
    "一次没有职权却做成事的经历\n你正在改的一个短板是什么？\n…",
    "流程很乱时，你怎么快速上手还交付？\n一次带教状态不好的同事\n…",
    "你最自豪的一项指标，怎么推上去的？\n领导目标很模糊时，你怎么推进？\n…",
    "信息不完整、deadline很紧时怎么交付\n入职第一周你会先问什么？\n…",
  ],
};

export function pickTargetPlaceholder(uiLang) {
  const list = targetPlaceholders(uiLang);
  return list[Math.floor(Math.random() * list.length)] || list[0];
}

export function targetPlaceholders(uiLang) {
  const lang = normalizeUiLang(uiLang);
  return TARGET_PLACEHOLDERS[lang] || TARGET_PLACEHOLDERS.en;
}

export function normalizeUiLang(id) {
  return id === "zh" ? "zh" : "en";
}

/** Phone/browser UI language → app uiLang. zh-* (incl. TW/HK) → 中文. */
export function deviceUiLang() {
  try {
    const tags = [
      ...(typeof navigator !== "undefined" && Array.isArray(navigator.languages)
        ? navigator.languages
        : []),
      typeof navigator !== "undefined" ? navigator.language : "",
    ];
    return tags.some((t) => /^zh\b/i.test(String(t || "")))
      ? "zh"
      : DEFAULT_UI_LANG;
  } catch {
    return DEFAULT_UI_LANG;
  }
}

export function translate(uiLang, key, vars = {}) {
  const lang = normalizeUiLang(uiLang);
  const table = TABLES[lang] || en;
  let text = table[key] ?? en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}
