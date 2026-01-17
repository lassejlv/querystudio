use super::{
    async_trait, ColumnInfo, ConnectionParams, DatabaseProvider, DatabaseType, ProviderError,
    QueryResult, TableInfo,
};
use redis::{aio::ConnectionManager, AsyncCommands, Client, RedisError};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct RedisProvider {
    conn: Arc<Mutex<ConnectionManager>>,
    #[allow(dead_code)]
    client: Client,
}

impl RedisProvider {
    pub async fn connect(params: ConnectionParams) -> Result<Self, ProviderError> {
        let url = params.to_redis_url();

        let client = Client::open(url.as_str())
            .map_err(|e| ProviderError::new(format!("Failed to create Redis client: {}", e)))?;

        let conn = ConnectionManager::new(client.clone())
            .await
            .map_err(|e| ProviderError::new(format!("Failed to connect to Redis: {}", e)))?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            client,
        })
    }

    fn format_error(e: RedisError) -> ProviderError {
        ProviderError::new(e.to_string())
    }

    /// Scan keys matching a pattern
    async fn scan_keys(&self, pattern: &str, count: usize) -> Result<Vec<String>, ProviderError> {
        let mut conn = self.conn.lock().await;
        let mut keys: Vec<String> = Vec::new();
        let mut cursor: u64 = 0;

        loop {
            let (new_cursor, batch): (u64, Vec<String>) = redis::cmd("SCAN")
                .arg(cursor)
                .arg("MATCH")
                .arg(pattern)
                .arg("COUNT")
                .arg(100)
                .query_async(&mut *conn)
                .await
                .map_err(Self::format_error)?;

            keys.extend(batch);
            cursor = new_cursor;

            if cursor == 0 || keys.len() >= count {
                break;
            }
        }

        keys.truncate(count);
        Ok(keys)
    }

    /// Get the type of a key
    async fn get_key_type(&self, key: &str) -> Result<String, ProviderError> {
        let mut conn = self.conn.lock().await;
        let key_type: String = redis::cmd("TYPE")
            .arg(key)
            .query_async(&mut *conn)
            .await
            .map_err(Self::format_error)?;
        Ok(key_type)
    }

    /// Get TTL of a key
    async fn get_key_ttl(&self, key: &str) -> Result<i64, ProviderError> {
        let mut conn = self.conn.lock().await;
        let ttl: i64 = conn.ttl(key).await.map_err(Self::format_error)?;
        Ok(ttl)
    }

    /// Get value based on type
    async fn get_value(
        &self,
        key: &str,
        key_type: &str,
    ) -> Result<serde_json::Value, ProviderError> {
        let mut conn = self.conn.lock().await;

        match key_type {
            "string" => {
                let val: Option<String> = conn.get(key).await.map_err(Self::format_error)?;
                Ok(val
                    .map(serde_json::Value::String)
                    .unwrap_or(serde_json::Value::Null))
            }
            "list" => {
                let vals: Vec<String> =
                    conn.lrange(key, 0, 99).await.map_err(Self::format_error)?;
                Ok(serde_json::Value::Array(
                    vals.into_iter().map(serde_json::Value::String).collect(),
                ))
            }
            "set" => {
                let vals: Vec<String> = conn.smembers(key).await.map_err(Self::format_error)?;
                Ok(serde_json::Value::Array(
                    vals.into_iter().map(serde_json::Value::String).collect(),
                ))
            }
            "zset" => {
                let vals: Vec<(String, f64)> = conn
                    .zrange_withscores(key, 0, 99)
                    .await
                    .map_err(Self::format_error)?;
                let arr: Vec<serde_json::Value> = vals
                    .into_iter()
                    .map(|(member, score)| {
                        serde_json::json!({
                            "member": member,
                            "score": score
                        })
                    })
                    .collect();
                Ok(serde_json::Value::Array(arr))
            }
            "hash" => {
                let vals: Vec<(String, String)> =
                    conn.hgetall(key).await.map_err(Self::format_error)?;
                let obj: serde_json::Map<String, serde_json::Value> = vals
                    .into_iter()
                    .map(|(k, v)| (k, serde_json::Value::String(v)))
                    .collect();
                Ok(serde_json::Value::Object(obj))
            }
            "stream" => {
                // For streams, get recent entries
                let entries: redis::streams::StreamRangeReply = redis::cmd("XRANGE")
                    .arg(key)
                    .arg("-")
                    .arg("+")
                    .arg("COUNT")
                    .arg(100)
                    .query_async(&mut *conn)
                    .await
                    .map_err(Self::format_error)?;

                let arr: Vec<serde_json::Value> = entries
                    .ids
                    .into_iter()
                    .map(|entry| {
                        let fields: serde_json::Map<String, serde_json::Value> = entry
                            .map
                            .into_iter()
                            .map(|(k, v)| {
                                let val: String =
                                    redis::FromRedisValue::from_redis_value(&v).unwrap_or_default();
                                (k, serde_json::Value::String(val))
                            })
                            .collect();
                        serde_json::json!({
                            "id": entry.id,
                            "fields": fields
                        })
                    })
                    .collect();
                Ok(serde_json::Value::Array(arr))
            }
            _ => Ok(serde_json::Value::String(format!("<{}>", key_type))),
        }
    }

    /// Parse and execute a Redis command
    async fn execute_command(&self, command: &str) -> Result<QueryResult, ProviderError> {
        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() {
            return Err(ProviderError::new("Empty command"));
        }

        let cmd_name = parts[0].to_uppercase();
        let args = &parts[1..];

        let mut conn = self.conn.lock().await;
        let mut cmd = redis::cmd(&cmd_name);
        for arg in args {
            cmd.arg(*arg);
        }

        let result: redis::Value = cmd
            .query_async(&mut *conn)
            .await
            .map_err(Self::format_error)?;

        let json_value = redis_value_to_json(&result);

        // Format result as a table
        match json_value {
            serde_json::Value::Array(arr) => {
                let rows: Vec<Vec<serde_json::Value>> = arr
                    .into_iter()
                    .enumerate()
                    .map(|(i, v)| vec![serde_json::Value::Number(i.into()), v])
                    .collect();
                Ok(QueryResult {
                    columns: vec!["index".to_string(), "value".to_string()],
                    row_count: rows.len(),
                    rows,
                })
            }
            serde_json::Value::Object(obj) => {
                let rows: Vec<Vec<serde_json::Value>> = obj
                    .into_iter()
                    .map(|(k, v)| vec![serde_json::Value::String(k), v])
                    .collect();
                Ok(QueryResult {
                    columns: vec!["key".to_string(), "value".to_string()],
                    row_count: rows.len(),
                    rows,
                })
            }
            _ => Ok(QueryResult {
                columns: vec!["result".to_string()],
                row_count: 1,
                rows: vec![vec![json_value]],
            }),
        }
    }
}

#[async_trait]
impl DatabaseProvider for RedisProvider {
    fn database_type(&self) -> DatabaseType {
        DatabaseType::Redis
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, ProviderError> {
        // For Redis, we'll show key prefixes as "tables"
        // First, let's get a sample of keys to identify patterns
        let keys = self.scan_keys("*", 1000).await?;

        // Group keys by prefix (before first : or entire key if no :)
        let mut prefix_counts: std::collections::HashMap<String, i64> =
            std::collections::HashMap::new();

        for key in &keys {
            let prefix = if let Some(idx) = key.find(':') {
                format!("{}:*", &key[..idx])
            } else {
                key.clone()
            };
            *prefix_counts.entry(prefix).or_insert(0) += 1;
        }

        // Also add a special entry for all keys
        let mut conn = self.conn.lock().await;
        let total_keys: i64 = redis::cmd("DBSIZE")
            .query_async(&mut *conn)
            .await
            .map_err(Self::format_error)?;
        drop(conn);

        let mut tables: Vec<TableInfo> = prefix_counts
            .into_iter()
            .map(|(prefix, count)| TableInfo {
                schema: "db0".to_string(),
                name: prefix,
                row_count: count,
            })
            .collect();

        // Sort by name
        tables.sort_by(|a, b| a.name.cmp(&b.name));

        // Add "*" at the beginning to show all keys
        tables.insert(
            0,
            TableInfo {
                schema: "db0".to_string(),
                name: "*".to_string(),
                row_count: total_keys,
            },
        );

        Ok(tables)
    }

    async fn get_table_columns(
        &self,
        _schema: &str,
        _table: &str,
    ) -> Result<Vec<ColumnInfo>, ProviderError> {
        // For Redis, columns represent key metadata
        Ok(vec![
            ColumnInfo {
                name: "key".to_string(),
                data_type: "string".to_string(),
                is_nullable: false,
                is_primary_key: true,
                has_default: false,
            },
            ColumnInfo {
                name: "type".to_string(),
                data_type: "string".to_string(),
                is_nullable: false,
                is_primary_key: false,
                has_default: false,
            },
            ColumnInfo {
                name: "ttl".to_string(),
                data_type: "integer".to_string(),
                is_nullable: true,
                is_primary_key: false,
                has_default: false,
            },
            ColumnInfo {
                name: "value".to_string(),
                data_type: "any".to_string(),
                is_nullable: true,
                is_primary_key: false,
                has_default: false,
            },
        ])
    }

    async fn get_table_data(
        &self,
        _schema: &str,
        table: &str,
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, ProviderError> {
        // Use the table name as a key pattern
        let pattern = if table == "*" {
            "*".to_string()
        } else {
            table.to_string()
        };

        // Get keys matching pattern
        let all_keys = self.scan_keys(&pattern, (offset + limit) as usize).await?;

        // Apply offset
        let keys: Vec<String> = all_keys
            .into_iter()
            .skip(offset as usize)
            .take(limit as usize)
            .collect();

        let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();

        for key in keys {
            let key_type = self.get_key_type(&key).await?;
            let ttl = self.get_key_ttl(&key).await?;
            let value = self.get_value(&key, &key_type).await?;

            let ttl_value = if ttl == -1 {
                serde_json::Value::Null // No expiry
            } else if ttl == -2 {
                serde_json::Value::String("expired".to_string())
            } else {
                serde_json::Value::Number(ttl.into())
            };

            rows.push(vec![
                serde_json::Value::String(key),
                serde_json::Value::String(key_type),
                ttl_value,
                value,
            ]);
        }

        Ok(QueryResult {
            columns: vec![
                "key".to_string(),
                "type".to_string(),
                "ttl".to_string(),
                "value".to_string(),
            ],
            row_count: rows.len(),
            rows,
        })
    }

    async fn execute_query(&self, query: &str) -> Result<QueryResult, ProviderError> {
        let trimmed = query.trim();

        // Handle multiple commands separated by newlines
        let commands: Vec<&str> = trimmed.lines().filter(|l| !l.trim().is_empty()).collect();

        if commands.is_empty() {
            return Err(ProviderError::new("No command provided"));
        }

        // Execute commands and return the last result
        let mut last_result = QueryResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
        };

        for cmd in commands {
            last_result = self.execute_command(cmd.trim()).await?;
        }

        Ok(last_result)
    }

    async fn get_table_count(&self, _schema: &str, table: &str) -> Result<i64, ProviderError> {
        if table == "*" {
            let mut conn = self.conn.lock().await;
            let count: i64 = redis::cmd("DBSIZE")
                .query_async(&mut *conn)
                .await
                .map_err(Self::format_error)?;
            Ok(count)
        } else {
            let keys = self.scan_keys(table, 10000).await?;
            Ok(keys.len() as i64)
        }
    }
}

fn redis_value_to_json(value: &redis::Value) -> serde_json::Value {
    match value {
        redis::Value::Nil => serde_json::Value::Null,
        redis::Value::Int(i) => serde_json::Value::Number((*i).into()),
        redis::Value::BulkString(bytes) => String::from_utf8(bytes.clone())
            .map(serde_json::Value::String)
            .unwrap_or_else(|_| {
                use base64::Engine;
                serde_json::Value::String(base64::engine::general_purpose::STANDARD.encode(bytes))
            }),
        redis::Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(redis_value_to_json).collect())
        }
        redis::Value::SimpleString(s) => serde_json::Value::String(s.clone()),
        redis::Value::Okay => serde_json::Value::String("OK".to_string()),
        redis::Value::Map(map) => {
            let obj: serde_json::Map<String, serde_json::Value> = map
                .iter()
                .filter_map(|(k, v)| {
                    if let serde_json::Value::String(key) = redis_value_to_json(k) {
                        Some((key, redis_value_to_json(v)))
                    } else {
                        None
                    }
                })
                .collect();
            serde_json::Value::Object(obj)
        }
        redis::Value::Set(set) => {
            serde_json::Value::Array(set.iter().map(redis_value_to_json).collect())
        }
        redis::Value::Double(d) => serde_json::Number::from_f64(*d)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        redis::Value::Boolean(b) => serde_json::Value::Bool(*b),
        redis::Value::VerbatimString { format: _, text } => serde_json::Value::String(text.clone()),
        redis::Value::BigNumber(n) => serde_json::Value::String(n.to_string()),
        redis::Value::Push { kind: _, data } => {
            serde_json::Value::Array(data.iter().map(redis_value_to_json).collect())
        }
        redis::Value::ServerError(e) => serde_json::Value::String(format!("Error: {:?}", e)),
        _ => serde_json::Value::Null,
    }
}
