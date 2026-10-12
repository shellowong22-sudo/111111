// CRVF 查找曲线 — 完整数据定义
// 精确复刻文档截图 image228-image337

export interface CrvfCurve {
  num: number;
  name: string;
  id: string;
}

export interface CrvfRegion {
  num: number;
  name: string;
  countries?: CrvfCountry[];
  curves?: CrvfCurve[];
}

export interface CrvfCountry {
  num: number;
  name: string;
  curves: CrvfCurve[];
}

// ─── 国家/地区标签（11）— 全部 ─────────────────────────────────────────────────
// 全部 > 全部 的曲线列表（image228，1260条，截取前30条）
export const ALL_ALL_CURVES: CrvfCurve[] = [
  { num: 161, name: '美国国债活跃券曲线', id: 'I25' },
  { num: 162, name: '美元SOFR(vs固定利率)', id: 'S490' },
  { num: 163, name: '欧元（vs.6个月EURIBOR）', id: 'S45,I68,I...' },
  { num: 164, name: '欧元德国国债曲线', id: 'I16' },
  { num: 165, name: 'CAD Canadian Treasury Benchmarks Curve', id: 'I813' },
  { num: 166, name: '日元日本国债曲线', id: 'I18' },
  { num: 167, name: 'GBP英国主权债曲线', id: 'I22' },
  { num: 168, name: '美元（30/360, 半年度 vs 3个月LIBOR）', id: 'S23,I52' },
  { num: 169, name: 'EUR OIS ESTR', id: 'S514' },
  { num: 170, name: '英镑隔夜指数掉期', id: 'S141,I525' },
  { num: 171, name: '美元OIS', id: 'S42' },
  { num: 172, name: 'BM&F 定息-浮息掉期', id: 'S89,I392,...' },
  { num: 173, name: 'CAD加拿大主权债曲线', id: 'I7' },
  { num: 174, name: '欧元法国国债曲线', id: 'I14' },
  { num: 175, name: '欧元意大利国债曲线', id: 'I40' },
  { num: 176, name: '日元OIS', id: 'S195' },
  { num: 177, name: 'IDR印尼主权债曲线', id: 'I266' },
  { num: 178, name: '欧元（vs 3个月EURIBOR）', id: 'S201' },
  { num: 179, name: '墨西哥比索墨西哥国债曲线', id: 'I251' },
  { num: 180, name: 'TRY OIS', id: 'S522' },
  { num: 181, name: '瑞士法郎隔夜指数掉期', id: 'S234' },
  { num: 182, name: '美国通胀挂钩国债曲线', id: 'I169' },
  { num: 183, name: '加元隔夜指数掉期', id: 'S147' },
  { num: 184, name: '欧元德国国债BUND BVAL收益率曲线', id: 'BI554,F9...' },
  { num: 185, name: '美国最新/非最新发行国债曲线', id: 'I111' },
  { num: 186, name: '美国国债BVAL曲线', id: 'BI550,F82' },
  { num: 187, name: 'US SOFR Swap Spreads Curve', id: 'I806' },
  { num: 188, name: '美元美国短期和中长期国债 BVAL收益率曲线', id: 'BS484' },
  { num: 189, name: '日元vs美元基差', id: 'S97' },
  { num: 190, name: '日元（vs 6个月Libor）', id: 'S13,I56' },
];

// ─── G7 国家列表 ───────────────────────────────────────────────────────────────
export const G7_COUNTRIES: CrvfCountry[] = [
  {
    num: 62, name: '加拿大',
    curves: [
      { num: 161, name: '美国国债活跃券曲线', id: 'I25' },
      { num: 162, name: '美元SOFR(vs固定利率)', id: 'S490' },
      { num: 163, name: '欧元德国国债曲线', id: 'I16' },
      { num: 164, name: 'CAD Canadian Treasury Benchmarks Curve', id: 'I813' },
      { num: 165, name: '日元日本国债曲线', id: 'I18' },
      { num: 166, name: 'GBP英国主权债曲线', id: 'I22' },
      { num: 167, name: '美元（30/360, 半年度 vs 3个月LIBOR）', id: 'S23,I52' },
      { num: 168, name: '英镑隔夜指数掉期', id: 'S141,I525' },
      { num: 169, name: '美元OIS', id: 'S42' },
      { num: 170, name: 'CAD加拿大主权债曲线', id: 'I7' },
      { num: 171, name: '欧元法国国债曲线', id: 'I14' },
      { num: 172, name: '欧元意大利国债曲线', id: 'I40' },
      { num: 173, name: '日元OIS', id: 'S195' },
      { num: 174, name: '美国通胀挂钩国债曲线', id: 'I169' },
      { num: 175, name: '加元隔夜指数掉期', id: 'S147' },
      { num: 176, name: '欧元德国国债BUND BVAL收益率曲线', id: 'BI554,F9...' },
      { num: 177, name: '美国最新/非最新发行国债曲线', id: 'I111' },
      { num: 178, name: '美国国债BVAL曲线', id: 'BI550,F82' },
      { num: 179, name: 'US SOFR Swap Spreads Curve', id: 'I806' },
      { num: 180, name: '美元美国短期和中长期国债 BVAL收益率曲线', id: 'BS484' },
      { num: 181, name: '日元vs美元基差', id: 'S97' },
      { num: 182, name: '日元（vs 6个月Libor）', id: 'S13,I56' },
      { num: 183, name: '英镑（vs 6个月Libor）', id: 'S22,I55' },
    ],
  },
  {
    num: 63, name: '法国',
    curves: [
      { num: 161, name: '欧元法国国债曲线', id: 'I14' },
      { num: 162, name: '欧元德国国债曲线', id: 'I16' },
      { num: 163, name: '欧元（vs.6个月EURIBOR）', id: 'S45,I68' },
      { num: 164, name: 'EUR OIS ESTR', id: 'S514' },
      { num: 165, name: '欧元意大利国债曲线', id: 'I40' },
      { num: 166, name: '欧元OIS', id: 'S133,I295' },
      { num: 167, name: '欧元基准曲线', id: 'I13' },
      { num: 168, name: '欧元（vs 3个月EURIBOR）', id: 'S201' },
      { num: 169, name: '欧元德国国债BUND BVAL收益率曲线', id: 'BI554,F9...' },
      { num: 170, name: 'EUR European Union Issuance Curve', id: 'I800' },
    ],
  },
  {
    num: 64, name: '德国',
    curves: [
      { num: 161, name: '欧元德国国债曲线', id: 'I16' },
      { num: 162, name: 'EUR OIS ESTR', id: 'S514' },
      { num: 163, name: '欧元（vs.6个月EURIBOR）', id: 'S45,I68' },
      { num: 164, name: '欧元法国国债曲线', id: 'I14' },
      { num: 165, name: '欧元意大利国债曲线', id: 'I40' },
      { num: 166, name: '欧元基准曲线', id: 'I13' },
      { num: 167, name: '欧元德国国债BUND BVAL收益率曲线', id: 'BI554,F9...' },
      { num: 168, name: 'EUR European Union Issuance Curve', id: 'I800' },
    ],
  },
  {
    num: 65, name: '意大利',
    curves: [
      { num: 161, name: '欧元意大利国债曲线', id: 'I40' },
      { num: 162, name: '欧元德国国债曲线', id: 'I16' },
      { num: 163, name: 'EUR OIS ESTR', id: 'S514' },
      { num: 164, name: '欧元法国国债曲线', id: 'I14' },
      { num: 165, name: '欧元基准曲线', id: 'I13' },
    ],
  },
  {
    num: 66, name: '日本',
    curves: [
      { num: 161, name: '日元日本国债曲线', id: 'I18' },
      { num: 162, name: '日元OIS', id: 'S195' },
      { num: 163, name: '日元vs美元基差', id: 'S97' },
      { num: 164, name: '日元（vs 6个月Libor）', id: 'S13,I56' },
      { num: 165, name: 'IDR印尼主权债曲线', id: 'I266' },
    ],
  },
  {
    num: 67, name: '英国',
    curves: [
      { num: 161, name: 'GBP英国主权债曲线', id: 'I22' },
      { num: 162, name: '英镑隔夜指数掉期', id: 'S141,I525' },
      { num: 163, name: '英镑（vs 6个月Libor）', id: 'S22,I55' },
      { num: 164, name: '英镑英国金边债券BVAL曲线', id: 'BI590,F1...' },
      { num: 165, name: '英镑英国短期和中长期债券 BVAL收益率曲线', id: 'BS267' },
    ],
  },
  {
    num: 68, name: '美国',
    curves: [
      { num: 161, name: '美国国债活跃券曲线', id: 'I25' },
      { num: 162, name: '美元SOFR(vs固定利率)', id: 'S490' },
      { num: 163, name: '美元OIS', id: 'S42' },
      { num: 164, name: '美元（30/360, 半年度 vs 3个月LIBOR）', id: 'S23,I52' },
      { num: 165, name: '美国通胀挂钩国债曲线', id: 'I169' },
      { num: 166, name: '美国最新/非最新发行国债曲线', id: 'I111' },
      { num: 167, name: '美国国债BVAL曲线', id: 'BI550,F82' },
      { num: 168, name: 'US SOFR Swap Spreads Curve', id: 'I806' },
      { num: 169, name: '美元美国短期和中长期国债 BVAL收益率曲线', id: 'BS484' },
    ],
  },
];

// ─── 欧盟国家列表 ──────────────────────────────────────────────────────────────
export const EU_COUNTRIES: CrvfCountry[] = [
  { num: 62, name: '奥地利', curves: [{ num: 161, name: '欧元（vs.6个月EURIBOR）', id: 'S45,I68,I...' }, { num: 162, name: '欧元德国国债曲线', id: 'I16' }, { num: 163, name: 'GBP英国主权债曲线', id: 'I22' }, { num: 164, name: 'EUR OIS ESTR', id: 'S514' }, { num: 165, name: '英镑隔夜指数掉期', id: 'S141,I525' }] },
  { num: 63, name: '比利时', curves: [{ num: 161, name: '欧元德国国债曲线', id: 'I16' }, { num: 162, name: 'EUR OIS ESTR', id: 'S514' }, { num: 163, name: '欧元法国国债曲线', id: 'I14' }] },
  { num: 64, name: '保加利亚', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 65, name: '克罗地亚', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 66, name: '塞浦路斯', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 67, name: '捷克', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 68, name: '丹麦', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 69, name: '欧盟', curves: [{ num: 161, name: 'EUR European Union Issuance Curve', id: 'I800' }, { num: 162, name: '欧元基准曲线', id: 'I13' }] },
  { num: 70, name: '芬兰', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 71, name: '法国', curves: [{ num: 161, name: '欧元法国国债曲线', id: 'I14' }, { num: 162, name: '欧元德国国债曲线', id: 'I16' }] },
  { num: 72, name: '德国', curves: [{ num: 161, name: '欧元德国国债曲线', id: 'I16' }, { num: 162, name: '欧元德国国债BUND BVAL收益率曲线', id: 'BI554,F9...' }] },
  { num: 73, name: '希腊', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 74, name: '匈牙利', curves: [{ num: 161, name: '匈牙利福林匈牙利国债曲线', id: 'I165' }] },
  { num: 75, name: '爱尔兰', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 76, name: '意大利', curves: [{ num: 161, name: '欧元意大利国债曲线', id: 'I40' }] },
  { num: 77, name: '拉脱维亚', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 78, name: '立陶宛', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 79, name: '卢森堡', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 80, name: '马耳他', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 81, name: '荷兰', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 82, name: '波兰', curves: [{ num: 161, name: '波兰兹罗提波兰国债曲线', id: 'I177' }] },
  { num: 83, name: '葡萄牙', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
  { num: 84, name: '罗马尼亚', curves: [{ num: 161, name: 'RON罗马尼亚国债曲线', id: 'I508' }] },
  { num: 85, name: '斯洛伐克', curves: [{ num: 161, name: '欧元基准曲线', id: 'I13' }] },
];

// ─── 一级地区列表（国家/地区标签左列）─────────────────────────────────────────
export const REGION_LIST = [
  { num: 41, name: '全部' },
  { num: 42, name: 'G7' },
  { num: 43, name: '欧盟' },
  { num: 44, name: '非洲' },
  { num: 45, name: '亚太地区' },
  { num: 46, name: '东欧' },
  { num: 47, name: '拉丁美洲' },
  { num: 48, name: '中东' },
  { num: 49, name: '西欧' },
];

// ─── 货币市场标签（13）─────────────────────────────────────────────────────────
// 货币市场 > G7 > 加拿大 (image260)
export const MM_G7_CANADA: CrvfCurve[] = [
  { num: 161, name: '加元OIS货币市场曲线', id: 'MM215' },
  { num: 162, name: 'CAD短期国债曲线', id: 'MM29' },
  { num: 163, name: 'CAD BA曲线', id: 'MM66' },
  { num: 164, name: 'CAD FXBIS贴现率曲线', id: 'MM80' },
  { num: 165, name: 'CAD FXBIS付息曲线', id: 'MM89' },
  { num: 166, name: 'CAD CP曲线', id: 'MM165' },
  { num: 167, name: 'CAD BOC短期国债曲线', id: 'MM166' },
  { num: 168, name: '加元定期存单曲线', id: 'MM235' },
];

export const MM_G7_COUNTRIES: CrvfCountry[] = [
  { num: 62, name: '加拿大', curves: MM_G7_CANADA },
  {
    num: 63, name: '法国', curves: [
      { num: 161, name: 'EUR ESTR OIS货币市场曲线', id: 'MM210' },
      { num: 162, name: 'EUR EURIBOR货币市场曲线', id: 'MM211' },
      { num: 163, name: 'EUR T-Bill曲线', id: 'MM212' },
    ],
  },
  {
    num: 64, name: '德国', curves: [
      { num: 161, name: 'EUR ESTR OIS货币市场曲线', id: 'MM210' },
      { num: 162, name: 'EUR EURIBOR货币市场曲线', id: 'MM211' },
    ],
  },
  {
    num: 65, name: '意大利', curves: [
      { num: 161, name: 'EUR ESTR OIS货币市场曲线', id: 'MM210' },
    ],
  },
  {
    num: 66, name: '日本', curves: [
      { num: 161, name: 'JPY TONA OIS货币市场曲线', id: 'MM220' },
      { num: 162, name: 'JPY TIBOR货币市场曲线', id: 'MM221' },
      { num: 163, name: 'JPY T-Bill曲线', id: 'MM222' },
    ],
  },
  {
    num: 67, name: '英国', curves: [
      { num: 161, name: 'GBP SONIA OIS货币市场曲线', id: 'MM230' },
      { num: 162, name: 'GBP LIBOR货币市场曲线', id: 'MM231' },
    ],
  },
  {
    num: 68, name: '美国', curves: [
      { num: 161, name: 'USD SOFR OIS货币市场曲线', id: 'MM200' },
      { num: 162, name: 'USD LIBOR货币市场曲线', id: 'MM201' },
      { num: 163, name: 'USD T-Bill曲线', id: 'MM202' },
      { num: 164, name: 'USD CP曲线', id: 'MM203' },
      { num: 165, name: 'USD BA曲线', id: 'MM204' },
    ],
  },
];

// ─── 地方债与地区债标签（14）─────────────────────────────────────────────────
// 地方债 > 美国 (image279)
export const MUNI_US_SUBTYPES = [
  { num: 62, name: '全部' },
  { num: 63, name: '合成一般责任债券' },
  { num: 64, name: '特定州' },
  { num: 65, name: '合成收入' },
  { num: 66, name: '替代性最低税收' },
  { num: 67, name: '纳税债' },
  { num: 68, name: '银行免税' },
];

export const MUNI_US_ALL_CURVES: CrvfCurve[] = [
  { num: 163, name: 'BVAL地方债AAA曲线（可赎回）', id: 'BS1211' },
  { num: 164, name: '美国应税GO AAA地方债BVAL收益率曲线新', id: 'BS1299' },
  { num: 165, name: '美国加利福尼亚州地方债BVAL收益率曲线', id: 'BI9000' },
  { num: 166, name: '美国一般责任债券BBB地方债BVAL收益率曲线新', id: 'BS1252' },
  { num: 167, name: '美国一般责任债券A+ A A-地方债BVAL收益率曲线新', id: 'BS1215' },
  { num: 168, name: '美国应税GO A+ A A-地方债BVAL收益率曲线...', id: 'BS1300' },
  { num: 169, name: '美国应税GO BBB+ BBB BBB-地方债BVAL收益率...', id: 'BS1299' },
  { num: 170, name: '美国纽约市地方债BVAL收益率曲线', id: 'BI9001' },
  { num: 171, name: '美国德克萨斯州地方债BVAL收益率曲线', id: 'BI9002' },
  { num: 172, name: '美国应税GO A+ A A-地方债BVAL收益率曲线新', id: 'BS1297' },
  { num: 173, name: '美国加州一般责任债券AA级地方债BVAL收益率曲线', id: 'BS1221' },
  { num: 174, name: '美国收入AAA地方债BVAL收益率曲线新', id: 'BS1320' },
  { num: 175, name: '美国一般责任债券AA+地方债BVAL收益率曲线新', id: 'BS1207' },
  { num: 176, name: '美国应税收入AA AA AA-地方债BVAL收益率曲线新', id: 'BS1296' },
  { num: 177, name: 'MMA曲线', id: 'I311' },
  { num: 178, name: '美元（vs 7天SIFMA地方债）', id: 'S43' },
  { num: 179, name: '美国新泽西州地方债BVAL收益率曲线', id: 'BI9006' },
  { num: 180, name: '美国马里兰州地方债BVAL收益率曲线', id: 'BI9014' },
  { num: 181, name: '美国阿尼苏达州地方债BVAL收益率曲线', id: 'BI9017' },
  { num: 182, name: '美国收入A地方债BVAL收益率曲线新', id: 'BS1208' },
  { num: 183, name: '美国北卡罗来纳州地方债BVAL收益率曲线', id: 'BI9018' },
  { num: 184, name: '美国路易斯安那州地方债BVAL收益率曲线', id: 'BI9157' },
  { num: 185, name: '美国收入AA地方债BVAL收益率曲线新', id: 'BS1271' },
  { num: 186, name: '美国医院BBB+地方债BVAL收益率曲线新', id: 'BS1278' },
  { num: 187, name: '美国供水/污水AA+地方债BVAL收益率曲线新', id: 'BS1305' },
  { num: 188, name: '美国供水/污水AA-地方债BVAL收益率曲线新', id: 'BS1307' },
  { num: 189, name: '美国高等教育AA+地方债BVAL收益率曲线', id: 'BS1323' },
  { num: 190, name: '美国收入AA+地方债BVAL收益率曲线', id: 'BS1326' },
  { num: 191, name: '美国德州PSF地方债BVAL收益率曲线', id: 'BS1331' },
  { num: 192, name: '美国机场AA-地方债BVAL收益率曲线', id: 'BS1338' },
  { num: 193, name: 'US General Obligation AA+ AA AA- Muni BVAL Yi...', id: 'BS1357' },
  { num: 194, name: '美国应税收入AAA地方债BVAL收益率曲线新', id: 'BS1298' },
  { num: 195, name: '美国高等教育AAA地方债BVAL收益率曲线新', id: 'BS1269' },
  { num: 196, name: '美国医院BBB-地方债BVAL收益率曲线新', id: 'BS1277' },
  { num: 197, name: '美国供水/污水AAA地方债BVAL收益率曲线新', id: 'BS1283' },
  { num: 198, name: '美国提前再融资地方债BVAL收益率曲线', id: 'BS1293' },
];

export const MUNI_REGIONS = [
  { num: 41, name: '全部' },
  { num: 42, name: '美国' },
  { num: 43, name: '加拿大' },
];

// ─── 外汇标签（15）─────────────────────────────────────────────────────────────
// 外汇 > G7 > 全部 (image289)
export const FX_G7_ALL_CURVES: CrvfCurve[] = [
  { num: 161, name: 'USDJPY远期点数', id: 'FXUSJY01' },
  { num: 162, name: 'GBPUSD远期点数', id: 'FXBPUS01' },
  { num: 163, name: 'USDCAD远期点数', id: 'FXUSCD01' },
  { num: 164, name: 'USDUSD存款', id: 'FXUSUS22' },
  { num: 165, name: 'USDJPY At The Money Option Volatility', id: 'FXUSJY16' },
  { num: 166, name: 'USDJPY远期引伸收益率', id: 'FXUSJY04' },
  { num: 167, name: 'GBPUSD远期引伸收益率', id: 'FXBPUS04' },
  { num: 168, name: 'GBPEUR Forward Points', id: 'FXBPEU01' },
  { num: 169, name: 'USDJPY 25 Delta Risk Reversal Option Volatility', id: 'FXUSJY17' },
  { num: 170, name: 'USDCAD At The Money Option Volatility', id: 'FXUSCD16' },
  { num: 171, name: 'GBPUSD 25 Delta Risk Reversal Option Volatility', id: 'FXBPUS17' },
  { num: 172, name: 'JPYEUR Forward Points', id: 'FXJYEU01' },
  { num: 173, name: 'GBPUSD At The Money Option Volatility', id: 'FXBPUS16' },
  { num: 174, name: 'CADJPY Forward Points', id: 'FXCDJY01' },
  { num: 175, name: 'GBPEGP无本金交割远期点数', id: 'FXBPEP05' },
  { num: 176, name: 'USDJPY远期直接', id: 'FXUSJY02' },
  { num: 177, name: 'USDJPY 25 Delta Butterfly Option Volatility', id: 'FXUSJY18' },
  { num: 178, name: 'GBPKRW Non-Deliverable Forward Points', id: 'FXBPKW05' },
  { num: 179, name: 'GBPJPY Forward Points', id: 'FXBPJY01' },
  { num: 180, name: 'JPYIDR Onshore Forward Points', id: 'FXJYIH08' },
  { num: 181, name: 'GBPSGD Forward Points', id: 'FXBPSD01' },
  { num: 182, name: 'GBPZAR Forward Points', id: 'FXBPSA01' },
  { num: 183, name: 'USDCAD 25 Delta Risk Reversal Option Volatility', id: 'FXUSCD17' },
  { num: 184, name: 'CADMYR Onshore远期点数', id: 'FXCDMR08' },
  { num: 185, name: 'CADKRW Realized Kurtosis', id: 'FXCDKW14' },
  { num: 186, name: 'CADKRW GARCH Volatility', id: 'FXCDKW15' },
  { num: 187, name: 'CADMAD Forward Points', id: 'FXCDMD01' },
  { num: 188, name: 'CADMXN Forward Points', id: 'FXCDMP01' },
  { num: 189, name: 'CADMXN Historical Volatility', id: 'FXCDMP12' },
  { num: 190, name: 'CADMXN Realized Skewness', id: 'FXCDMP13' },
];

export const FX_G7_COUNTRIES: CrvfCountry[] = [
  { num: 62, name: '加拿大', curves: FX_G7_ALL_CURVES.slice(0, 15) },
  { num: 63, name: '法国', curves: FX_G7_ALL_CURVES.slice(0, 10) },
  { num: 64, name: '德国', curves: FX_G7_ALL_CURVES.slice(0, 10) },
  { num: 65, name: '意大利', curves: FX_G7_ALL_CURVES.slice(0, 8) },
  { num: 66, name: '日本', curves: FX_G7_ALL_CURVES.slice(0, 12) },
  { num: 67, name: '英国', curves: FX_G7_ALL_CURVES.slice(0, 20) },
  { num: 68, name: '美国', curves: FX_G7_ALL_CURVES },
];

// ─── 信用标签（12）次级标签 ────────────────────────────────────────────────────
export const CREDIT_SUB_TABS = [
  { id: '17', name: '发行人' },
  { id: '18', name: '分栏' },
  { id: '19', name: 'CDS' },
  { id: '20', name: 'CDS指数' },
];

// 信用 > 分栏 左列（行业分类）
export const CREDIT_SECTORS = [
  { num: 41, name: '全部' },
  { num: 42, name: '通讯业' },
  { num: 43, name: '非必需消费品' },
  { num: 44, name: '必需消费品' },
  { num: 45, name: '能源' },
  { num: 46, name: '金融' },
  { num: 47, name: '国债与机构债' },
  { num: 48, name: '保健' },
  { num: 49, name: '工业' },
  { num: 50, name: '材料' },
  { num: 51, name: '科技' },
  { num: 52, name: '公用事业' },
];

// 信用 > 分栏 中列（评级）
export const CREDIT_RATINGS = [
  { num: 61, name: '全部' },
  { num: 62, name: 'AAA' },
  { num: 63, name: 'AA' },
  { num: 64, name: 'A' },
  { num: 65, name: 'BBB' },
  { num: 66, name: 'BB' },
  { num: 67, name: 'B' },
  { num: 68, name: 'IG' },
];

// 信用 > 分栏 右列曲线（image238，595条）
export const CREDIT_SECTOR_CURVES: CrvfCurve[] = [
  { num: 161, name: '美元美国公司债BBB+、BBB、BBB- BVAL收益率曲...', id: 'BS75,F883' },
  { num: 162, name: '美元美国公司债A+、A、A- BVAL收益率曲线', id: 'BS74,F882' },
  { num: 163, name: '美元美国公司债AA+、AA、AA- BVAL收益率曲线', id: 'BS73' },
  { num: 164, name: '美元美国公司债投资级 BVAL收益率曲线', id: 'BS76' },
  { num: 165, name: '美元美国公司债BB+、BB、BB- BVAL收益率曲线', id: 'BS193,F8...' },
  { num: 166, name: '欧元欧洲公司债综合评级BBB+、BBB、BBB- BVAL...', id: 'BS166,F6...' },
  { num: 167, name: '欧元欧洲公司债投资级 BVAL收益率曲线', id: 'BS78' },
  { num: 168, name: '日元日本国债BVAL曲线', id: 'BS503' },
  { num: 169, name: '欧元欧洲公司债A+、A、A- BVAL收益率曲线', id: 'BS77,F670' },
  { num: 170, name: '美元美国公司债B+、B、B- BVAL收益率曲线', id: 'BS195' },
  { num: 171, name: '欧元欧盟工业BB+、BB、BB-级BVAL收益率曲线', id: 'BS627' },
  { num: 172, name: '美元美国金融公司债A+、A、A- BVAL收益率曲线', id: 'BS38,F26...' },
  { num: 173, name: '美元美国综合AAA BVAL收益率曲线', id: 'BS559' },
  { num: 174, name: '美元美国金融公司债BBB+、BBB、BBB- BVAL收益...', id: 'BS39,F28' },
  { num: 175, name: '欧元欧洲金融公司债A+、A、A- BVAL收益率曲线', id: 'BS15,F642' },
  { num: 176, name: '美元美国综合BBB BVAL收益率曲线', id: 'BS567' },
  { num: 177, name: '美元美国科技公司债A+、A、A- BVAL收益率曲线', id: 'BS43' },
  { num: 178, name: '欧元欧洲金融公司债BBB+、BBB、BBB- BVAL收益...', id: 'BS16,F644' },
  { num: 179, name: '欧元欧洲公司债AA+、AA、AA- BVAL收益率曲线', id: 'BS165,F6...' },
  { num: 180, name: '欧元欧洲非金融公司债BBB+、BBB、BBB- BVAL收...', id: 'BS232' },
  { num: 181, name: '美元美国通信公司债BB BVAL收益率曲线', id: 'BS427' },
  { num: 182, name: '加元加拿大公司债BBB+、BBB、BBB- BVAL收益率...', id: 'BS169,F2...' },
];

// ─── 自设曲线标签（16）─────────────────────────────────────────────────────────
export const CUSTOM_SUB_TABS = [
  { id: '19', name: '用户' },
  { id: '20', name: '公司' },
];

export const CUSTOM_TYPE_OPTIONS = [
  { value: '0', label: '全部' },
  { value: '1', label: '地方债' },
  { value: '2', label: '主权债/机构债' },
  { value: '3', label: '信用/CDS' },
  { value: '4', label: '信用/公司债' },
  { value: '5', label: '外汇' },
  { value: '6', label: '利率掉期' },
  { value: '7', label: '货币市场' },
];

// ─── 已选曲线条目 ──────────────────────────────────────────────────────────────
export interface SelectedCurve {
  num: number;
  name: string;
  country: string;
  currency: string;
  type: string;
  id: string;
}

// 文档中 image237/image238/image310 底部"选定的曲线"示例数据
export const DEMO_SELECTED_CURVES: SelectedCurve[] = [
  { num: 21, name: '美元Oekb OestKontrollbank BVAL曲线', country: 'AT', currency: 'USD', type: 'Credit/Corp', id: 'BI1136' },
  { num: 22, name: '瑞士法郎Municipality Finance公司BVAL曲线', country: 'FI', currency: 'CHF', type: 'Agency', id: 'BI754' },
];

// ─── GC 绘制曲线图数据 ─────────────────────────────────────────────────────────
// image237 中的示例曲线数据
export interface GcCurvePoint {
  tenor: string;
  value: number;
}

export interface GcCurveSeries {
  id: string;
  name: string;
  color: string;
  data: GcCurvePoint[];
}

export const GC_DEMO_CURVES: GcCurveSeries[] = [
  {
    id: 'BI1136',
    name: 'BI1136 美元OEKB OESTKONTROLLBANK BVAL曲线 最新 买价收益',
    color: '#4ade80',
    data: [
      { tenor: '3M', value: 3.92 },
      { tenor: '1Y', value: 4.12 },
      { tenor: '3Y', value: 4.38 },
      { tenor: '5Y', value: 4.62 },
      { tenor: '7Y', value: 4.88 },
      { tenor: '9Y', value: 5.02 },
      { tenor: '15Y', value: 5.18 },
      { tenor: '20Y', value: 5.28 },
      { tenor: '25Y', value: 5.32 },
      { tenor: '30Y', value: 5.30 },
    ],
  },
  {
    id: 'BI754',
    name: 'BI754 瑞士法郎MUNICIPALITY FINANCE公司BVAL曲线 最新 买价收益',
    color: '#60a5fa',
    data: [
      { tenor: '3M', value: 0.22 },
      { tenor: '1Y', value: 0.45 },
      { tenor: '3Y', value: 0.68 },
      { tenor: '5Y', value: 0.85 },
      { tenor: '7Y', value: 0.95 },
      { tenor: '9Y', value: 1.02 },
      { tenor: '15Y', value: 1.08 },
      { tenor: '20Y', value: 1.12 },
      { tenor: '25Y', value: 1.18 },
      { tenor: '30Y', value: 1.22 },
    ],
  },
];

// GC 利差数据（下半图）
export const GC_DEMO_SPREAD: GcCurvePoint[] = [
  { tenor: '3M', value: -370 },
  { tenor: '1Y', value: -367 },
  { tenor: '3Y', value: -370 },
  { tenor: '5Y', value: -377 },
  { tenor: '7Y', value: -393 },
  { tenor: '9Y', value: -400 },
  { tenor: '15Y', value: -410 },
  { tenor: '20Y', value: -416 },
  { tenor: '25Y', value: -414 },
  { tenor: '30Y', value: -408 },
];

// GC 相关功能目录
export const GC_RELATED_FUNCTIONS = [
  'GC 绘制曲线图',
  'FWCV 远期曲线分析',
  'ICVS 掉期曲线建立',
  'CRVF 查找曲线',
];

// GC 基准曲线选项
export const GC_BENCHMARK_OPTIONS = [
  { value: 'BI1136', label: 'BI1136 买价收益' },
  { value: 'BI754', label: 'BI754 买价收益' },
  { value: 'I25', label: 'I25 美国国债活跃券' },
  { value: 'S490', label: 'S490 美元SOFR' },
];
