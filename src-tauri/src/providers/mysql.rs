use super::{
    async_trait, ColumnInfo, ConnectionParams, DatabaseProvider, DatabaseType, ProviderError,
    QueryResult, TableInfo,
};
use mysql_async::prelude::*;
use mysql_async::{Conn, Opts, Pool, Value as MySqlValue};

mod queries {
    pub const LIST_TABLES: &str = r#"
SELECT
    TABLE_SCHEMA as `schema`,
    TABLE_NAME as name,
    COALESCE(TABLE_ROWS, 0) as row_count
FROM information_schema.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
    AND TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
ORDER BY TABLE_SCHEMA, TABLE_NAME
"#;

    pub const GET_TABLE_COLUMNS: &str = r#"
SELECT
    c.COLUMN_NAME as name,
    c.DATA_TYPE as data_type,
    c.IS_NULLABLE = 'YES' as is_nullable,
    c.COLUMN_KEY = 'PRI' as is_primary_key,
    c.COLUMN_DEFAULT IS NOT NULL as has_default
FROM information_schema.COLUMNS c
WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
ORDER BY c.ORDINAL_POSITION
"#;

    pub fn select_table_data(schema: &str, table: &str, limit: i64, offset: i64) -> String {
        format!(
            "SELECT * FROM `{}`.`{}` LIMIT {} OFFSET {}",
            schema, table, limit, offset
        )
    }

    pub fn count_table_rows(schema: &str, table: &str) -> String {
        format!("SELECT COUNT(*) as count FROM `{}`.`{}`", schema, table)
    }
}

pub struct MysqlProvider {
    pool: Pool,
}

impl MysqlProvider {
    pub async fn connect(params: ConnectionParams) -> Result<Self, ProviderError> {
        let url = params.to_mysql_url();

        let opts = Opts::from_url(&url)
            .map_err(|e| ProviderError::new(format!("Invalid MySQL URL: {}", e)))?;

        let pool = Pool::new(opts);

        let _conn = pool
            .get_conn()
            .await
            .map_err(|e| ProviderError::new(format!("MySQL connection failed: {}", e)))?;

        Ok(Self { pool })
    }

    async fn get_conn(&self) -> Result<Conn, ProviderError> {
        self.pool
            .get_conn()
            .await
            .map_err(|e| ProviderError::new(format!("Failed to get MySQL connection: {}", e)))
    }
}

impl Drop for MysqlProvider {
    fn drop(&mut self) {
        let pool = self.pool.clone();
        tokio::spawn(async move {
            pool.disconnect().await.ok();
        });
    }
}

#[async_trait]
impl DatabaseProvider for MysqlProvider {
    fn database_type(&self) -> DatabaseType {
        DatabaseType::Mysql
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, ProviderError> {
        let mut conn = self.get_conn().await?;

        let rows: Vec<(String, String, i64)> = conn
            .query(queries::LIST_TABLES)
            .await
            .map_err(|e| ProviderError::new(format!("Failed to list tables: {}", e)))?;

        let tables = rows
            .into_iter()
            .map(|(schema, name, row_count)| TableInfo {
                schema,
                name,
                row_count,
            })
            .collect();

        Ok(tables)
    }

    async fn get_table_columns(
        &self,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, ProviderError> {
        let mut conn = self.get_conn().await?;

        let rows: Vec<(String, String, i32, i32, i32)> = conn
            .exec(queries::GET_TABLE_COLUMNS, (schema, table))
            .await
            .map_err(|e| ProviderError::new(format!("Failed to get columns: {}", e)))?;

        let columns = rows
            .into_iter()
            .map(
                |(name, data_type, is_nullable, is_primary_key, has_default)| ColumnInfo {
                    name,
                    data_type,
                    is_nullable: is_nullable != 0,
                    is_primary_key: is_primary_key != 0,
                    has_default: has_default != 0,
                },
            )
            .collect();

        Ok(columns)
    }

    async fn get_table_data(
        &self,
        schema: &str,
        table: &str,
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, ProviderError> {
        let query = queries::select_table_data(schema, table, limit, offset);
        self.execute_query(&query).await
    }

    async fn execute_query(&self, query: &str) -> Result<QueryResult, ProviderError> {
        let mut conn = self.get_conn().await?;

        let mut result = conn
            .query_iter(query)
            .await
            .map_err(|e| ProviderError::new(format!("Query failed: {}", e)))?;

        let columns: Vec<String> = result
            .columns_ref()
            .iter()
            .map(|c| c.name_str().to_string())
            .collect();

        let rows: Vec<mysql_async::Row> = result
            .collect()
            .await
            .map_err(|e| ProviderError::new(format!("Failed to collect results: {}", e)))?;

        if rows.is_empty() {
            return Ok(QueryResult {
                columns,
                rows: vec![],
                row_count: 0,
            });
        }

        let result_rows: Vec<Vec<serde_json::Value>> = rows
            .iter()
            .map(|row| {
                (0..row.len())
                    .map(|i| mysql_value_to_json(row.get::<MySqlValue, _>(i)))
                    .collect()
            })
            .collect();

        Ok(QueryResult {
            columns,
            row_count: result_rows.len(),
            rows: result_rows,
        })
    }

    async fn get_table_count(&self, schema: &str, table: &str) -> Result<i64, ProviderError> {
        let mut conn = self.get_conn().await?;
        let query = queries::count_table_rows(schema, table);

        let count: Option<i64> = conn
            .query_first(&query)
            .await
            .map_err(|e| ProviderError::new(format!("Failed to get count: {}", e)))?;

        Ok(count.unwrap_or(0))
    }
}

fn mysql_value_to_json(value: Option<MySqlValue>) -> serde_json::Value {
    match value {
        None => serde_json::Value::Null,
        Some(v) => match v {
            MySqlValue::NULL => serde_json::Value::Null,
            MySqlValue::Bytes(bytes) => match String::from_utf8(bytes.clone()) {
                Ok(s) => serde_json::Value::String(s),
                Err(_) => {
                    use base64::Engine;
                    serde_json::Value::String(
                        base64::engine::general_purpose::STANDARD.encode(&bytes),
                    )
                }
            },
            MySqlValue::Int(i) => serde_json::Value::Number(i.into()),
            MySqlValue::UInt(u) => serde_json::Value::Number(u.into()),
            MySqlValue::Float(f) => serde_json::Number::from_f64(f as f64)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
            MySqlValue::Double(d) => serde_json::Number::from_f64(d)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
            MySqlValue::Date(year, month, day, hour, min, sec, micro) => {
                let datetime = format!(
                    "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}",
                    year, month, day, hour, min, sec, micro
                );
                serde_json::Value::String(datetime)
            }
            MySqlValue::Time(is_neg, days, hours, mins, secs, micros) => {
                let sign = if is_neg { "-" } else { "" };
                let total_hours = days as u32 * 24 + hours as u32;
                let time = format!(
                    "{}{:02}:{:02}:{:02}.{:06}",
                    sign, total_hours, mins, secs, micros
                );
                serde_json::Value::String(time)
            }
        },
    }
}
