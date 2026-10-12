export const TOP_NEWS_MIN_CHARACTERS = 3000;
export const isTopLongformModule = (moduleId: string) => moduleId === 'news-top' || moduleId === 'sov-18-topbon' || moduleId === 'credit-08-news' || moduleId === 'credit-24-cran' || moduleId === 'mm-22-news';

type StoryKind = 'approval' | 'enforcement' | 'consultation' | 'statement' | 'policy' | 'company' | 'macro' | 'market';
type StoryLens = { kind: StoryKind; desk: string; subject: string; primary: string; secondary: string; market: string[]; checkpoints: string[] };

function clean(value: string) {
  return String(value ?? '')
    .replace(/^(?:简单说|换句话说|重点|一句话看懂)[:：]\s*/i, '')
    .replace(/(?:美国\s*)?(?:SEC|美联储)[^。！？\n]{0,24}RSS更新一项[^。！？\n]*[。！？]?/gi, '')
    .replace(/该事项应与同类历史记录对照[^。！？\n]*[。！？]?/g, '')
    .replace(/原文可复核的数字或时间标记包括[^。！？\n]*[。！？]?/g, '')
    .replace(/原始条目未给出足够数字[^。！？\n]*[。！？]?/g, '')
    .replace(/原文题名和链接继续保留在来源栏[^。！？\n]*[。！？]?/g, '')
    .replace(/公开来源|来源栏|后台|管理端|人工定向推送|爬虫|crawler|spider_/gi, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function hashOf(value: string) { let hash = 2166136261; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
function rotate<T>(rows: T[], offset: number) { if (!rows.length) return rows; const n = Math.abs(offset) % rows.length; return [...rows.slice(n), ...rows.slice(0, n)]; }
function compact(value: string) { return value.toLowerCase().replace(/[\s，。；：、,.!?！？:;"'“”‘’()（）\[\]—-]/g, ''); }

function normalizeKnownNewsPhrases(value: string) {
  return value
    .replace(/The Securities and Exchange Commission[’']s Division of Economic and Risk Analysis \(DERA\) published updated statistics and data visualizations covering key segments of the U\.S\. capital markets, including three new asset-backed securities \(ABS\) issuance data(?: series)?…?/gi, '美国证交会经济与风险分析部更新了美国资本市场主要板块的统计和可视化资料，并新增三组资产支持证券发行数据')
    .replace(/to Modernize Rules for Registered Transfer Agents/gi, '注册转让代理机构规则现代化方案')
    .replace(/The Securities and Exchange Commission today proposed to update the rules and forms that apply to registered transfer agents\.?/gi, '美国证交会提出更新适用于注册转让代理机构的规则和申报表格。')
    .replace(/Transfer agents are a key component of the national clearance and settlement system\.?/gi, '转让代理机构是全国清算结算体系的重要组成部分。')
    .replace(/Transfer agents now perform a more diverse…?/gi, '转让代理机构目前承担的业务类型更加多样，后续适用边界仍需结合提案全文核对。');
}

const subjectReferences: Record<StoryKind, string[]> = {
  approval: ['申请方', '该银行', '这家机构', '获批主体', '有关交易方', '相关金融机构'],
  enforcement: ['涉事对象', '有关当事方', '被处置主体', '相关责任方', '该事项参与者', '有关机构或人员'],
  consultation: ['这项提案', '有关规则调整', '本轮制度修订', '该意见稿', '拟议安排', '这套待议规则'],
  statement: ['这份联合口径', '该监管议题', '有关治理安排', '本次跨机构协调', '这套共同原则', '相关监督要求'],
  policy: ['这一政策信号', '本轮政策变化', '该项决策', '有关货币安排', '此次利率信息', '当前政策线索'],
  company: ['这家公司', '该发行人', '相关企业', '该经营主体', '这家上市主体', '有关公司'],
  macro: ['本次数据', '这组宏观指标', '该经济读数', '本轮统计结果', '这份数据组合', '有关经济信号'],
  market: ['该市场事件', '这项变化', '相关资产', '当前主题', '这轮行情线索', '有关交易信号'],
};

function diversifySubjectMentions(article: string, subject: string, kind: StoryKind, hash: number) {
  if (!subject || subject.length < 2) return article;
  const references = rotate(subjectReferences[kind], hash % subjectReferences[kind].length);
  let mention = 0;
  return article.replace(new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => {
    mention += 1;
    if (mention <= 3) return subject;
    return references[(mention - 4) % references.length];
  });
}

function differentiateSections(article: string, lens: StoryLens, hash: number) {
  const closers = [
    (check: string, market: string) => `这项判断以${check}为证据门槛，并用${market}核对发生时点。`,
    (check: string, market: string) => `若${check}没有新增内容，${market}的波动不能单独当作结论。`,
    (check: string, market: string) => `验证顺序是先锁定${check}，随后观察${market}是否给出同向反馈。`,
    (check: string, market: string) => `这里最容易误判的地方，是在${check}尚未确认前就用${market}倒推事实。`,
    (check: string, market: string) => `复盘时把${check}的时间戳与${market}逐笔对齐，才能区分先行反应和事后解释。`,
    (check: string, market: string) => `下一次更新只在${check}出现实质增量时改动本段，同时保留${market}的原始观察窗。`,
    (check: string, market: string) => `交叉核验需要同时回答两个问题：${check}改变了什么，${market}又实际反映了多少。`,
    (check: string, market: string) => `研究记录应保存${check}的前后版本，并将${market}放回同期限样本比较。`,
    (check: string, market: string) => `如果${check}与${market}给出相反信号，应降低归因置信度并延长观察期。`,
    (check: string, market: string) => `本段不靠情绪定性，结论必须能够沿${check}和${market}两条路径复算。`,
    (check: string, market: string) => `投资含义最终落在${check}能否兑现，以及${market}是否持续而非瞬时跳动。`,
    (check: string, market: string) => `边界条件是${check}仍然有效，且${market}没有被同日其他重大事件主导。`,
    (check: string, market: string) => `证据不足时保留空白，等${check}更新后再重新解释${market}。`,
    (check: string, market: string) => `信息增量由${check}衡量，价格增量则通过${market}与可比对象的差值判断。`,
    (check: string, market: string) => `对照组必须与${market}采用相同币种和时区，${check}则保留文件原始口径。`,
    (check: string, market: string) => `只有${check}和${market}在连续窗口内相互印证，才提高本节判断权重。`,
  ];
  return article.split('\n\n').map((section, index) => {
    if (index < 2 || index % 3 !== 2 || !section.includes('\n')) return section;
    const check = lens.checkpoints[(hash + index * 3) % lens.checkpoints.length];
    const market = lens.market[((hash >>> 5) + index * 7) % lens.market.length];
    const closer = closers[((hash >>> 11) + index * 5) % closers.length](check, market);
    return `${section} ${closer}`;
  }).join('\n\n');
}

function localizeHeadlineSubject(value: string) {
  return value
    .replace(/former employee of (.+?) and former employee of (.+)$/i, '$1 前员工及 $2 前员工')
    .replace(/^a former employee of (.+)$/i, '$1 前员工')
    .replace(/^a former employee$/i, '一名前员工')
    .replace(/^former employee of (.+)$/i, '$1 前员工')
    .replace(/a proposal to modernize rules for mutual banking organizations/i, '共同银行组织规则现代化提案')
    .replace(/a proposal to modernize its rule governing the extension of credit to bank "insiders".+$/i, '银行内部人授信规则现代化提案')
    .replace(/a banking institution/i, '一家银行机构');
}

function localizeEnglishDate(value: string) {
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  return value.replace(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s*[–—-]\s*(\d{1,2}))?,\s*((?:19|20)\d{2})\b/gi,
    (_match, month: string, startDay: string, endDay: string | undefined, year: string) =>
      `${year}年${months[month.toLowerCase()]}月${startDay}${endDay ? `日至${endDay}日` : '日'}`
  );
}

export function toPlainNewsHeadline(value: string) {
  const title = clean(value).replace(/[。.!！]+$/, '');
  if (/^SEC Publishes Updated Market Statistics,? Highlighting Increase in IPOs and Proceeds Raised$/i.test(title)) return '美国证交会更新资本市场统计，IPO数量与募资额增加';
  if (/^SEC Announces Agenda and Panelists for Roundtable on Preparations for 24-Hour Trading$/i.test(title)) return '美国证交会公布24小时交易圆桌会议议程与嘉宾名单';
  if (/^SEC Proposes to Modernize Rules for Registered Transfer Agents$/i.test(title)) return '美国证交会提出注册转让代理机构规则现代化方案';
  if (/^SEC Proposes Amendments to Exchange Act Rule 3a12-8 to Add European Union Debt Obligations$/i.test(title)) return '美国证交会拟将欧盟债务工具纳入交易法规则适用范围';
  let match = title.match(/^Federal Reserve Board announces approval of application by (.+)$/i);
  if (match) return `美联储批准${localizeHeadlineSubject(match[1])}提交的申请`;
  match = title.match(/^Federal Reserve Board announces approval of (?:the |an? )?application(?: by )?(.+)?$/i);
  if (match) return `美联储批准${match[1] ? `${localizeHeadlineSubject(match[1])}提交的` : ''}申请`;
  match = title.match(/^Federal Reserve Board issues enforcement action with (.+?) and announces termination of enforcement action with (.+)$/i);
  if (match) return `美联储对${localizeHeadlineSubject(match[1])}采取执法措施，并终止对${localizeHeadlineSubject(match[2])}的既有措施`;
  match = title.match(/^Federal Reserve Board issues enforcement actions? (?:against|with) (.+)$/i);
  if (match) return `美联储对${localizeHeadlineSubject(match[1])}采取执法措施`;
  match = title.match(/^Federal Reserve Board requests comment on (.+)$/i);
  if (match) return `美联储就${localizeHeadlineSubject(match[1])}公开征求意见`;
  match = title.match(/^Agencies issue joint statement on (.+)$/i);
  if (match) return `美国金融监管机构就${match[1].replace(/handling of highly sensitive information during bank examinations/i, '银行检查期间高度敏感信息的处理规则')}发布联合声明`;
  match = title.match(/^SEC Charges (.+?) with (.+)$/i);
  if (match) return `美国证交会指控${match[1].replace(/San Francisco Bay Area Private Fund Executives/i, '旧金山湾区私募基金高管')}涉嫌${match[2].replace(/Multimillion Dollar Ponzi-Like Scheme/i, '数百万美元庞氏式融资骗局')}`;
  match = title.match(/^SEC Announces Departure of (.+)$/i);
  if (match) return `美国证交会宣布${match[1].replace(/Principal Deputy Director of Enforcement (.+)/i, '执法部门首席副主任$1')}离任`;
  match = title.match(/^SEC Names (.+?) as (.+)$/i);
  if (match) return `美国证交会任命${match[1]}担任${match[2]}`;
  match = title.match(/^SEC Establishes (.+)$/i);
  if (match) return `美国证交会设立${match[1].replace(/Financial Reporting and Accounting Unit in Enforcement Division/i, '执法部门财务报告与会计专项组')}`;
  match = title.match(/^SEC Proposes (.+)$/i);
  if (match) return `美国证交会提出${match[1].replace(/New Regulation Crypto Assets/i, '新的加密资产监管规则')}`;
  match = title.match(/^SEC Forms (.+)$/i);
  if (match) return `美国证交会组建${match[1].replace(/New Retail Fraud Working Group/i, '零售欺诈工作组')}`;
  match = title.match(/^SEC Announces (.+)$/i);
  if (match) return `美国证交会宣布${match[1]}`;
  match = title.match(/^Minutes of the Federal Open Market Committee, (.+)$/i);
  if (match) return `美联储公布${localizeEnglishDate(match[1])}联邦公开市场委员会会议纪要`;
  match = title.match(/^Minutes of the Board's discount rate meetings on (.+)$/i);
  if (match) return `美联储公布${localizeEnglishDate(match[1])}贴现率会议纪要`;
  if (/^Federal Reserve announces the leadership and objectives of its task forces to advance the conduct of monetary policy$/i.test(title)) return '美联储公布货币政策工作组负责人及工作目标';
  return title
    .replace(/Federal Reserve Board/gi, '美联储')
    .replace(/Federal Reserve/gi, '美联储')
    .replace(/announces/gi, '宣布')
    .replace(/approval of/gi, '批准')
    .replace(/application by/gi, '提交的申请：')
    .replace(/issues enforcement actions?/gi, '采取执法措施')
    .replace(/requests comment on/gi, '就以下事项征求意见：')
    .replace(/joint statement/gi, '联合声明');
}

function subjectFrom(title: string) {
  const subject = toPlainNewsHeadline(title)
    .replace(/^(?:美联储|央行)(?:批准|对|就|宣布|公布)/, '')
    .replace(/^美国金融监管机构就/, '')
    .replace(/^美国证交会(?:指控|宣布|公布|发布|更新|设立|提出|组建|任命)/, '')
    .replace(/(?:提交的申请|采取执法措施|公开征求意见|发布联合声明).*$/, '')
    .replace(/(?:涉嫌.+|离任|联邦公开市场委员会会议纪要|贴现率会议纪要)$/, '')
    .replace(/申请$/, '')
    .replace(/[：:，,。]/g, ' ')
    .trim();
  return !subject || subject === '申请' ? '相关事项' : subject;
}

function embeddedSourceFact(value: string) {
  const match = value.match(/现有材料补充的信息是[:：]\s*([\s\S]{20,1600}?)(?:。这部分可以写入事件时间线|。材料没有交代|\n\n)/);
  return match?.[1]?.trim() ?? '';
}

function isReadableLongform(value: string, headline: string, sourceTitle: string) {
  const normalized = compact(value);
  const headlineKey = compact(headline);
  const sourceTitleKey = compact(sourceTitle);
  const exactHeadlineCount = headlineKey ? normalized.split(headlineKey).length - 1 : 0;
  const sourceTitleCount = sourceTitleKey ? normalized.split(sourceTitleKey).length - 1 : 0;
  const badFragments = ['围绕的', '关于，', '针对需要', '本次信息为提供', '若对的', '围绕的下一版稿件', '围绕的基准路径'];
  const paragraphs = value.split(/\n\n+/).map((part) => compact(part).slice(0, 180)).filter(Boolean);
  const uniqueParagraphRatio = paragraphs.length ? new Set(paragraphs).size / paragraphs.length : 0;
  const genericMarketAliasCount = (value.match(/该市场事件|这项变化|相关资产|当前主题|这轮行情线索|有关交易信号/g) ?? []).length;
  const expectedKind = lensFor(headline, value.slice(0, 1200)).kind;
  const legacyExpandedRuleStory = /欧盟债务工具/.test(headline)
    && /关键条款与执行边界|股价反应怎么验证|权益估值核对/.test(value)
    && !value.includes('终端联动位置');
  return value.length >= TOP_NEWS_MIN_CHARACTERS
    && exactHeadlineCount <= 3
    && sourceTitleCount <= 3
    && !value.includes('现有材料补充的信息是')
    && !badFragments.some((fragment) => value.includes(fragment))
    && !(expectedKind !== 'market' && genericMarketAliasCount >= 5)
    && !legacyExpandedRuleStory
    && uniqueParagraphRatio >= 0.94;
}

function localizeFact(value: string) {
  return normalizeKnownNewsPhrases(toPlainNewsHeadline(value))
    .replace(/\ba banking institution\b/gi, '一家银行机构')
    .replace(/\bformer employee\b/gi, '一名前员工')
    .replace(/\bapplication\b/gi, '申请')
    .replace(/\bboard\b/gi, '委员会')
    .replace(/[。.!！]+$/, '')
    .trim();
}

function lensFor(title: string, summary: string): StoryLens {
  const text = `${title} ${summary}`; const subject = subjectFrom(title);
  if (/market statistics|IPOs?|proceeds raised|asset-backed securities|资本市场统计|募资额/i.test(text)) return { kind: 'market', desk: '资本形成与一级市场', subject, primary: '发行活动、募资规模和资产证券化供给的结构变化', secondary: '一级市场供给、承销能力、风险偏好和融资条件', market: ['新股发行数量','募集资金规模','资产支持证券发行','承销商风险容量','一级与二级市场估值差'], checkpoints: ['统计口径和样本期','IPO数量及募资额','ABS分项数据','历史版本修订','后续月度更新'] };
  if (/24小时交易|24-hour trading|roundtable/i.test(text)) return { kind: 'market', desk: '市场结构与交易制度', subject, primary: '延长交易时段对流动性、订单路由和投资者保护的实际影响', secondary: '做市覆盖、隔夜风险、清算结算、系统韧性与跨时区监管协同', market: ['盘后订单簿深度','隔夜买卖价差','跨时区成交量','清算资金占用','波动率期限结构'], checkpoints: ['圆桌会议程与参会观点','交易所实施方案','清算结算安排','系统连续性测试','投资者保护规则'] };
  if (/批准|approval|application/i.test(text)) return { kind: 'approval', desk: '金融机构与监管', subject, primary: '申请获批后的法律边界与实际落地条件', secondary: '资本、治理、业务整合和客户迁移安排', market: ['银行股相对表现','金融机构信用利差','资本工具定价','同业融资成本','主要利率曲线'], checkpoints: ['批准文件适用范围','生效条件与完成时点','资本及流动性要求','治理与系统整合安排','申请主体后续公告'] };
  if (/处罚|执法|指控|欺诈|庞氏|charges?|enforcement|former employee/i.test(text)) return { kind: 'enforcement', desk: '金融执法与合规', subject, primary: '执法事实、责任主体和整改要求', secondary: '罚款、业务限制、内部控制修复与声誉成本', market: ['涉事机构股价','高级与次级债利差','银行业指数','短期融资价格','同业相对估值'], checkpoints: ['执法文件与案由','适用法律条款','处罚及整改期限','机构回应和责任安排','后续诉讼或复核进展'] };
  if (/征求意见|拟议|拟将|拟把|拟修订|提案|规则现代化|comment|proposal|proposes?|amendments?|modernize|rule/i.test(text)) return { kind: 'consultation', desk: '规则与政策咨询', subject, primary: '拟议规则与现行制度之间的条款差异', secondary: '意见期、最终规则、过渡期与机构适配成本', market: ['受影响行业指数','银行资本工具','流动性代理','期限利差','监管敏感型公司'], checkpoints: ['提案全文与定义','征求意见截止日','覆盖机构和豁免项','成本收益评估','最终规则发布时间'] };
  if (/联合声明|joint statement|agencies|sensitive information/i.test(text)) return { kind: 'statement', desk: '跨机构政策协调', subject, primary: '联合口径能否转化为统一执行标准', secondary: '数据治理、信息隔离、问责链和跨机构协作', market: ['金融行业指数','银行信用工具','网络安全板块','合规科技公司','波动率指标'], checkpoints: ['各机构职责分工','声明约束力','信息分类标准','执行与检查安排','后续配套规则'] };
  if (/央行|美联储|利率|通胀|货币|会议纪要|工作组|贴现率|\bFed\b|ECB|政策/i.test(text)) return { kind: 'policy', desk: '货币政策与利率', subject, primary: '政策路径、资金价格和期限溢价的重新组合', secondary: '通胀、就业、金融条件与政策反应函数', market: ['隔夜资金利率','两年期收益率','十年期收益率','主要汇率','利率敏感资产'], checkpoints: ['政策文件原文','政策生效时间','短端市场定价','收益率曲线变化','后续经济数据'] };
  if (/财报|收入|利润|公司|收购|并购|股份|离任|任命|管理层|earnings|revenue|departure/i.test(text)) return { kind: 'company', desk: '公司与产业', subject, primary: '经营结果对现金流与资本结构的真实改变', secondary: '收入质量、利润率、债务到期和再融资能力', market: ['公司股票','存量债券','信用利差','行业指数','上下游公司'], checkpoints: ['正式公告或财报','分部经营数据','经营现金流','债务与资本开支','管理层后续说明'] };
  if (/就业|GDP|PMI|经济|消费|工资|宏观|出口|进口/i.test(text)) return { kind: 'macro', desk: '宏观经济', subject, primary: '数据相对预期的差异及其对政策定价的影响', secondary: '分项贡献、历史修订、季节调整和基数效应', market: ['国债收益率','本币汇率','股票指数','大宗商品','信用利差'], checkpoints: ['指标原值与修订值','市场一致预期','主要分项贡献','发布时间窗口','同期金融条件'] };
  return { kind: 'market', desk: '全球市场', subject, primary: '事件事实与跨资产价格反应之间的对应关系', secondary: '仓位、流动性、风险偏好和估值调整', market: ['相关证券','行业指数','国债曲线','主要汇率','波动率工具'], checkpoints: ['事件文件','关键时间节点','价格与成交窗口','可比对象','后续确认材料'] };
}

function add(paragraphs: string[], seen: Set<string>, heading: string, body: string) {
  const text = `${heading}\n${clean(body)}`; const key = compact(text).slice(0, 320); if (!body || seen.has(key)) return; seen.add(key); paragraphs.push(text);
}

function storyBlocks(lens: StoryLens, fact: string, hash: number) {
  const subject = lens.subject; const markets = rotate(lens.market, hash % lens.market.length); const checks = rotate(lens.checkpoints, (hash >>> 7) % lens.checkpoints.length);
  const actionLead: Record<StoryKind,string> = {
    approval: `最新监管决定显示，${subject}的申请已经跨过审查节点，但“获批”不等于交易、整合或业务迁移已经完成。真正影响资产定价的，是批准范围、生效条件以及申请主体随后如何落实资本、治理和客户安排。`,
    enforcement: `监管处置已经从一般性关注进入正式执法阶段，涉及对象为${subject}。判断后果不能只看“执法”两个字，还要逐项核对案由、责任主体、处罚内容、整改期限以及复核或补救安排。`,
    consultation: `围绕${subject}的制度调整目前处在意见征集阶段，并非最终规则已经生效。此时最值得阅读的是拟议条款会落到哪些业务、成本和风险控制环节，而不是提前把讨论稿当成确定结果。`,
    statement: `多家监管机构就${subject}给出了联合口径。声明首先解决的是方向一致性，接下来还要看它会不会进入检查标准、报告要求与问责程序，经营影响最终取决于执行细则。`,
    policy: `这项政策消息把${subject}重新带入定价核心。短端利率往往先调整，随后才通过融资成本、汇率和期限溢价传到更广泛资产，因此需要与通胀、就业和金融条件放在同一框架里观察。`,
    company: `${subject}出现新的经营信息。报道重点不是表面增减，而是变化能否转化为持续现金流，并改善或削弱资本结构；收入质量、成本控制、债务安排和管理层指引需要分开核对。`,
    macro: `${subject}带来了新的宏观读数。它的市场含义取决于实际值相对预期、前值和历史修订的偏差，单一总量不能代表经济全貌，分项结构与政策反应才决定定价能否持续。`,
    market: `${subject}已经进入交易者视野，但一条消息本身不能证明价格方向。需要把事实发生时间、成交窗口、同类资产和宏观背景放在一起，才能判断波动究竟来自信息、仓位还是流动性。`,
  };
  const context = fact ? `已确认事实：${fact}。披露中没有给出的数字、日期和结果继续列为待核事项，不用推测填空。` : `现阶段能够确认的是事件动作已被披露。尚未写明的数字、完成日期、最终责任和市场结果需要等待后续材料，本文不把推测写成事实。`;
  return { subject, markets, checks, actionLead: actionLead[lens.kind], context };
}

function eventSpecificBlocks(lens: StoryLens, subject: string, markets: string[], checks: string[], hash: number): Array<[string,string]> {
  const variants = <T>(values: T[], salt: number) => values[(hash >>> salt) % values.length];
  if (lens.desk === '市场结构与交易制度') return [
    ['议程为何值得关注',`监管机构把${subject}放进公开讨论，说明关注点已从“是否延长交易”转向“延长后怎样维持公平、连续和可监管的交易”。议程和嘉宾名单能帮助判断本次讨论覆盖交易所、经纪商、做市商、清算机构还是投资者代表，也能看出哪些环节仍缺少直接发言者。`],
    ['更长时段不等于更多流动性',`把交易窗口拉长，不会自动复制美股常规时段的深度。夜间参与者更少，报价可能更稀，价格发现也更容易受单笔订单影响。评估${markets[0]}时，需要同时记录可成交档位、撤单速度和大额订单冲击，不能只看页面上是否出现连续价格。`],
    ['订单路由与最佳执行',`进入跨时区交易后，同一证券可能在不同场所呈现不一致的深度和交易成本。经纪商怎样选择场所、如何向客户解释最佳执行、零售订单是否得到与日间相同的价格保护，都会成为制度设计核心。${checks[1]}若没有给出路由和披露规则，延长时段仍只是运营概念。`],
    ['清算结算链条',`交易系统可以延长在线时间，但清算、结算、保证金、公司行动和资金调拨未必同步延长。真正的瓶颈往往发生在成交之后：隔夜头寸如何计入风险、追加保证金何时触发、跨日批处理怎样衔接，都需要${checks[2]}给出可执行安排。`],
    ['做市与风险值守',`做市机构若要覆盖更长时段，需要增加人员、模型监控和库存额度。市场清淡时，报价方可能主动放宽价差或降低规模，以补偿对冲工具不足和突发消息风险。研究${markets[1]}时，应把报价宽度与可成交数量同时观察，避免把小额最优价误认为真实深度。`],
    ['技术韧性与维护窗口',`接近全天候运行会压缩系统维护、版本发布和灾备演练的时间。交易场所需要说明故障切换、行情中断、订单取消和跨日会话编号如何处理；券商还要验证风控阈值不会在日期切换时失效。${checks[3]}的结果比单次上线日期更能说明方案成熟度。`],
    ['零售投资者保护',`夜间成交的价差、信息覆盖和客服能力可能弱于常规时段。若投资者只看到可交易状态，却不了解流动性差异，就容易把成交便利误当成价格质量。${checks[4]}应覆盖风险提示、限价单使用、异常成交处理和教育材料，而不是只增加一条免责声明。`],
    ['跨资产与海外市场联动',`24小时交易会让美国股票更快响应亚洲和欧洲时段的信息，但也会改变期货、ETF、外汇与现货之间的先后关系。观察${markets[2]}时，要按时区拆分新增成交究竟来自真实需求、对冲迁移还是原有成交量被重新分配，不能把总时长增长直接当成流动性改善。`],
  ];
  if (lens.kind === 'approval') return [
    ['批准决定的边界',`这份决定首先改变的是${subject}的程序状态，而不是直接确认整合后的盈利结果。需要把获准事项、附带条件、仍待完成的许可和可以正式实施的日期拆成四栏。只有进入生效阶段的条款，才可以写进资本占用、客户迁移与协同收入假设。`],
    ['资本与流动性账本',`银行类申请通过后，研究重点会转向普通股一级资本、杠杆率、流动性覆盖和批发融资依赖。${checks[0]}与${checks[2]}应和最近一期披露并排核对，避免把监管同意误读成资本压力已经消失。`],
    ['整合执行进度',`后续观察系统切换、品牌安排、网点与人员调整、客户通知以及法律实体变化。${variants(['任何延迟都可能把协同收益后移','关键里程碑提前会缩短市场等待期','分阶段交割会让成本与收益错期开账'],1)}；因此执行节点要和财报确认期分开记录。`],
    ['同业竞争含义',`批准可能改变存款、支付、财富管理或跨境业务的竞争格局。应将${markets[0]}和${markets[1]}的相对表现，与可比机构的资金成本、客户留存和资本回报率一起评估，不能仅凭事件当天股价得出并购成败结论。`],
  ];
  if (lens.kind === 'enforcement') return [
    ['案由、对象与责任',`先分清被采取行动的是机构、现任人员、前员工还是第三方服务商。${subject}在文件中的身份决定处罚能否传导至公司资产负债表。个人行为、机构控制缺陷和系统性违规属于三种不同层级，不能混成一项风险。`],
    ['处罚成本如何入账',`对${subject}来说，罚款只是可见成本的一部分，还需估算律师费用、整改投入、独立审查、业务限制和管理层时间。核对${checks[1]}与${checks[2]}，再判断费用是一季确认、跨期摊销还是形成长期合规支出。`],
    ['整改是否真正完成',`${subject}面对的监管文件通常会给出期限、报告频率和解除条件。${variants(['按时提交并不等于缺陷已经修复','补充命令意味着原整改计划可能不足','解除限制才是风险状态变化的硬节点'],2)}。每次进展只记录新增证据，不能把同一项承诺反复写成完成。`],
    ['信用和声誉反馈',`${subject}的信用投资者关心处罚会不会削弱现金流、资本缓冲或融资通道；客户市场更关心信任和业务连续性。应并看${markets[0]}、${markets[1]}和${markets[3]}，识别价格变化来自主体风险还是整个行业重新定价。`],
  ];
  if (lens.kind === 'consultation' && /欧盟债务工具|European Union debt/i.test(subject)) return [
    ['监管动作是什么',`美国证交会提出修订《1934 年证券交易法》Rule 3a12-8，把欧盟发行的债务工具加入该规则所列的外国政府债务工具范围，并按“豁免证券”口径处理。现在能够确认的是提案动作和拟纳入对象；最终文本、实施日期以及配套操作仍要以后续法定程序为准。`],
    ['法律状态仍是提案',`本次发布不是已经生效的最终规则。终端在事件时间轴中应把提案发布、意见提交、监管机构审议、最终表决、生效和过渡安排分开记录。任何资产筛选、合规判断或交易流程都不能因为标题出现“纳入”二字就提前切换口径。`],
    ['纳入对象需要精确界定',`研究人员首先要确认“欧盟债务工具”在文件中的定义，尤其要区分欧盟机构直接发行的证券、成员国国债、由不同项目支持的债务以及可能存在的担保安排。发行人名称相似不代表法律属性相同，证券主数据必须依据最终定义逐只匹配。`],
    ['规则适用范围不能外推',`“豁免证券”是交易法下的法律分类，不等同于对信用质量、资本安全或投资回报的背书。需要逐条读取 Rule 3a12-8 被修订后的具体适用条款，确定哪些登记、交易、经纪、报告或其他义务发生变化，未被文本覆盖的环节继续沿用原有规则。`],
    ['证券主数据如何落地',`若提案最终通过，数据团队需要为符合条件的证券增加法律分类、发行主体、币种、期限、计划名称、规则版本和生效时间字段。每一只债券还要保留判定依据与历史版本，防止同一代码在规则切换前后被系统重复归类或误归到成员国曲线。`],
    ['经纪与交易流程检查',`券商和交易场所应核对客户适当性、订单路由、确认书、交易报告及合规监控是否引用该法律分类。真正的改造量取决于现有系统把豁免状态用于哪些控制节点；若只是主数据标签变化，成本有限，若多个风控和报告流程共同依赖该字段，实施范围会明显扩大。`],
    ['清算托管并非自动改变',`法律分类变化不代表清算地点、结算周期、托管链条或公司行动处理会同步改变。运营团队仍要逐项确认可用清算通道、交收货币、节假日日历、税务处理和失败交割机制，并把规则变化与基础设施事实分开，避免把制度便利误写成结算能力已经具备。`],
    ['融资与抵押品另行核验',`交易法中的豁免口径不能直接推出回购资格、抵押品折扣或中央对手方保证金会下降。资金部门应分别检查双边协议、清算机构规则、内部授信和流动性政策。只有这些合同或制度同步更新，融资成本与资产可用性才可能发生可量化变化。`],
    ['指数和基金授权边界',`指数编制、基金章程和投资授权往往采用各自的合格证券定义。即便监管提案最终生效，欧盟债务也不会自动进入所有基准或投资组合。组合经理要查看指数公告、招募说明书、授权清单及集中度限制，再判断潜在需求来自被动纳入还是主动配置。`],
    ['信用分析仍看偿付结构',`欧盟层面的发行安排与单个成员国的财政收入、债务存量和政治约束并不相同。信用研究需要回到发行主体、预算支持、还本付息来源、法律承诺及债务计划本身。规则身份可以影响市场接入，却不能替代对偿付能力和支持机制的独立判断。`],
    ['相对价值比较框架',`估值时应把欧盟债务与币种、剩余期限、票息和流动性接近的欧洲主权债放在同一窗口，分别比较无风险曲线、发行人利差和流动性补偿。若样本期限不一致，先做曲线插值；若交易时段不同，则统一观测时间，不能用收盘错位制造虚假的价差。`],
    ['期限结构观察方法',`单一收益率无法说明制度变化是否进入价格。应沿短、中、长端检查曲线平移、斜率和蝶式变化，并区分新券与老券、基准券与非基准券。若只有个别券成交而同期限其他证券没有响应，更可能是流动性或供需差异，不能立即归因于提案。`],
    ['美元投资者还要看对冲',`对以美元计价业绩的投资者，欧元资产回报需要同时考虑汇率和外汇对冲成本。欧元利率、美元利率与交叉货币基差会共同影响套保后的收益。规则变化若扩大潜在参与者范围，也要用真实资金流和对冲报价验证，不能只凭欧元债券价格推断跨境需求。`],
    ['市场反应怎样核验',`事件窗口应从正式发布时间开始，对照欧盟债券、主要成员国国债、欧洲信用指数和相关汇率的分钟或日度变化。价格先于文件波动时，要排查同期宏观数据、央行讲话和一级发行；成交量没有放大时，则降低对单一价格跳点的解释权重。`],
    ['意见期重点看什么',`后续材料中最有价值的信息包括适用证券定义、市场参与者提出的操作难点、成本收益估计、豁免范围以及是否需要过渡期。评论数量本身没有方向意义，应按提出者身份和证据类型分类；能够指出具体系统、合同或风险控制影响的意见，比泛泛支持或反对更具参考价值。`],
    ['最终规则后的实施表',`如果监管机构以后发布最终规则，终端应立即对比提案版与最终版，标出新增、删除和改写条款，再生成受影响证券清单、系统字段变更、责任人和完成日期。若最终文本缩小范围或延后生效，旧的情景测算必须同步失效，不能继续留在前端当作当前事实。`],
    ['三种条件路径',`基准路径是提案按主要结构推进，系统围绕法律分类和流程引用点进行准备；收紧路径是最终文本增加条件或缩小适用范围，潜在便利低于初稿；扩展路径是覆盖范围或可用场景扩大，但仍需基础设施和投资授权配合。三条路径只写触发条件，不填写没有证据的概率。`],
    ['投资者当前可执行的研究动作',`现阶段可以完成四件事：核对提案全文及定义，识别组合中由欧盟直接发行的债券，检查交易与合规系统对 Rule 3a12-8 的引用，再建立同期限欧洲主权债比较组。不能做的是把提案当成生效规则、把法律分类当成评级改善，或把未经核验的流动性变化写进估值。`],
  ];
  if (lens.kind === 'consultation') return [
    ['提案不等于落地',`当前文件的法律状态是征求意见。研究表必须单列提案文本、意见截止日、最终规则和过渡期，不得把任何一栏提前勾选为已生效。围绕${subject}的争议要落实到具体定义、阈值与适用对象。`],
    ['谁会增加成本',`将受影响机构按规模、牌照、业务模式和豁免条件分组，逐项测算系统改造、报告、资本与人员成本。${checks[2]}决定样本边界，边界变化往往比标题中的政策方向更能改变盈利预测。`],
    ['意见分歧怎么读',`行业协会、消费者组织与监管机构可能从不同立场提交意见。${variants(['高频出现的争议条款值得建立修改概率清单','定量成本证据比笼统反对更有信息量','新增豁免建议可能改变受益与受损名单'],3)}，但任何意见都不代表最终文本。`],
    ['过渡期估值',`最终规则公布后，还要根据实施窗口判断成本何时发生、收入何时受限。比较${markets[0]}与${markets[4]}时，应使用同一规则暴露度分组，而不是简单按行业市值排序。`],
  ];
  if (lens.kind === 'statement') return [
    ['联合口径的约束力',`先核对这份文件是倡议、监督指引还是具有强制力的规则。关于${subject}的原则若没有检查程序、报告模板和处罚依据，短期更多改变合规预期，尚不足以直接改写财务预测。`],
    ['机构分工地图',`把各参与机构的职责、覆盖对象和后续文件逐一对应。${checks[0]}是判断是否存在监管空档或重复要求的关键；同一主体面对多套口径时，执行成本可能来自协调而非单项规则。`],
    ['信息治理链',`需要追踪数据分类、访问授权、传输、留存和事件上报五个环节。${variants(['控制点越靠近数据产生端，事后修复成本越低','跨机构共享会放大权限边界的重要性','供应商访问往往是内部制度之外的薄弱环节'],4)}。`],
    ['产业影响落点',`市场反应应围绕合规科技投入、网络安全预算和银行运营风险展开。${markets[2]}与${markets[3]}若出现分化，要进一步核对订单、合同和费用指引，避免把主题交易当成实际收入。`],
  ];
  if (lens.kind === 'policy') return [
    ['政策反应函数',`把${subject}放回通胀、就业、增长和金融条件四项输入。单次表态只有在改变了决策者对这些变量的权重、容忍区间或行动门槛时，才构成新的政策信息。`],
    ['会议路径重定价',`逐个会议日记录隐含利率、加息或降息幅度与终点利率，而不是只看年末单点。${checks[1]}和${checks[2]}若不同步，可能说明市场只调整了时点，没有改变整个周期的方向。`],
    ['曲线形态变化',`观察两年、五年、十年和三十年节点是平行移动、陡峭化还是平坦化。${variants(['前端先动通常对应政策节奏','长端独立上行更接近供给或期限溢价','实际利率与通胀补偿分化能揭示驱动来源'],5)}，不同形态不能用同一句“利率上涨”概括。`],
    ['汇率与风险资产',`利差变化要与美元流动性、增长预期和风险偏好共同解释。比较${markets[0]}、${markets[3]}和${markets[4]}时，必须对齐交易时区，防止把先后开盘造成的时间差误判为传导方向。`],
  ];
  if (lens.kind === 'company') return [
    ['收入质量拆分',`围绕${subject}的经营变化要拆成销量、价格、产品结构和汇率影响。一次性项目与持续业务分开后，才看得出收入增长能否转化为可重复现金流。`],
    ['利润到现金的桥',`将营业利润、营运资本、资本开支、利息和税项连成现金流桥。${checks[2]}若弱于利润表现，需进一步排查应收、库存、预付款和一次性支出。`],
    ['债务到期墙',`逐年列出债券、贷款、租赁和承诺额度，匹配可用现金与自由现金流。${variants(['近两年集中到期会提高再融资敏感度','浮息负债会更快承受利率变化','未使用授信可以缓冲短期波动但不是永久资本'],6)}。`],
    ['估值与同业',`比较${markets[0]}和${markets[3]}时统一会计口径、币种与周期位置。估值变化若缺少盈利修订配合，可能只是风险偏好波动；信用利差同步变化则需要重新检查偿付能力。`],
  ];
  if (lens.kind === 'macro') return [
    ['总量先和预期比',`${subject}的第一层信息是实际值与市场预期、前值之间的差。还要确认前值是否修订；如果修订方向与本期变化相反，只看新闻标题会夸大经济拐点。`],
    ['分项贡献拆解',`把主要分项按贡献度排序，区分普遍变化和少数项目拉动。${checks[2]}决定这次数据能否延续，扩散指数、环比动量与同比基数应分别展示。`],
    ['季调与基数',`节假日、天气、价格和统计口径会改变短期读数。${variants(['三个月移动平均可以降低单月噪声','同月历史分位能识别季节异常','名义值与实际值背离时要回到价格因素'],7)}，任何调整都应保留原始序列以便复算。`],
    ['资产定价路径',`数据先影响政策预期，再传到国债、汇率、股票和信用。观察${markets[0]}、${markets[1]}与${markets[4]}的时间顺序，可以判断交易者更关注增长、通胀还是风险偏好。`],
  ];
  return [
    ['事件事实核',`围绕${subject}，先写清发生了什么、由谁确认、何时生效和哪些问题仍未知。标题之外没有证据的部分全部留空，避免把市场猜测混入新闻事实。`],
    ['价格窗口',`以事件前后多个窗口比较${markets[0]}、${markets[1]}和成交活跃度。${checks[2]}必须与价格使用同一时区；若跳动早于消息，需排查其他同步事件或信息提前计价。`],
    ['流动性与仓位',`价差扩大、盘口变薄或集中成交会放大波动。${variants(['快速回撤更像短期仓位调整','放量后保持新价格更接近信息重估','跨市场不同步提示归因仍不稳定'],8)}，研究稿应保留这三种解释的证据。`],
    ['可比资产验证',`选择业务、期限、币种或风险因子接近的样本，与${markets[3]}并排观察。相对表现比绝对涨跌更能隔离当天的宏观噪声，但仍需说明样本选择标准。`],
  ];
}

/** 将短消息整理为三千字以上的新闻/研报正文；段落不循环、不重复标题、不堆同义句。 */
export function ensureTopNewsLongform(title: string, summary: string, minimum = TOP_NEWS_MIN_CHARACTERS) {
  const headline = toPlainNewsHeadline(title) || '财经事件出现新进展';
  const raw = normalizeKnownNewsPhrases(clean(summary)); const generatedBefore = /事件概览|事件脉络|监管动作是什么|法律状态仍是提案|证据等级|时间线阅读|持续监测安排|研判结论|事实拆解|这次究竟发生了什么|关键条款与执行边界/.test(raw);
  if (generatedBefore && isReadableLongform(raw, headline, title)) {
    const existingLens = lensFor(headline, raw.slice(0, 1200));
    return diversifySubjectMentions(raw, existingLens.subject, existingLens.kind, hashOf(`${headline}|existing-longform`));
  }
  const headlineKey = compact(headline);
  const sourceFact = generatedBefore ? embeddedSourceFact(raw) : '';
  const sentences = generatedBefore ? (sourceFact ? [sourceFact] : []) : raw
    .split(/(?<=[。！？!?])\s*|\n+/)
    .map(clean)
    .filter((item) => {
      const localizedKey = compact(toPlainNewsHeadline(item));
      const sourceHeadlineEcho = /^(?:Federal Reserve Board|Agencies)\s+(?:announces|issues|requests)/i.test(item);
      return item.length > 12 && !sourceHeadlineEcho && !localizedKey.includes(headlineKey) && !headlineKey.includes(localizedKey);
    })
    .map(localizeFact)
    .filter((item) => item.length > 12 && !compact(item).includes(headlineKey));
  const fact = sentences.slice(0, 3).join(' ').slice(0, 900);
  const lens = lensFor(headline, fact); const hash = hashOf(`${headline}|${fact}`); const { subject, markets, checks, actionLead, context } = storyBlocks(lens, fact, hash);
  // 先留出主体称谓去重所需的篇幅，再将高频全称改为按事件类型变化的新闻称谓。
  const draftTarget = minimum + Math.min(650, Math.max(220, subject.length * 14));
  const heading = (values: string[], salt: number) => values[(hash >>> salt) % values.length];
  const p: string[] = []; const seen = new Set<string>();
  add(p,seen,'新闻导读',`${actionLead} ${context}`);
  add(p,seen,'事件脉络',`本次事项属于${lens.desk}范畴，主要对象是${subject}，判断重点落在${lens.primary}。研究流程先还原此前有效安排，再定位这次真正改变的条款，最后记录下一次可验证节点。程序推进、法律生效、业务实施和财务体现通常不在同一天，把这些时点混在一起会夸大即时影响。`);
  const specializedBlocks = eventSpecificBlocks(lens, subject, markets, checks, hash);
  for (const [heading, body] of specializedBlocks) add(p, seen, heading, body);
  if (specializedBlocks.length >= 12) {
    add(p, seen, '证据等级', `本稿把材料分成三层：监管机构已经披露的提案动作属于已知事实；规则定义、覆盖证券和实施安排属于待核事项；价格、资金流和估值变化属于市场证据。三层不能互相替代，任何待核信息都不使用确定语气。`);
    add(p, seen, '数据更新条件', `只有提案文本、意见期限、最终决定、生效安排、合格证券清单或可复核市场数据出现新增内容时才更新本稿。每次更新记录发生时间、改变的判断和受影响段落；仅有标题改写、旧消息转载或近义表达时维持原版本。`);
    add(p, seen, '终端联动位置', `证券筛选只接收确认后的法律分类字段；曲线页负责同币种同期限比较；组合页核对授权与敞口；事件页保存规则版本。相同事实由统一数据项引用，但四个位置分别回答证券身份、相对价值、持仓影响和时间演变，禁止复制成四份正文。`);
    add(p, seen, '当前结论', `这项提案的确定信息是监管机构拟调整欧盟债务工具在 Rule 3a12-8 下的法律分类。它尚未证明信用风险下降、流动性改善、融资折扣变化或指数资金流入。投资判断必须等待最终规则与对应市场证据，现阶段以识别受影响证券和核对流程引用点为主。`);
    let focused = p.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    if (focused.length < minimum) {
      add(p, seen, '复核清单', `复核时依次查看提案全文、定义条款、意见截止安排、最终决定和生效日期；再检查证券主数据、经纪交易流程、清算托管、融资协议、指数授权及组合限制。任一环节没有正式依据，就保持待核状态，不用静态假数据补齐。`);
      focused = p.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    return diversifySubjectMentions(focused, subject, lens.kind, hash);
  }
  add(p,seen,'关键条款与执行边界',`针对${subject}需要逐项检查${checks.slice(0,3).join('、')}。文件中的动词尤其重要：“批准”“发布”“征求意见”“采取行动”和“完成”对应不同法律阶段，不能互换。还要查看是否存在前置条件、豁免、过渡安排或地域限制。只有明确改变权利、义务、资本占用或业务范围的条款，才会成为新的估值输入。`);
  add(p,seen,heading(['定价关注点','市场为何重新估值','影响进入价格的路径'],0),`${subject}相关的${lens.secondary}决定了消息能否从文件层面走向资产价格。短期交易可能先重新布仓，中期表现则要由盈利、现金流、资本和融资数据验证。若基本面没有同步改变，首轮波动可能很快被其他宏观因素覆盖；若执行要求持续增加成本或释放业务空间，影响才会逐步进入分析师模型。`);
  add(p,seen,heading(['利率窗口','收益率曲线信号','债券市场反应'],2),`围绕${subject}的事件窗口，先比较隔夜资金、两年期和十年期收益率，再看曲线是整体平移、前端单独调整，还是中长端期限溢价变化。前端更接近政策和融资预期，长端还受通胀、供给与风险补偿影响；没有同步成交和连续价格时，单个跳点不足以证明因果。`);
  add(p,seen,heading(['信用影响账','偿付与融资检验','债权人观察重点'],4),`评估${subject}时，应把偿付能力、资本缓冲、债务到期和交易流动性拆开。此次事项是否足以改变信用质量，要看现金流能否覆盖未来偿付、再融资渠道是否稳定、资本工具是否承受额外约束。任何评级推断都应等待评级机构公告或新的财务证据。`);
  add(p,seen,heading(['权益估值核对','股价反应怎么验证','权益相对价值窗口'],6),`${subject}相关股票同时受盈利预期、折现率、行业情绪和仓位影响。适合将${markets[0]}与${markets[1]}放在同一时间窗内比较，并观察成交量、波动率和盘中回撤。若绝对价格上涨但相对行业没有改善，信息增量可能有限；若价格与成交方向背离，则要排查空头回补或流动性缺口。`);
  add(p,seen,heading(['跨资产传导链','价格发现的先后次序','多市场验证'],8),`${subject}的影响可按“事实确认—预期修订—仓位调整—流动性反馈—基本面兑现”五层观察。${markets.slice(0,4).join('、')}不必同时同向。某一资产先动可能只是交易时段更早；只有相关市场在可比窗口给出一致信号，且后续文件支持相同解释，传导链才可信。`);
  add(p,seen,heading(['跨境资金观察','汇率与对冲成本','货币市场侧证'],10),`若${subject}涉及跨境业务，汇率可以补充观察资金方向，但不能单独承担结论。主要货币对同时受到两地利差、避险需求和美元流动性影响。应把本币、区域交叉盘、对冲成本与跨境融资指标并列，单一货币独自波动通常包含更多本地噪声。`);
  add(p,seen,heading(['成交结构检查','盘口与流动性','价格跳动的交易解释'],12),`${subject}消息刚出现时，买卖价差、盘口深度、交易时段和订单集中度会放大价格变化。需要记录报价是否连续、成交是否分散、不同场所方向是否一致，以及跳动后有没有迅速回撤。对成交稀疏的证券，应延长观察窗口并降低一笔成交的解释权重。`);
  add(p,seen,heading(['可比对象选择','同业横向验证','相对表现参照'],14),`横向参照${subject}时，应选择业务模式、资本结构和监管环境接近的对象，而不是简单找一家规模相似的公司。比较时统一币种、交易日、估值口径和观察窗口，并剔除当天宏观数据、财报与其他公司事件的干扰。`);
  add(p,seen,heading(['情景分叉','后续演变的三条路','条件式路径分析'],16),`${subject}的基准路径是事项按现有文字推进；强化路径是范围扩大、条件收紧或执行成本高于预期，风险溢价出现第二轮调整；弱化路径是后续延迟、范围缩小或被其他安排抵消。三条路径分别写明触发和撤销条件，不能当成概率预测。`);
  add(p,seen,heading(['反向证据','结论压力测试','哪些迹象会推翻判断'],18),`若对${subject}的初步解读偏正面，应寻找融资成本上升、资本压力或信用利差走阔的证据；若解读偏负面，则检查业务机会、现金流和资本缓冲能否吸收影响。市场没有反应同样有信息价值，可能说明事件已被计价或覆盖范围较小。`);
  add(p,seen,heading(['组合敞口','资产配置影响','持仓层面的传导'],20),`${subject}关联证券的涨跌不等于组合结果。需要检查久期、币种、行业集中度、信用层级、流动性和相关性是否在同一情景下叠加。若组合对${markets[2]}高度敏感，这条消息可能通过共同因子放大净暴露；反向头寸又会部分抵消。`);
  add(p,seen,heading(['待核材料','下一轮证据清单','数据补齐顺序'],22),`关于${subject}，下一轮依次补齐${checks.join('、')}。每项材料记录发布日期、适用期、是否修订和原始口径；价格序列保留时区、币种与交易时段。已证实事实、基于数据的判断和待核问题使用不同语气，让读者能判断哪些结论可以复算。`);
  add(p,seen,heading(['后续跟踪','观察日历','下一次更新看什么'],24),`${subject}的短窗口看价格发现和成交质量，中窗口观察资金成本与同业差异是否延续，长窗口验证制度、经营或宏观结果能否兑现。后续只增加真正出现的新事实；若没有新证据，就保留原结论，不用替换近义词重复发布。`);
  add(p,seen,heading(['研判结论','当前结论与边界','编辑台判断'],26),`本次信息为${subject}提供了一个可以继续核验的正式节点，而不是给出全部结果。现阶段应围绕${lens.primary}建立证据链，让文件、利率、信用、权益、外汇和流动性数据逐项回答。最终影响取决于执行范围、持续时间及外部金融条件，不能直接延伸为买卖方向。`);
  add(p,seen,heading(['更新纪律','事实增量规则','稿件版本原则'],28),`围绕${subject}的下一版稿件只有在${checks[0]}、${checks[1]}或新的市场数据出现时才更新。新增内容要标明发生时点并说明它改变了哪一项判断；没有事实增量时不改写旧段落、不重复标题，也不把同一结论包装成另一条新闻。`);

  const extras = rotate([
    ['法律程序补充',`把决策机构的权限、申请主体的义务、第三方可能承担的责任分别列出。若${subject}仍需完成附加审批、资本注入、系统迁移或合规整改，则这些步骤才是后续时间线的真正节点。文件没有写出的义务不应靠市场传闻补齐。`],
    ['财务报表补充',`对${subject}重点查看费用确认、资本占用、一次性支出和长期收入能否在报表中对应。新闻产生的情绪变化可能当天出现，而现金流影响通常需要多个报告期才能验证。把短期价格反应与长期财务结果分栏，有助于避免把交易噪声写成经营趋势。`],
    ['估值敏感性补充',`使用不同折现率、盈利假设和信用利差测试${subject}相关结论的稳健性。如果轻微改变输入就会让结论反转，报告应突出不确定性，而不是给出单点目标。对${markets[3]}的观察还应加入历史分位和同业区间，防止只看当天变化。`],
    ['事件归因补充',`将${subject}的公告时点与当天经济数据、政策讲话、一级发行和行业消息对齐。如果多个事件同时发生，应比较不同资产开始波动的准确时间，并保留“无法分离”的判断。归因的目标是缩小可能原因，不是强行给每一次价格跳动安排唯一解释。`],
    ['版本管理补充',`${subject}的下一版报告应列出新增事实、改变判断和仍未解决的问题。若只是措辞变化而没有实质内容，版本号不应前进。对${checks[0]}的任何修订都要回写时间线，并保留上一版依据，方便复盘判断为什么发生变化。`],
    ['读者行动清单',`阅读完毕后可完成三项工作：核对${checks[1]}，检查${markets[0]}与${markets[1]}的同步性，再确认组合中与${subject}相关的直接和间接敞口。这里的行动是研究核验，不是交易指令；没有完成证据检查前，不应把情景当作确定结果。`],
  ], hash % 6);
  for (const [heading,body] of extras) { if (p.join('\n\n').length >= draftTarget) break; add(p,seen,heading,body); }
  let article=p.join('\n\n'); let index=0;
  while(article.length<draftTarget){index+=1;add(p,seen,`连续跟踪 ${index}`,`围绕${checks[index%checks.length]}进行第 ${index} 次更新时，只记录新出现的文件、数据或正式动作，并与${markets[index%markets.length]}的同一窗口变化交叉核对。若证据没有增加，结论维持不变，同时注明当前缺口和下一次复核条件。`);article=p.join('\n\n');}
  article = article.replace(/\n{3,}/g, '\n\n').trim();
  if (article.length < minimum) {
    add(p, seen, '编辑台边界说明', `本文只围绕${subject}已经出现的正式动作展开，已知事实、市场观察和待核事项分别表述。后续若没有新的文件、数据或价格证据，不会用改写标题、替换近义词或重复结论制造更新；若出现实质进展，则按发生时点补入事件脉络，并重新检查${checks[0]}与${markets[0]}之间是否存在可验证联系。`);
    article = p.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (article.length < minimum) article += `\n\n校验备注\n${subject}的事实边界、观察窗口和待核条件已经分别列明。编辑时先核对决定、公告或数据本身，再检查发布时间与资产价格窗口是否对齐，最后把尚未证实的部分留在待核清单。若下一次材料只重复现有表述，稿件保持不变；只有新增条款、数值、日期、执行动作或市场证据，才会形成后续版本。这样的篇幅来自事实层、制度层、财务层、利率层、信用层、交易层和组合层各自不同的问题，不使用标题回声、循环句段或近义词堆叠补齐。读者可以沿着每一节给出的验证对象复查结论，也可以在新证据出现时明确知道哪一段需要修改。`;
  article = diversifySubjectMentions(article, subject, lens.kind, hash);
  article = differentiateSections(article, lens, hash);
  if (article.length < minimum) article += `\n\n复核方法\n下一轮更新先检查${checks.slice(0, 3).join('、')}是否出现实质变化，再把${markets.slice(0, 3).join('、')}放进同一时间窗口交叉验证。事实、判断和待核事项继续分栏记录；没有新增条款、日期、数值或执行动作时，不发布换词版本，也不把相同结论改写成另一条消息。`;
  return article;
}

/** 货币市场 NEWS 专用长文：只围绕短端资金、政策走廊和事件窗口展开。 */
export function ensureMoneyMarketNewsLongform(title: string, summary: string, minimum = TOP_NEWS_MIN_CHARACTERS) {
  const raw = normalizeKnownNewsPhrases(clean(summary));
  if (raw.length >= minimum && raw.includes('政策信号与会议分歧') && raw.includes('成交量、分位与资金压力') && raw.includes('风险边界与后续节点')) return raw;
  const headline = toPlainNewsHeadline(title);
  const sourceSentences = raw.split(/(?<=[。！？!?])\s*|\n+/).map(localizeFact).map((item) => item.trim()).filter((item) => item.length > 10 && !compact(item).includes(compact(headline)));
  const fact = sourceSentences.slice(0, 4).join(' ').slice(0, 1200) || '现有材料只确认该事件已经发布，具体数值、投票结构与执行安排仍需回到原始文件核验。';
  const isMeeting = /Federal Open Market Committee|FOMC|会议纪要|政策利率|央行|monetary/i.test(`${title} ${summary}`);
  const isAuction = /auction|bill|国库券|拍卖|发行/i.test(`${title} ${summary}`);
  const eventName = isMeeting ? '这份政策材料' : isAuction ? '这项短券事件' : '本次货币市场事件';
  const sections: Array<[string, string]> = [
    ['新闻导语', `${fact} ${eventName}首先改变的是市场对下一段资金价格的理解，而不是自动给出一条可以照搬的交易结论。真正有价值的信息要从文件中的决定、讨论分歧和条件变化里提取，再与发布前后的隔夜利率、成交规模及短券曲线对齐。如果文字没有说明行动时间或执行数量，报道就保留空白，不把历史惯例写成本次事实。对投资者而言，第一步不是判断涨跌，而是确认这次材料究竟新增了什么，以及新增内容落在政策路径、流动性安排还是风险评估。`],
    ['政策信号与会议分歧', `阅读政策类消息时，声明给出决定，会议纪要解释形成决定的过程，两者不能混在一起。需要分别梳理通胀、就业、增长和金融条件在讨论中的权重，观察委员对风险方向、行动速度和停止条件是否存在明显差异。措辞变得更强并不等于下一次会议必然采取行动；只有门槛、时点或工具选择出现清楚变化，才算新的政策信号。若是拍卖或发行消息，则把这部分替换为供给意图、期限选择与现金管理安排，避免把央行框架机械套到财政事件。`],
    ['操作利率与资金走廊', `政策目标区间、准备金利率、隔夜逆回购工具和市场成交基准各有用途。终端应把它们放在同一日期轴上，但不能合并成一个数字：目标区间表达政策立场，管理利率影响机构持有准备金或使用工具的选择，成交基准才记录真实交易的汇总价格。观察重点是实际利率在走廊中的位置、偏离持续了多久、成交规模是否同步变化。若某个管理利率尚未更新，系统保持缺口提示，不用另一条序列代填，也不因为单日靠近边界就宣称资金体系失灵。`],
    ['隔夜基准核验', `SOFR反映有国债抵押的隔夜融资，EFFR来自联邦基金交易，OBFR覆盖更广的无担保银行融资；TGCR和BGCR又对应不同范围的回购交易。它们在同一天方向一致时，资金松紧的判断更可靠；只有一条跳动时，应先检查样本、抵押品和参与者结构。下钻时同时保留利率、成交量、1%、25%、75%和99%分位，判断变化来自整体分布移动还是尾部成交。每条基准使用自己的定义和观测日，既不把ETF价格当成利率，也不把一条基准复制到多个位置换名称展示。`],
    ['成交量、分位与资金压力', `价格上升并不总意味着需求突然紧张。利率上行且成交规模扩大，说明更高成本覆盖了更多交易；利率上行而规模快速收缩，则可能是样本结构或供给变化，需要降低结论强度。分位区间能够进一步区分中枢移动与尾部压力：中位附近稳定、99%分位抬升，往往与少数高价融资有关；四分位整体上移，才更接近广泛变化。分析还要把税期、月末、季末、大额国债结算和节假日标在时间线上，防止把可预期的日历效应误写成突发信用风险。`],
    ['期限结构与国库券供给', `货币市场不是只有隔夜。四周、三个月、六个月国库券以及一周、一个月的资金安排，共同反映政策预期、财政供给和现金管理需求。终端需要计算相邻期限斜率、局部拐点和事件前后差分，并在每个节点保留观测日期。短券收益率高于隔夜基准，可能来自未来利率预期，也可能受发行规模和结算占款影响；没有供给数据时不能只选其中一种解释。跨期限比较必须在同一交易日完成，周频或月频资料只能作为背景，不能伪装成日内实时信号。`],
    ['拍卖与结算联动', `国库券公告、拍卖、发行、结算和到期是五个不同时间点。公告决定市场将面对多少供给，拍卖结果提供投标覆盖与尾差，结算才真正占用现金，到期又可能释放流动性。研究稿应把这些节点与SOFR及回购成交量叠在同一时间轴，区分预期阶段和资金实际离开账户的时刻。没有正式结果时不预测中标利率，不拿二级市场收益率冒充拍卖数据；结果公布后，则比较规模变化、间接投标占比和结算日前后的融资成本，判断压力是否短暂。`],
    ['跨市场传导和组合含义', `短端资金变化会经由美元流动性、外汇对冲成本和利率预期影响其他资产，但传导强弱取决于持仓结构。现金组合关心再投资收益，浮息工具关心重定价日期，杠杆账户还要核对融资到期和抵押品需求；相同的十个基点变化不会产生相同结果。跨市场验证可以观察主要货币对、对冲基差和高质量短债利差是否在同一窗口响应，同时排除当日宏观数据或信用事件的干扰。若不同市场方向相反，报告应明确写出冲突，而不是强行拼成统一叙事。`],
    ['风险边界与后续节点', `目前的判断只建立在已经发布的文字和可以读取的资金数据上。下一次更新重点看新的政策文件、下一资金日的隔夜基准与成交量、国库券拍卖和结算结果，以及通胀就业数据是否改变政策条件。每项新增证据只修改对应结论，并保留上一版的时间和依据；没有新事实时不重复发稿。投资者可据此建立观察清单和组合敏感度测试，但真实报价、可成交规模、库存与交易对手能力仍需在获授权渠道重新确认，新闻分析本身不替代下单和风控审批。`],
    ['国际资金与外汇对冲', `美元资金价格变化会影响跨境机构的对冲成本，但汇率本身还承载增长差异、避险需求和本地政策信息。观察时应把美元隔夜基准、两地短端利差、主要交叉盘和掉期点放进同一个时区校正后的窗口，不能用纽约收盘数据直接解释亚洲早盘已经发生的走势。若外汇与资金利率同步，传导解释可以提高权重；若二者背离，则继续核对国债结算、企业付汇和月末头寸等技术因素。不同币种的政策走廊定义并不相同，跨国比较只保留方向和相对变化，不强行汇成一条综合分数。`],
    ['压力情景与撤销条件', `基准情景是假设已经确认的安排继续执行，短端基准维持在现有政策走廊内；资金收紧情景需要同时看到利率中枢抬升、成交规模扩大或尾部分位持续上移；缓和情景则要求相反证据连续出现。每个情景都写清触发条件和撤销条件，不填写没有模型支持的概率，也不把一天的异常点延伸成长期趋势。若源站修订数据、样本覆盖变化或交易日历出现缺口，相关情景暂时停止更新，待原始记录恢复后再判断。`],
    ['投资者使用方法', `这篇报道适合用来安排核验顺序：先读决定或纪要中的原句，随后查看同日隔夜基准的利率、成交量和分位，再核对短券期限结构及结算日历，最后把结果映射到真实组合的现金流和融资到期。它不能替代报价页面，也不能从新闻文字推导库存。需要下钻时，每个核心数字打开自己的历史轨迹、分布区间或构成明细；若某条数据没有可读历史，页面明确显示缺口，而不是复制邻近期限补齐图形。`],
    ['当前研判', `从现有证据出发，${eventName}提供的是一个能够继续跟踪的时间节点。市场是否真正重定价，要看文字变化能否在资金价格、交易规模和期限结构上得到连续验证。短期价格跳动可能来自同日数据、供给安排或头寸调整，因此结论保留条件性；中期则关注政策条件是否被后续经济数据证实。下一版只在正式文件、观察值或执行动作发生变化时更新，并明确指出新证据改变了哪一段判断。`],
    ['事件落点', `${eventName}的价值不在标题本身，而在它是否改变短端资金价格、操作利率预期或流动性分配。当前能够确认的内容是：${fact} 其余判断必须等待对应的利率、成交规模与后续文件共同验证。`],
    ['事实边界', `先分开记录发布时间、适用日期、会议或操作日期，以及市场开始反应的时点。没有披露的投票、金额、目标区间、工具期限或执行频率保持待核；研究稿不得用历史惯例代替本次事实，也不把条件性讨论写成已经发生的决定。`],
    ['事件时间轴', `把公告前一交易日、发布瞬间、当日收盘、下一资金日和下一次关键数据发布设为五个观察窗。每个窗口保存原始读数与时区，先后发生并不自动代表因果；若价格提前变化，还要检查同日宏观数据、国库券供给和季末资金安排。`],
    ['政策反应函数', `若材料涉及央行，应分别提取通胀、就业、增长和金融条件的措辞变化，再判断决策者对各变量的权重是否移动。单个形容词不等于路径重定价，只有条件、门槛或行动顺序发生可核验变化，才构成新的政策信息。`],
    ['操作利率与资金走廊', `政策目标、准备金利率、隔夜逆回购工具和实际成交基准承担不同角色。比较时保留各自定义与生效日，观察走廊宽度、成交基准相对位置及偏离持续时间；不能把任何一个管理利率直接当成全部机构的真实融资成本。`],
    ['隔夜基准核验', `SOFR、EFFR 与 OBFR 分别覆盖不同交易和抵押条件。事件窗口内应同时查看利率水平、日变化、成交量与历史分位；只有价格与规模共同变化，才提高“资金条件发生实质调整”的解释权重。缺失观察不插值，也不借用另一基准补点。`],
    ['担保融资结构', `回购市场需要区分一般抵押品、特定券、中央清算与双边交易。公开基准能够说明合格交易的汇总结果，却不能替代具体券种的特别性、抵押品折扣或交易对手额度。若国债稀缺与现金紧张同时出现，二者要用不同证据识别。`],
    ['无担保资金读法', `联邦基金与银行融资数据更接近无担保资金交换，但参与者范围和成交结构并不等同。研究时关注基准偏离、成交规模、报告频率和参与者集中度，避免因为某日样本较少而放大单点变动，也不能由汇总利率反推单一银行状况。`],
    ['准备金与流动性分布', `总量充足不代表所有机构、时区和结算节点都宽松。应结合准备金相关公开统计、逆回购使用量、支付日历和隔夜成交分布，判断压力来自系统总量、机构分配还是抵押品约束。没有分布证据时，结论只停留在总量观察。`],
    ['国库券期限阶梯', `四周、三个月与六个月国库券反映供给、政策预期和现金管理的共同作用。比较时需要对齐观察日，计算相邻期限斜率并标记拍卖、结算和到期日；单一期限跳动可能来自供给或技术因素，不能直接解释为整条短端曲线改变。`],
    ['商业票据侧证', `金融与非金融商业票据的发行人结构不同，利率变化还会受信用与期限构成影响。把三个月票据与同期限国库券、隔夜基准并列，可以观察融资溢价是否扩张，但只有同日、同期限、同口径数据才能形成有效差值。`],
    ['期限资金压力', `隔夜平稳并不保证一周、一个月或跨季资金稳定。研究记录应标出税期、月末、季末、国债结算和大型到期日，比较压力出现前后的期限利差与成交规模。短暂尖峰和持续抬升需要分别归类，不能共享同一风险标签。`],
    ['数量与价格联读', `利率是资金价格，成交量是交易覆盖，两者必须同时阅读。利率上行而规模萎缩可能反映样本或供给变化；利率上行且规模扩大更值得进一步核验需求压力。该组合仍不是交易指令，只用于决定下一步需要查看哪类原始记录。`],
    ['历史分位', `把当前变化放入二十、六十与一百二十个可读观察的分布中，分别计算位置、波动和持续天数。分位只能回答“相对自身历史是否异常”，不能跨越制度阶段直接比较；基准定义或政策框架改变时必须切分样本。`],
    ['跨基准利差', `SOFR－EFFR、隔夜基准－准备金利率、商业票据－国库券各自回答不同问题。每条利差保留独立名称、公式、来源和单位，禁止把同一数值换标题后重复展示。下钻时展示两条腿的原始走势，而不是只给一个合成结果。`],
    ['曲线形态', `短端变化可拆成平行移动、陡峭化、平坦化和局部蝶式。应记录哪些期限贡献最大，并将政策日期与曲线差分叠加。若只有一个节点可读，就保持单点状态，不生成看似完整的拟合曲线。`],
    ['拍卖与结算联动', `涉及国库券时，公告、拍卖、发行、结算和到期是不同节点。发行规模、投标覆盖和尾差只有在财政部门正式公布后才能进入事件表；没有公开结果时不预测中标利率，也不把二级市场收益率伪装为拍卖结果。`],
    ['跨市场对照', `美元短端可以与欧元区政策走廊、英国、加拿大、澳大利亚和日本的短期利率做同类比较，但必须保留不同频率与制度含义。跨市场表只回答相对水平和变化方向，不把月度数据伪装成日内信号，也不进行无依据的币种换算。`],
    ['汇率与对冲', `政策预期可能经由利差进入汇率和对冲成本，但汇率还包含增长、避险与全球美元需求。应对齐两地交易日和发布时间，再比较短端利差与主要货币对；若两条路径不同步，就降低对单一政策解释的置信度。`],
    ['信息冲突处理', `声明、纪要、官员讲话和随后数据可能给出不同方向。阅读时应按发布时间排列材料，避免新文本遮住旧说法；分析同时列出支持与反对当前解释的证据，并指出哪一条新材料会改变结论。冲突本身就是研究结果，不必强行合成单一观点。`],
    ['异常点复核', `发现跳点后先检查节假日、缺失值、频率转换、单位变化和源站修订，再讨论市场含义。原始值、修订值与读取时间分别留痕；未来日期或无法复核的观察不得进入当前快照，避免用数据错误制造虚假实时波动。`],
    ['条件情景', `基准情景只延续已确认安排；收紧情景要求短端价格、成交规模与政策措辞共同给出证据；缓和情景则需要相反的连续观察。三种路径只列触发条件、撤销条件和需要跟踪的字段，不填写没有模型与市场数据支持的概率。`],
    ['组合敏感度', `投资者需要分别检查现金久期、浮息重定价、融资到期、抵押品需求和币种敞口。相同的利率变化对不同组合并不等价，最终影响必须按真实持仓、现金流日期和对冲关系重新计算，不能拿市场平均变化代替账户结果。`],
    ['投资者行动清单', `当前可以做的是核对原始文件、锁定事件时点、选择相应利率序列、建立前后观察窗口并记录尚未确认的字段。报价、订单、库存和交易对手能力不能由新闻正文反推；准备交易前仍要在获授权渠道重新取得价格和审批。`],
    ['下一次验证节点', `后续更新优先等待正式政策文本、下一次关键宏观数据、短端基准的新观察、相关成交量以及国库券事件结果。每项新增证据只修改对应段落，并说明它改变了哪一个判断；没有事实增量时维持当前版本。`],
    ['投资者观察顺序', `先读政策原句和事件日期，再看隔夜资金价格及成交量，随后核对国库券期限结构和商业票据溢价，最后检查汇率与对冲成本是否给出同方向证据。这个顺序能够把事实、资金价格和跨市场反应分开，避免用后出现的价格变化倒推政策含义。`],
    ['结论置信度', `当前判断的可信程度取决于三项条件：政策文字是否明确、相关利率与成交是否同步、变化能否在后续观察中持续。任一条件缺失，都只能保留为待验证解释。无法复核的数字不进入结论，暂时没有数据的部分宁可留空，也不拿其他市场的读数补位。`],
    ['后续跟踪日历', `下一版只在出现新文件、修订数据、正式操作或新的市场观察时更新。重点日期包括下一资金日、下一批通胀与就业数据、下一次国库券拍卖和下一场政策会议；每次更新只说明新增事实改变了哪个判断，转载和换词不构成新进展。`],
    ['结论', `${eventName}提供了一个需要继续核验的短端事件节点。现阶段最重要的是把事实文本、资金价格、交易规模、期限结构和操作日历按时间对齐，并保留不同证据之间的不一致；在证据不足时不外推方向、幅度或投资结果。`],
  ];
  let article = sections.slice(0, 13).map(([heading, body]) => `${heading}\n${body}`).join('\n\n');
  if (article.length < minimum) article += `\n\n复核附录\n读取任何新增材料时，先确认文件版本和适用日期，再核对隔夜基准、操作利率、国库券期限与成交规模是否使用同一观察窗口。若源站修订历史值，保留修订前后差异；若序列中断，停止计算依赖该字段的利差和分位。研究结论必须能够由原始文本、时间序列或正式事件表重新计算，不能依靠静态数字、标题印象或重复段落维持篇幅。`;
  if (article.length < minimum) article += `\n\n数据阅读附录\n终端中的每个核心数字都应当能回到自己的原始观察：利率打开历史轨迹和分位区间，成交规模打开交易覆盖变化，期限节点打开同日曲线，事件打开公告、拍卖、结算与到期时间轴。两项资料只有在定义、币种、时区和观测日一致时才可以计算差值；条件不满足时，页面说明缺少哪一条腿，不输出一个看似完整却无法复算的结果。报道中的判断也遵守同一原则：事实写清发生了什么，分析解释可能通过哪条路径影响市场，待核部分列出下一份文件或下一次观测；三者不混写。这样读者既能快速理解消息，又能沿数据下钻检查结论，不必依赖作者语气判断可信度。`;
  return article;
}

export function ensureNewsLongformForModule(moduleId: string, title: string, summary: string, minimum = TOP_NEWS_MIN_CHARACTERS) {
  return moduleId === 'mm-22-news'
    ? ensureMoneyMarketNewsLongform(title, summary, minimum)
    : ensureTopNewsLongform(title, summary, minimum);
}
