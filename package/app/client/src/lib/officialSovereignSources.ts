export type OfficialSourceLink = {
  label: string;
  institution: string;
  category: '债务与发行' | '财政与预算' | '央行政策与统计';
  url: string;
  coverage: string;
  accessNote: string;
};

export type CountryOfficialSources = {
  country: string;
  sources: OfficialSourceLink[];
};

const debt = (institution: string, label: string, url: string, coverage: string): OfficialSourceLink => ({ label, institution, category: '债务与发行', url, coverage, accessNote: '公开官方入口；请在使用前核对发布日期、文件版本与适用市场。' });
const fiscal = (institution: string, label: string, url: string, coverage: string): OfficialSourceLink => ({ label, institution, category: '财政与预算', url, coverage, accessNote: '公开官方入口；预算口径、覆盖范围和统计期需与研究记录一并保存。' });
const central = (institution: string, label: string, url: string, coverage: string): OfficialSourceLink => ({ label, institution, category: '央行政策与统计', url, coverage, accessNote: '公开官方入口；请区分政策发布日期、统计期、观察值与市场价格。' });

export const officialSovereignSources: Record<string, CountryOfficialSources> = {
  US: { country: '美国', sources: [
    debt('U.S. Treasury Fiscal Data', '国债拍卖数据', 'https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/', '拍卖公告、结果与证券字段'),
    fiscal('U.S. Treasury Fiscal Data', '月度公共债务报告', 'https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/', '联邦债务余额与结构'),
    central('Federal Reserve Board', '统计与政策资料', 'https://www.federalreserve.gov/data.htm', '政策、资产负债表与宏观统计'),
  ] },
  DE: { country: '德国', sources: [
    debt('Deutsche Finanzagentur', '联邦证券发行与拍卖', 'https://www.deutsche-finanzagentur.de/en/', '德国联邦证券、发行日历与债务管理资料'),
    fiscal('German Federal Ministry of Finance', '联邦财政与预算', 'https://www.bundesfinanzministerium.de/Web/EN/Home/home.html', '预算、财政政策与公共财政资料'),
    central('Deutsche Bundesbank', '统计与市场资料', 'https://www.bundesbank.de/en/statistics', '货币、金融与证券统计'),
  ] },
  JP: { country: '日本', sources: [
    debt('Ministry of Finance Japan', 'JGB 与债务管理资料', 'https://www.mof.go.jp/english/policy/jgbs/index.htm', '日本国债、发行与债务管理'),
    fiscal('Ministry of Finance Japan', '预算与财政资料', 'https://www.mof.go.jp/english/policy/budget/index.htm', '预算和财政政策文件'),
    central('Bank of Japan', '统计与货币政策', 'https://www.boj.or.jp/en/statistics/index.htm', '政策决定与统计数据'),
  ] },
  GB: { country: '英国', sources: [
    debt('UK Debt Management Office', '英国国债发行与统计', 'https://www.dmo.gov.uk/', 'Gilts、融资计划与拍卖资料'),
    fiscal('HM Treasury', '财政与预算文件', 'https://www.gov.uk/government/organisations/hm-treasury', '财政政策和预算文件'),
    central('Bank of England', '统计与货币政策', 'https://www.bankofengland.co.uk/statistics', '利率、市场与宏观统计'),
  ] },
  FR: { country: '法国', sources: [
    debt('Agence France Trésor', '法国国债与拍卖', 'https://www.aft.gouv.fr/en', '发行计划、拍卖与债务管理'),
    fiscal('French Ministry of Economy and Finance', '财政与预算资料', 'https://www.economie.gouv.fr/', '财政政策和公共财政文件'),
    central('Banque de France', '统计与货币资料', 'https://www.banque-france.fr/en/statistics', '金融与经济统计'),
  ] },
  IT: { country: '意大利', sources: [
    debt('Italian Ministry of Economy and Finance', '公共债务与发行资料', 'https://www.dt.mef.gov.it/en/debito_pubblico/', '国债发行、拍卖与债务信息'),
    fiscal('Italian Ministry of Economy and Finance', '财政资料', 'https://www.mef.gov.it/en/', '预算和公共财政资料'),
    central('Banca d’Italia', '统计与市场资料', 'https://www.bancaditalia.it/statistiche/index.html?com.dotmarketing.htmlpage.language=1', '金融统计与经济资料'),
  ] },
  ES: { country: '西班牙', sources: [
    debt('Tesoro Público', '国债与债券发行', 'https://www.tesoro.es/en', '发行、拍卖与公共债务资料'),
    fiscal('Ministry of Finance Spain', '财政资料', 'https://www.hacienda.gob.es/en-GB/Paginas/Home.aspx', '预算与公共财政资料'),
    central('Banco de España', '统计资料', 'https://www.bde.es/wbe/en/areas-actuacion/estadisticas/', '货币、金融与经济统计'),
  ] },
  CN: { country: '中国', sources: [
    debt('Ministry of Finance PRC', '国债与财政资料', 'https://www.mof.gov.cn/zhengwuxinxi/caizhengshuju/', '财政数据与国债相关披露'),
    fiscal('Ministry of Finance PRC', '财政部信息公开', 'https://www.mof.gov.cn/', '预算、财政收支与政策文件'),
    central('People’s Bank of China', '统计与货币政策', 'http://www.pbc.gov.cn/en/3688006/index.html', '货币政策和金融统计入口'),
  ] },
  BR: { country: '巴西', sources: [
    debt('Tesouro Nacional', '公共债务与国债资料', 'https://www.tesourotransparente.gov.br/', '联邦债务、融资与透明度数据'),
    fiscal('Brazilian National Treasury', '财政透明资料', 'https://www.tesourotransparente.gov.br/', '财政账户与公共财政信息'),
    central('Banco Central do Brasil', '统计资料', 'https://www.bcb.gov.br/en/statistics', '货币、外汇与金融统计'),
  ] },
  IN: { country: '印度', sources: [
    debt('Ministry of Finance India', '债务管理资料', 'https://dea.gov.in/debt-management', '政府债务管理与发行政策入口'),
    fiscal('Ministry of Finance India', '预算文件', 'https://www.indiabudget.gov.in/', '联邦预算与财政文件'),
    central('Reserve Bank of India', '统计资料', 'https://www.rbi.org.in/Scripts/Statistics.aspx', '货币、债券与外部部门统计'),
  ] },
  MX: { country: '墨西哥', sources: [
    debt('Secretaría de Hacienda y Crédito Público', '公共债务资料', 'https://www.finanzaspublicas.hacienda.gob.mx/en/Finanzas_Publicas/Public_Debt', '联邦公共债务与融资资料'),
    fiscal('Secretaría de Hacienda y Crédito Público', '公共财政资料', 'https://www.finanzaspublicas.hacienda.gob.mx/en/', '财政收入、支出与预算资料'),
    central('Banco de México', '统计数据系统', 'https://www.banxico.org.mx/SieInternet/', '利率、汇率和宏观金融统计'),
  ] },
  AU: { country: '澳大利亚', sources: [
    debt('Australian Office of Financial Management', '澳大利亚国债发行', 'https://www.aofm.gov.au/', '融资计划、债券和国库券资料'),
    fiscal('Australian Treasury', '预算与财政资料', 'https://treasury.gov.au/', '预算和财政政策文件'),
    central('Reserve Bank of Australia', '统计资料', 'https://www.rba.gov.au/statistics/', '利率、汇率和金融统计'),
  ] },
  CA: { country: '加拿大', sources: [
    debt('Department of Finance Canada', '公共债务资料', 'https://www.canada.ca/en/department-finance/services/public-debt.html', '联邦债务与债券资料'),
    fiscal('Department of Finance Canada', '预算与财政资料', 'https://www.canada.ca/en/department-finance.html', '预算和财政文件'),
    central('Bank of Canada', '利率与市场资料', 'https://www.bankofcanada.ca/rates/', '利率、汇率与金融市场统计'),
  ] },
  KR: { country: '韩国', sources: [
    debt('Ministry of Economy and Finance Korea', '财政与债务资料', 'https://english.moef.go.kr/', '国债、财政和宏观政策入口'),
    fiscal('Ministry of Economy and Finance Korea', '财政资料', 'https://english.moef.go.kr/', '预算、财政政策和统计入口'),
    central('Bank of Korea', '统计与货币政策', 'https://www.bok.or.kr/eng/main/contents.do?menuNo=400057', '经济统计与货币政策资料'),
  ] },
};
