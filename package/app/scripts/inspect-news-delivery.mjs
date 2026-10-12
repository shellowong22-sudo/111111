import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL || 'mysql://root@127.0.0.1:3307/finance_hub');
try {
  const [rows] = await conn.execute(`SELECT a.id, a.status, a.ai_title AS title, a.source_headline AS headline,
    a.source_url AS articleUrl, a.published_at AS publishedAt,
    s.name AS publication, s.provider,
    COALESCE(a.ai_summary, a.source_excerpt, '') AS summary
    FROM admin_news_ingestion_articles a JOIN admin_news_ingestion_sources s ON s.id=a.source_id
    WHERE a.source_headline LIKE ? OR s.name REGEXP ? ORDER BY a.updated_at DESC LIMIT 50`, ['%Interview with Le Temps%', '日本銀|日本银|Bank of Japan']);
  const [deliveries] = await conn.execute(`SELECT id,module_id,status,source_kind,title,
    body, target_payload AS payload FROM admin_data_module_content_items
    WHERE title LIKE ? ORDER BY id DESC LIMIT 15`, ['%Interview with Le Temps%']);
  console.log(JSON.stringify({ articles: rows, deliveries }, null, 2));
} finally {
  await conn.end();
}
