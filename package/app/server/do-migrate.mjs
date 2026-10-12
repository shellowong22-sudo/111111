/**
 * do-migrate.mjs - 执行所有数据库表创建
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const conn = await mysql.createConnection(url);

const tables = [
  `CREATE TABLE IF NOT EXISTS etf_holdings (id int AUTO_INCREMENT NOT NULL,etf_id int NOT NULL,holding_name varchar(255) NOT NULL,holding_type varchar(50),weight text,created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT etf_holdings_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS etf_products (id int AUTO_INCREMENT NOT NULL,symbol varchar(20) NOT NULL,name varchar(255) NOT NULL,name_en varchar(255),price text,nav text,change_val text,change_pct text,volume text,fund_type varchar(100),asset_class varchar(100),region varchar(100),rating varchar(20),created_at timestamp NOT NULL DEFAULT (now()),updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT etf_products_id PRIMARY KEY(id),CONSTRAINT etf_products_symbol_unique UNIQUE(symbol))`,
  `CREATE TABLE IF NOT EXISTS fund_data (id int AUTO_INCREMENT NOT NULL,symbol varchar(20) NOT NULL,name varchar(255) NOT NULL,name_en varchar(255),price text,change_val text,change_pct text,fund_type varchar(100),asset_class varchar(100),created_at timestamp NOT NULL DEFAULT (now()),updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT fund_data_id PRIMARY KEY(id),CONSTRAINT fund_data_symbol_unique UNIQUE(symbol))`,
  `CREATE TABLE IF NOT EXISTS fund_distributions (id int AUTO_INCREMENT NOT NULL,fund_id int NOT NULL,distribution_type varchar(50) NOT NULL,name varchar(255) NOT NULL,weight text,created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT fund_distributions_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS market_data (id int AUTO_INCREMENT NOT NULL,symbol varchar(32) NOT NULL,name varchar(128) NOT NULL,market ENUM('stock','bond','forex','commodity','index','derivative','option','fund') NOT NULL DEFAULT 'stock',price text NOT NULL DEFAULT '0',change_val text NOT NULL DEFAULT '0',change_pct text NOT NULL DEFAULT '0',volume text NOT NULL DEFAULT '0',updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT market_data_id PRIMARY KEY(id),CONSTRAINT market_data_symbol_unique UNIQUE(symbol))`,
  `CREATE TABLE IF NOT EXISTS countries (id int AUTO_INCREMENT NOT NULL,name varchar(100) NOT NULL,code varchar(10) NOT NULL,region varchar(100),currency varchar(10),created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT countries_id PRIMARY KEY(id),CONSTRAINT countries_name_unique UNIQUE(name),CONSTRAINT countries_code_unique UNIQUE(code))`,
  `CREATE TABLE IF NOT EXISTS curve_types (id int AUTO_INCREMENT NOT NULL,type_name varchar(100) NOT NULL,description text,created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT curve_types_id PRIMARY KEY(id),CONSTRAINT curve_types_type_name_unique UNIQUE(type_name))`,
  `CREATE TABLE IF NOT EXISTS curve_variants (id int AUTO_INCREMENT NOT NULL,curve_id int NOT NULL,variant_type varchar(100) NOT NULL,description text,created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT curve_variants_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS credit_ratings (id int AUTO_INCREMENT NOT NULL,security_id int NOT NULL,rating_agency varchar(50) NOT NULL,rating varchar(10) NOT NULL,outlook varchar(20),rating_date varchar(10) NOT NULL,previous_rating varchar(10),previous_date varchar(10),rating_action varchar(20),created_at timestamp NOT NULL DEFAULT (now()),updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT credit_ratings_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS financial_data (id int AUTO_INCREMENT NOT NULL,security_id int NOT NULL,metric_id int NOT NULL,year int NOT NULL,month int,value text NOT NULL,currency varchar(10) DEFAULT 'USD',data_date varchar(10) NOT NULL,created_at timestamp NOT NULL DEFAULT (now()),updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT financial_data_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS financial_metrics (id int AUTO_INCREMENT NOT NULL,metric_code varchar(50) NOT NULL,metric_name varchar(255) NOT NULL,metric_name_en varchar(255),category varchar(100) NOT NULL,unit varchar(50),description text,created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT financial_metrics_id PRIMARY KEY(id),CONSTRAINT financial_metrics_metric_code_unique UNIQUE(metric_code))`,
  `CREATE TABLE IF NOT EXISTS model_metrics (id int AUTO_INCREMENT NOT NULL,model_name varchar(100) NOT NULL,metric_date varchar(10) NOT NULL,mae text,rmse text,mape text,r_squared text,accuracy text,description text,created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT model_metrics_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS model_predictions (id int AUTO_INCREMENT NOT NULL,security_id int NOT NULL,model_name varchar(100) NOT NULL,model_type varchar(50) NOT NULL,prediction_date varchar(10) NOT NULL,target_date varchar(10) NOT NULL,predicted_value text NOT NULL,actual_value text,confidence text,error text,metric varchar(100),created_at timestamp NOT NULL DEFAULT (now()),updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT model_predictions_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS rating_agencies (id int AUTO_INCREMENT NOT NULL,agency_name varchar(100) NOT NULL,agency_code varchar(20) NOT NULL,country varchar(100),website varchar(255),created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT rating_agencies_id PRIMARY KEY(id),CONSTRAINT rating_agencies_agency_name_unique UNIQUE(agency_name),CONSTRAINT rating_agencies_agency_code_unique UNIQUE(agency_code))`,
  `CREATE TABLE IF NOT EXISTS workbench_panels (id int AUTO_INCREMENT NOT NULL,user_id int NOT NULL,panel_code varchar(50) NOT NULL,panel_name varchar(255) NOT NULL,panel_type varchar(50) NOT NULL,icon varchar(100),position int DEFAULT 0,pinned tinyint NOT NULL DEFAULT 0,created_at timestamp NOT NULL DEFAULT (now()),updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT workbench_panels_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS alert_rules (id varchar(36) NOT NULL,user_id int NOT NULL,portfolio_id varchar(36),symbol varchar(20),rule_type ENUM('price_above','price_below','var_above','var_below','return_above','return_below','volatility_above','volatility_below') NOT NULL,threshold text NOT NULL,is_active tinyint NOT NULL DEFAULT 1,last_triggered_at int,created_at int NOT NULL,updated_at int NOT NULL,CONSTRAINT alert_rules_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS alert_triggers (id varchar(36) NOT NULL,rule_id varchar(36) NOT NULL,user_id int NOT NULL,symbol varchar(20),current_value text,threshold text,notification_id varchar(36),triggered_at int NOT NULL,CONSTRAINT alert_triggers_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS crvf_watchlist (id int AUTO_INCREMENT NOT NULL,userId int NOT NULL,curveId varchar(64) NOT NULL,curveName varchar(255) NOT NULL,note varchar(255),createdAt timestamp NOT NULL DEFAULT (now()),CONSTRAINT crvf_watchlist_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS curve_interactions (id varchar(36) NOT NULL,user_id int NOT NULL,source_panel_id varchar(50) NOT NULL,target_panel_id varchar(50) NOT NULL,curve_id int,period varchar(50),value text,parameters_passed text,interacted_at int NOT NULL,created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT curve_interactions_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS pricing_risk_exports (id varchar(36) NOT NULL,user_id int NOT NULL,panel_id varchar(50) NOT NULL,panel_name varchar(255),export_type varchar(20) NOT NULL,file_url text,file_size int,data_snapshot text,exported_at int NOT NULL,expires_at int,created_at timestamp NOT NULL DEFAULT (now()),CONSTRAINT pricing_risk_exports_id PRIMARY KEY(id))`,
  `CREATE TABLE IF NOT EXISTS user_preferences (id int AUTO_INCREMENT NOT NULL,user_id int NOT NULL,panel_layout text,var_confidence varchar(10) DEFAULT '99%',volatility_model varchar(50) DEFAULT 'SVI',valuation_model varchar(50) DEFAULT 'BSM',stress_scenario varchar(100) DEFAULT 'historical',export_format varchar(20) DEFAULT 'PDF',last_updated_panel varchar(50),created_at timestamp NOT NULL DEFAULT (now()),updated_at timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT user_preferences_id PRIMARY KEY(id))`
];

for (const sql of tables) {
  try {
    await conn.execute(sql);
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    console.log(`✓ ${tableName}`);
  } catch(e) {
    console.warn(`WARN [${e.code}]: ${e.message?.slice(0,100)}`);
  }
}
await conn.end();
console.log('Migration done!');
