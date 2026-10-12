export const FED_FINANCIAL_FIELDS = [
  ['interestIncome','利息收入'], ['treasuryInterest','国债利息收入'], ['mbsInterest','MBS利息收入'],
  ['interestExpense','利息支出'], ['reserveInterestExpense','存款机构等利息支出'], ['repoInterestExpense','逆回购利息支出'],
  ['netInterest','净利息收入/亏损'], ['otherIncome','其他净收入'], ['operatingExpenses','经营费用'], ['operatingNet','经营净收入/亏损'],
  ['remittances','上缴财政部利润'], ['deferredAssetChange','递延资产变动（分配表符号）'], ['remittanceAccrual','财政部汇缴净额（权责发生制）'],
  ['netIncomeAfterRemittances','上缴后净收入'],
] as const;
export type FedFinancialKey = typeof FED_FINANCIAL_FIELDS[number][0];
export type FedFinancialYear = { year:number } & Record<FedFinancialKey,number>;
export type FedFinancialSnapshot = {retrievedAt:string;reportYear:number;contentVersion:string;rows:FedFinancialYear[];unit:string;frequency:string;status:'available'};
