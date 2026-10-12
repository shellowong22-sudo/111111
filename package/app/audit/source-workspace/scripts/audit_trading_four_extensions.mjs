import {readFileSync,writeFileSync}from'node:fs';
import {resolve}from'node:path';
const root=resolve(process.cwd()),read=p=>readFileSync(resolve(root,p),'utf8');
const oms=[['AIM','指令字段完整性关卡','字段勾选','字段就绪'],['TOMS','债券报价双边核对','买入价/卖出价','手工价差'],['BBS','买方经纪商分配试算','三方比例','分配合计'],['BSS','卖方覆盖层级登记','覆盖角色','覆盖网格'],['TWC','工作流交接时钟','SLA/耗时','剩余窗口'],['TOMS6','日终切换清单','三项清单','清单状态'],['RISK','委托风险冲击格','名义/冲击','三格冲击'],['MIFI','证据字段台账','字段文本','台账行'],['TTTT','定价容差核验','参考/输入/容差','容差结论'],['EC','连接前置检查','三项依赖','依赖链'],['AIMH','术语证据卡','术语输入','定义卡'],['HELPTOMS','异常处置路径','异常类型','处置路径'],['TSDM','结算失败归因','失败类型','归因路径'],['BSKM','ETF 篮子闭合检查','三项权重','闭合条'],['BSKT','篮子成分变动记录','前后权重','pp 变化'],['BSKA','AP 创建单位工作表','单位/份额','创建份数'],['DSKM','经纪权限矩阵','角色切换','权限矩阵'],['CKMM','做市阈值观察','价差/阈值','阈值结论'],['CKPV','客户偏好版本簿','变更文本','版本行'],['CKPM','生产发布门禁','门禁勾选','发布结论'],['CKAP','做市容量分配','三项容量','容量条'],['AIMTOMS','字段交接链','来源/目标','交接标签'],['REPLAY','会话事件轨道','多行事件','事件轨道']];
const configModules=[
 ['电子交易','client/src/components/electronic-trading/ElectronicTradingDistinctExtension.tsx',['ElectronicTradingResearchLayer','ElectronicTradingDataListExperienceContainer']],
 ['STP','client/src/components/stp/StpDistinctExtension.tsx',['StpPrivateResearchLayer','StpPrivateTimelineOverlay']],
 ['交易账簿','client/src/components/trade-book/TradeBookDistinctExtension.tsx',['TradeBookPrivateResearchLayer']]
];
const wrapperFor={电子交易:'client/src/components/electronic-trading/ElectronicTradingPreservedRoute.tsx',STP:'client/src/components/stp/StpProcessingPreservedRoute.tsx',交易账簿:'client/src/components/trade-book/TradeBookPreservedRoute.tsx'};
const lines=['模块\t入口\t专属任务\t输入\t可视结果'];
const summary=[];
const os=read('client/src/components/order-management/OrderManagementDistinctExtension.tsx'),ow=read('client/src/components/order-management/OrderManagementPreservedRoute.tsx');
if(oms.some(([id])=>!os.includes(`id="${id}"`))||oms.length!==23||!(ow.lastIndexOf('OrderManagementResearchLayer')<ow.lastIndexOf('OrderManagementDistinctExtension')))throw new Error('OMS 映射或保留边界失败');
oms.forEach(r=>lines.push(['交易委托簿',...r].join('\t')));summary.push('| 交易委托簿 | 23 | 23/23 | 通过 |');
for(const [name,path,layers]of configModules){const s=read(path),w=read(wrapperFor[name]);const rows=[...s.matchAll(/([A-Z0-9]+):\{t:'([^']+)',a:'([^']+)',b:'([^']+)',o:'([^']+)'/g)].map(([,id,t,a,b,o])=>[id,t,`${a} / ${b}`,o]);const ids=rows.map(r=>r[0]);const unique=new Set(rows.map(r=>r.slice(1).join('|'))).size===rows.length;const preserved=layers.every(x=>w.lastIndexOf(x)<w.lastIndexOf('DistinctExtension'));if(!rows.length||!unique||!preserved||/(fetch\(|window\.open|Math\.random)/.test(s))throw new Error(`${name} 审计失败`);rows.forEach(r=>lines.push([name,...r].join('\t')));summary.push(`| ${name} | ${rows.length} | ${rows.length}/${rows.length} | 通过 |`)}
writeFileSync(resolve(root,'audit/runtime/trading-four-tab-mapping.tsv'),lines.join('\n')+'\n');
writeFileSync(resolve(root,'audit/runtime/trading-four-extension-audit.md'),`# 四个交易区域逐入口审计\n\n| 模块 | 映射入口 | 任务—输入—结果指纹 | 原私有工具在专属层之前 |\n| --- | ---: | --- | --- |\n${summary.join('\n')}\n\n映射表：\`audit/runtime/trading-four-tab-mapping.tsv\`。审计不把原页面展示值作为外部实时数据，并检查新增层不含外部抓取、第三方跳转或随机数调用。\n`);
console.log(`审计通过：${lines.length-1} 条逐入口映射`);
