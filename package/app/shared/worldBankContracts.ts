export const WORLD_BANK_CONTRACTS = [
 ['BX.KLT.DINV.CD.WD','直接投资净流入','economic-wfii','美元'],
 ['BM.KLT.DINV.CD.WD','直接投资净流出','economic-wfii','美元'],
 ['BN.KLT.PTXL.CD','证券投资净额','economic-wfii','美元'],
 ['NE.EXP.GNFS.CD','货物及服务出口','economic-ectr','美元'],
 ['NE.IMP.GNFS.CD','货物及服务进口','economic-ectr','美元'],
 ['NE.RSB.GNFS.CD','货物及服务贸易差额','economic-ectr','美元'],
 ['NY.GDP.MKTP.CD','名义GDP','economic-ecst','美元'],
 ['NY.GDP.PCAP.CD','人均GDP','economic-bie','美元/人'],
 ['FP.CPI.TOTL.ZG','消费者价格年通胀率','economic-ecob','%'],
 ['SL.UEM.TOTL.ZS','总失业率（ILO模型估计）','economic-ecst','劳动力%'],
 ['SP.POP.TOTL','总人口','economic-bie','人'],
] .map(([indicator,label,primaryModuleId,unit])=>({id:`official_worldbank_${indicator}`,indicator,label,primaryModuleId,unit,provider:'World Bank',frequency:'年度',sourceUrl:`https://data.worldbank.org/indicator/${indicator}`}));
export const WORLD_BANK_COUNTRIES=['USA','CHN','JPN','GBR','DEU','FRA','ITA','ESP','CAN','AUS','IND','BRA','MEX','KOR','IDN','ZAF','CHE','SWE','NOR','NZL','SGP','HKG','SAU','TUR','ARE','ISR','POL','NLD','BEL','AUT','DNK','FIN','IRL','PRT','GRC','THA','MYS','PHL','VNM','CHL'] as const;
