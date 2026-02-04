use async_trait::async_trait;
use crate::{
    ColumnInfo, ConnectionParams, DatabaseProvider, DatabaseType, ProviderError,
    QueryResult, TableInfo,
};
use redis::{
    aio::ConnectionManager, cluster_async::ClusterConnection, AsyncCommands, Client, RedisError,
};
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

/// Type of Redis connection
#[derive(Clone)]
enum RedisConnection {
    Single(Arc<Mutex<ConnectionManager>>),
    Cluster(Arc<Mutex<ClusterConnection>>),
}

/// Pub/Sub message type
#[derive(Debug, Clone, serde::Serialize)]
pub struct PubSubMessage {
    pub channel: String,
    pub payload: String,
    pub pattern: Option<String>,
}

/// Redis server information
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize)]
pub struct ServerInfo {
    pub version: String,
    pub mode: String,
    pub os: String,
    pub process_id: i64,
    pub tcp_port: i64,
    pub uptime_in_seconds: i64,
    pub connected_clients: i64,
    pub used_memory_human: String,
    pub total_keys: i64,
}

/// Key information with metadata
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize)]
pub struct KeyInfo {
    pub key: String,
    pub key_type: String,
    pub ttl: i64,
    pub size: i64,
    pub encoding: String,
}

/// Transaction result
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize)]
pub struct TransactionResult {
    pub results: Vec<serde_json::Value>,
    pub success: bool,
}

/// Pipeline result
#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize)]
pub struct PipelineResult {
    pub results: Vec<serde_json::Value>,
    pub errors: Vec<String>,
}

pub struct RedisProvider {
    conn: RedisConnection,
    #[allow(dead_code)]
    client: Option<Client>,
    #[allow(dead_code)]
    cluster_client: Option<redis::cluster::ClusterClient>,
    /// Pub/Sub sender channel
    #[allow(dead_code)]
    pubsub_tx: Arc<RwLock<Option<tokio::sync::mpsc::Sender<PubSubMessage>>>>,
    /// Active subscriptions
    #[allow(dead_code)]
    subscriptions: Arc<RwLock<Vec<String>>>,
    /// Is cluster mode
    #[allow(dead_code)]
    is_cluster: bool,
}

#[allow(dead_code)]
impl RedisProvider {
    pub async fn connect(params: ConnectionParams) -> Result<Self, ProviderError> {
        match params {
            ConnectionParams::ConnectionString { connection_string } => {
                if connection_string.contains(',')
                    || connection_string.starts_with("redis-cluster://")
                {
                    Self::connect_cluster(connection_string).await
                } else {
                    Self::connect_single(connection_string).await
                }
            }
            ConnectionParams::Parameters {
                host,
                port,
                database,
                username,
                password,
            } => {
                let auth = if !username.is_empty() && !password.is_empty() {
                    format!("{}:{}@", username, password)
                } else if !password.is_empty() {
                    format!(":{}@", password)
                } else {
                    String::new()
                };
                let db = if !database.is_empty() && database != "0" {
                    format!("/ {}", database)
                } else {
                    String::new()
                };
                let url = format!("redis://{}{}:{}{}", auth, host, port, db);
                Self::connect_single(url).await
            }
        }
    }

    async fn connect_single(url: String) -> Result<Self, ProviderError> {
        let client = Client::open(url.as_str())
            .map_err(|e| ProviderError::new(format!("Failed to create Redis client: {}", e)))?;

        let conn = ConnectionManager::new(client.clone())
            .await
            .map_err(|e| ProviderError::new(format!("Failed to connect to Redis: {}", e)))?;

        Ok(Self {
            conn: RedisConnection::Single(Arc::new(Mutex::new(conn))),
            client: Some(client),
            cluster_client: None,
            pubsub_tx: Arc::new(RwLock::new(None)),
            subscriptions: Arc::new(RwLock::new(Vec::new())),
            is_cluster: false,
        })
    }

    async fn connect_cluster(urls: String) -> Result<Self, ProviderError> {
        let url_list: Vec<String> = if urls.starts_with("redis-cluster://") {
            vec![urls]
        } else {
            urls.split(',').map(|s| s.trim().to_string()).collect()
        };

        let client = redis::cluster::ClusterClient::builder(url_list)
            .build()
            .map_err(|e| {
                ProviderError::new(format!("Failed to create Redis cluster client: {}", e))
            })?;

        let conn = client.get_async_connection().await.map_err(|e| {
            ProviderError::new(format!("Failed to connect to Redis cluster: {}", e))
        })?;

        Ok(Self {
            conn: RedisConnection::Cluster(Arc::new(Mutex::new(conn))),
            client: None,
            cluster_client: Some(client),
            pubsub_tx: Arc::new(RwLock::new(None)),
            subscriptions: Arc::new(RwLock::new(Vec::new())),
            is_cluster: true,
        })
    }

    fn format_error(e: RedisError) -> ProviderError {
        let msg = e.to_string();
        let detail = if msg.contains("NOAUTH") {
            Some("Authentication required. Check your password.".to_string())
        } else if msg.contains("WRONGPASS") {
            Some("Invalid password provided.".to_string())
        } else if msg.contains("ERR") {
            Some(msg.clone())
        } else {
            None
        };

        ProviderError::new(msg).with_detail(detail.unwrap_or_default())
    }

    /// Get database size (total keys)
    async fn db_size(&self) -> Result<i64, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let size: i64 = redis::cmd("DBSIZE")
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(size)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let size: i64 = redis::cmd("DBSIZE")
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(size)
            }
        }
    }

    /// Scan keys matching a pattern
    async fn scan_keys(&self, pattern: &str, count: usize) -> Result<Vec<String>, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let mut keys: Vec<String> = Vec::new();
                let mut cursor: u64 = 0;

                loop {
                    let (new_cursor, batch): (u64, Vec<String>) = redis::cmd("SCAN")
                        .arg(cursor)
                        .arg("MATCH")
                        .arg(pattern)
                        .arg("COUNT")
                        .arg(100)
                        .query_async(&mut *c)
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
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let mut keys: Vec<String> = Vec::new();
                let mut cursor: u64 = 0;

                loop {
                    let (new_cursor, batch): (u64, Vec<String>) = redis::cmd("SCAN")
                        .arg(cursor)
                        .arg("MATCH")
                        .arg(pattern)
                        .arg("COUNT")
                        .arg(100)
                        .query_async(&mut *c)
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
        }
    }

    /// Get the type of a key
    async fn get_key_type(&self, key: &str) -> Result<String, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let key_type: String = redis::cmd("TYPE")
                    .arg(key)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(key_type)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let key_type: String = redis::cmd("TYPE")
                    .arg(key)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(key_type)
            }
        }
    }

    /// Get TTL of a key
    async fn get_key_ttl(&self, key: &str) -> Result<i64, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let ttl: i64 = c.ttl(key).await.map_err(Self::format_error)?;
                Ok(ttl)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let ttl: i64 = c.ttl(key).await.map_err(Self::format_error)?;
                Ok(ttl)
            }
        }
    }

    /// Get memory usage of a key
    async fn get_key_size(&self, key: &str) -> Result<i64, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let size: i64 = redis::cmd("MEMORY")
                    .arg("USAGE")
                    .arg(key)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(size)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let size: i64 = redis::cmd("MEMORY")
                    .arg("USAGE")
                    .arg(key)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(size)
            }
        }
    }

    /// Get encoding of a key
    async fn get_key_encoding(&self, key: &str) -> Result<String, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let encoding: String = redis::cmd("OBJECT")
                    .arg("ENCODING")
                    .arg(key)
                    .query_async(&mut *c)
                    .await
                    .unwrap_or_default();
                Ok(encoding)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let encoding: String = redis::cmd("OBJECT")
                    .arg("ENCODING")
                    .arg(key)
                    .query_async(&mut *c)
                    .await
                    .unwrap_or_default();
                Ok(encoding)
            }
        }
    }

    /// Get detailed key information
    pub async fn get_key_info(&self, key: &str) -> Result<KeyInfo, ProviderError> {
        let key_type = self.get_key_type(key).await?;
        let ttl = self.get_key_ttl(key).await?;
        let size = self.get_key_size(key).await.unwrap_or(0);
        let encoding = self.get_key_encoding(key).await.unwrap_or_default();

        Ok(KeyInfo {
            key: key.to_string(),
            key_type,
            ttl,
            size,
            encoding,
        })
    }

    /// Get value based on type
    async fn get_value(
        &self,
        key: &str,
        key_type: &str,
    ) -> Result<serde_json::Value, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                Self::get_value_from_conn(&mut *c, key, key_type).await
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                Self::get_value_from_conn(&mut *c, key, key_type).await
            }
        }
    }

    async fn get_value_from_conn<C>(
        conn: &mut C,
        key: &str,
        key_type: &str,
    ) -> Result<serde_json::Value, ProviderError>
    where
        C: AsyncCommands + Send,
    {
        match key_type {
            "string" => {
                let val: Option<String> =
                    conn.get(key).await.map_err(RedisProvider::format_error)?;
                Ok(val
                    .map(serde_json::Value::String)
                    .unwrap_or(serde_json::Value::Null))
            }
            "list" => {
                let vals: Vec<String> = conn
                    .lrange(key, 0, 99)
                    .await
                    .map_err(RedisProvider::format_error)?;
                Ok(serde_json::Value::Array(
                    vals.into_iter().map(serde_json::Value::String).collect(),
                ))
            }
            "set" => {
                let vals: Vec<String> = conn
                    .smembers(key)
                    .await
                    .map_err(RedisProvider::format_error)?;
                Ok(serde_json::Value::Array(
                    vals.into_iter().map(serde_json::Value::String).collect(),
                ))
            }
            "zset" => {
                let vals: Vec<(String, f64)> = conn
                    .zrange_withscores(key, 0, 99)
                    .await
                    .map_err(RedisProvider::format_error)?;
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
                let vals: Vec<(String, String)> = conn
                    .hgetall(key)
                    .await
                    .map_err(RedisProvider::format_error)?;
                let obj: serde_json::Map<String, serde_json::Value> = vals
                    .into_iter()
                    .map(|(k, v)| (k, serde_json::Value::String(v)))
                    .collect();
                Ok(serde_json::Value::Object(obj))
            }
            "stream" => {
                let entries: redis::streams::StreamRangeReply = redis::cmd("XRANGE")
                    .arg(key)
                    .arg("-")
                    .arg("+")
                    .arg("COUNT")
                    .arg(100)
                    .query_async(conn)
                    .await
                    .map_err(RedisProvider::format_error)?;

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
            "ReJSON-RL" | "json" => {
                let json_val: String = redis::cmd("JSON.GET")
                    .arg(key)
                    .arg(".")
                    .query_async(conn)
                    .await
                    .unwrap_or_default();
                Ok(serde_json::from_str(&json_val).unwrap_or(serde_json::Value::String(json_val)))
            }
            _ => Ok(serde_json::Value::String(format!("<{}>", key_type))),
        }
    }

    /// Execute a RedisJSON command
    pub async fn execute_json_command(
        &self,
        command: &str,
        key: &str,
        path: &str,
        value: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                Self::execute_json_internal(&mut *c, command, key, path, value).await
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                Self::execute_json_internal(&mut *c, command, key, path, value).await
            }
        }
    }

    async fn execute_json_internal<C>(
        conn: &mut C,
        command: &str,
        key: &str,
        path: &str,
        value: Option<serde_json::Value>,
    ) -> Result<serde_json::Value, ProviderError>
    where
        C: AsyncCommands + Send,
    {
        let result = match command.to_uppercase().as_str() {
            "GET" => {
                let val: String = redis::cmd("JSON.GET")
                    .arg(key)
                    .arg(path)
                    .query_async(conn)
                    .await
                    .map_err(RedisProvider::format_error)?;
                serde_json::from_str(&val).unwrap_or(serde_json::Value::String(val))
            }
            "SET" => {
                if let Some(v) = value {
                    let val_str = v.to_string();
                    let result: String = redis::cmd("JSON.SET")
                        .arg(key)
                        .arg(path)
                        .arg(val_str)
                        .query_async(conn)
                        .await
                        .map_err(RedisProvider::format_error)?;
                    serde_json::Value::String(result)
                } else {
                    return Err(ProviderError::new("JSON.SET requires a value"));
                }
            }
            "DEL" => {
                let result: i64 = redis::cmd("JSON.DEL")
                    .arg(key)
                    .arg(path)
                    .query_async(conn)
                    .await
                    .map_err(RedisProvider::format_error)?;
                serde_json::Value::Number(result.into())
            }
            "TYPE" => {
                let result: String = redis::cmd("JSON.TYPE")
                    .arg(key)
                    .arg(path)
                    .query_async(conn)
                    .await
                    .map_err(RedisProvider::format_error)?;
                serde_json::Value::String(result)
            }
            "ARRLEN" => {
                let result: i64 = redis::cmd("JSON.ARRLEN")
                    .arg(key)
                    .arg(path)
                    .query_async(conn)
                    .await
                    .map_err(RedisProvider::format_error)?;
                serde_json::Value::Number(result.into())
            }
            "OBJLEN" => {
                let result: i64 = redis::cmd("JSON.OBJLEN")
                    .arg(key)
                    .arg(path)
                    .query_async(conn)
                    .await
                    .map_err(RedisProvider::format_error)?;
                serde_json::Value::Number(result.into())
            }
            "OBJKEYS" => {
                let result: Vec<String> = redis::cmd("JSON.OBJKEYS")
                    .arg(key)
                    .arg(path)
                    .query_async(conn)
                    .await
                    .map_err(RedisProvider::format_error)?;
                serde_json::Value::Array(
                    result.into_iter().map(serde_json::Value::String).collect(),
                )
            }
            _ => {
                return Err(ProviderError::new(format!(
                    "Unknown JSON command: {}",
                    command
                )))
            }
        };

        Ok(result)
    }

    /// Set key expiration
    pub async fn expire(&self, key: &str, seconds: i64) -> Result<bool, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let result: bool = c.expire(key, seconds).await.map_err(Self::format_error)?;
                Ok(result)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let result: bool = c.expire(key, seconds).await.map_err(Self::format_error)?;
                Ok(result)
            }
        }
    }

    /// Set key expiration at specific timestamp
    pub async fn expire_at(&self, key: &str, timestamp: i64) -> Result<bool, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let result: bool = redis::cmd("EXPIREAT")
                    .arg(key)
                    .arg(timestamp)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(result)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let result: bool = redis::cmd("EXPIREAT")
                    .arg(key)
                    .arg(timestamp)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(result)
            }
        }
    }

    /// Remove expiration from a key
    pub async fn persist(&self, key: &str) -> Result<bool, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let result: bool = c.persist(key).await.map_err(Self::format_error)?;
                Ok(result)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let result: bool = c.persist(key).await.map_err(Self::format_error)?;
                Ok(result)
            }
        }
    }

    /// Create a new key with the specified type and value
    pub async fn create_key(
        &self,
        key: &str,
        key_type: &str,
        value: serde_json::Value,
        ttl: Option<i64>,
    ) -> Result<(), ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                Self::create_key_internal(&mut *c, key, key_type, value, ttl).await
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                Self::create_key_internal(&mut *c, key, key_type, value, ttl).await
            }
        }
    }

    async fn create_key_internal<C>(
        conn: &mut C,
        key: &str,
        key_type: &str,
        value: serde_json::Value,
        ttl: Option<i64>,
    ) -> Result<(), ProviderError>
    where
        C: AsyncCommands + Send,
    {
        let upper_type = key_type.to_uppercase();

        match upper_type.as_str() {
            "STRING" => {
                let val_str = value
                    .as_str()
                    .ok_or_else(|| ProviderError::new("String value must be a string"))?;
                let _: () = conn.set(key, val_str).await.map_err(Self::format_error)?;
            }
            "HASH" => {
                let obj = value
                    .as_object()
                    .ok_or_else(|| ProviderError::new("Hash value must be a JSON object"))?;
                if obj.is_empty() {
                    return Err(ProviderError::new("Hash value cannot be empty"));
                }
                let mut cmd = redis::cmd("HSET");
                cmd.arg(key);
                for (k, v) in obj {
                    cmd.arg(k);
                    cmd.arg(v.to_string());
                }
                let _: () = cmd.query_async(conn).await.map_err(Self::format_error)?;
            }
            "LIST" => {
                let arr = value
                    .as_array()
                    .ok_or_else(|| ProviderError::new("List value must be a JSON array"))?;
                if arr.is_empty() {
                    return Err(ProviderError::new("List value cannot be empty"));
                }
                let mut cmd = redis::cmd("RPUSH");
                cmd.arg(key);
                for v in arr {
                    cmd.arg(v.to_string());
                }
                let _: () = cmd.query_async(conn).await.map_err(Self::format_error)?;
            }
            "SET" => {
                let arr = value
                    .as_array()
                    .ok_or_else(|| ProviderError::new("Set value must be a JSON array"))?;
                if arr.is_empty() {
                    return Err(ProviderError::new("Set value cannot be empty"));
                }
                let mut cmd = redis::cmd("SADD");
                cmd.arg(key);
                for v in arr {
                    cmd.arg(v.to_string());
                }
                let _: () = cmd.query_async(conn).await.map_err(Self::format_error)?;
            }
            "ZSET" => {
                let arr = value.as_array().ok_or_else(|| {
                    ProviderError::new("ZSet value must be a JSON array of {member, score} objects")
                })?;
                if arr.is_empty() {
                    return Err(ProviderError::new("ZSet value cannot be empty"));
                }
                let mut cmd = redis::cmd("ZADD");
                cmd.arg(key);
                for item in arr {
                    let obj = item.as_object().ok_or_else(|| {
                        ProviderError::new("ZSet items must be objects with 'member' and 'score'")
                    })?;
                    let member = obj.get("member").ok_or_else(|| {
                        ProviderError::new("ZSet items must have a 'member' field")
                    })?;
                    let score = obj.get("score").ok_or_else(|| {
                        ProviderError::new("ZSet items must have a 'score' field")
                    })?;
                    let score_f64 = score
                        .as_f64()
                        .or_else(|| score.as_i64().map(|i| i as f64))
                        .ok_or_else(|| ProviderError::new("Score must be a number"))?;
                    cmd.arg(score_f64);
                    cmd.arg(member.to_string());
                }
                let _: () = cmd.query_async(conn).await.map_err(Self::format_error)?;
            }
            "JSON" => {
                let json_str = value.to_string();
                let _: () = redis::cmd("JSON.SET")
                    .arg(key)
                    .arg("$")
                    .arg(json_str)
                    .query_async(conn)
                    .await
                    .map_err(Self::format_error)?;
            }
            _ => {
                return Err(ProviderError::new(format!(
                    "Unsupported key type: {}. Supported types: string, hash, list, set, zset, json",
                    key_type
                )));
            }
        }

        // Set TTL if provided
        if let Some(ttl_seconds) = ttl {
            if ttl_seconds > 0 {
                let _: () = conn
                    .expire(key, ttl_seconds)
                    .await
                    .map_err(Self::format_error)?;
            }
        }

        Ok(())
    }

    /// Get server information
    pub async fn get_server_info(&self) -> Result<ServerInfo, ProviderError> {
        let info_str = self.get_info_section("server").await?;
        let memory_str = self.get_info_section("memory").await?;
        let clients_str = self.get_info_section("clients").await?;
        let keyspace_str = self.get_info_section("keyspace").await?;

        let mut server_info = ServerInfo {
            version: String::new(),
            mode: if self.is_cluster {
                "cluster".to_string()
            } else {
                "standalone".to_string()
            },
            os: String::new(),
            process_id: 0,
            tcp_port: 0,
            uptime_in_seconds: 0,
            connected_clients: 0,
            used_memory_human: String::new(),
            total_keys: 0,
        };

        // Parse server section
        for line in info_str.lines() {
            if let Some((key, value)) = line.split_once(':') {
                match key {
                    "redis_version" => server_info.version = value.to_string(),
                    "os" => server_info.os = value.to_string(),
                    "process_id" => server_info.process_id = value.parse().unwrap_or(0),
                    "tcp_port" => server_info.tcp_port = value.parse().unwrap_or(0),
                    "uptime_in_seconds" => {
                        server_info.uptime_in_seconds = value.parse().unwrap_or(0)
                    }
                    _ => {}
                }
            }
        }

        // Parse memory section
        for line in memory_str.lines() {
            if let Some((key, value)) = line.split_once(':') {
                if key == "used_memory_human" {
                    server_info.used_memory_human = value.to_string();
                }
            }
        }

        // Parse clients section
        for line in clients_str.lines() {
            if let Some((key, value)) = line.split_once(':') {
                if key == "connected_clients" {
                    server_info.connected_clients = value.parse().unwrap_or(0);
                }
            }
        }

        // Parse keyspace section for total keys
        for line in keyspace_str.lines() {
            if line.starts_with("db") {
                if let Some(keys_part) = line.split(',').find(|s| s.contains("keys=")) {
                    if let Some(count_str) = keys_part.split('=').nth(1) {
                        server_info.total_keys += count_str.parse::<i64>().unwrap_or(0);
                    }
                }
            }
        }

        Ok(server_info)
    }

    /// Get specific INFO section
    async fn get_info_section(&self, section: &str) -> Result<String, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let info: String = redis::cmd("INFO")
                    .arg(section)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(info)
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let info: String = redis::cmd("INFO")
                    .arg(section)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;
                Ok(info)
            }
        }
    }

    /// Execute a transaction (MULTI/EXEC)
    pub async fn execute_transaction(
        &self,
        commands: Vec<String>,
    ) -> Result<TransactionResult, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                redis::cmd("MULTI")
                    .query_async::<()>(&mut *c)
                    .await
                    .map_err(Self::format_error)?;

                let mut results = Vec::new();

                for cmd_str in &commands {
                    let parts: Vec<&str> = cmd_str.split_whitespace().collect();
                    if !parts.is_empty() {
                        let cmd_name = parts[0].to_uppercase();
                        let mut cmd = redis::cmd(&cmd_name);
                        for arg in &parts[1..] {
                            cmd.arg(*arg);
                        }
                        let _: () = cmd.query_async(&mut *c).await.map_err(Self::format_error)?;
                    }
                }

                let exec_result: redis::Value = redis::cmd("EXEC")
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;

                if let redis::Value::Array(arr) = exec_result {
                    for val in arr {
                        results.push(redis_value_to_json(&val));
                    }
                }

                Ok(TransactionResult {
                    results,
                    success: true,
                })
            }
            RedisConnection::Cluster(_) => Err(ProviderError::new(
                "Transactions are not supported in Redis Cluster mode",
            )
            .with_hint("Use pipelines instead.")),
        }
    }

    /// Execute a pipeline of commands
    pub async fn execute_pipeline(
        &self,
        commands: Vec<String>,
    ) -> Result<PipelineResult, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let mut pipe = redis::Pipeline::new();

                for cmd_str in &commands {
                    let parts: Vec<&str> = cmd_str.split_whitespace().collect();
                    if !parts.is_empty() {
                        let cmd_name = parts[0].to_uppercase();
                        let mut cmd = redis::cmd(&cmd_name);
                        for arg in &parts[1..] {
                            cmd.arg(*arg);
                        }
                        pipe.add_command(cmd);
                    }
                }

                let results: Vec<redis::Value> = pipe
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;

                let json_results: Vec<serde_json::Value> =
                    results.iter().map(redis_value_to_json).collect();

                Ok(PipelineResult {
                    results: json_results,
                    errors: Vec::new(),
                })
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let mut pipe = redis::Pipeline::new();

                for cmd_str in &commands {
                    let parts: Vec<&str> = cmd_str.split_whitespace().collect();
                    if !parts.is_empty() {
                        let cmd_name = parts[0].to_uppercase();
                        let mut cmd = redis::cmd(&cmd_name);
                        for arg in &parts[1..] {
                            cmd.arg(*arg);
                        }
                        pipe.add_command(cmd);
                    }
                }

                let results: Vec<redis::Value> = pipe
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;

                let json_results: Vec<serde_json::Value> =
                    results.iter().map(redis_value_to_json).collect();

                Ok(PipelineResult {
                    results: json_results,
                    errors: Vec::new(),
                })
            }
        }
    }

    /// Get slow log entries
    pub async fn get_slowlog(&self, count: i64) -> Result<QueryResult, ProviderError> {
        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                let entries: Vec<Vec<redis::Value>> = redis::cmd("SLOWLOG")
                    .arg("GET")
                    .arg(count)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;

                let mut rows = Vec::new();
                for entry in entries {
                    if entry.len() >= 4 {
                        let id = redis_value_to_json(&entry[0]);
                        let timestamp = redis_value_to_json(&entry[1]);
                        let duration = redis_value_to_json(&entry[2]);
                        let command = if let redis::Value::Array(cmd_parts) = &entry[3] {
                            let parts: Vec<String> = cmd_parts
                                .iter()
                                .filter_map(|v| {
                                    if let redis::Value::BulkString(bytes) = v {
                                        String::from_utf8(bytes.clone()).ok()
                                    } else {
                                        None
                                    }
                                })
                                .collect();
                            serde_json::Value::String(parts.join(" "))
                        } else {
                            serde_json::Value::Null
                        };

                        rows.push(vec![id, timestamp, duration, command]);
                    }
                }

                Ok(QueryResult {
                    columns: vec![
                        "id".to_string(),
                        "timestamp".to_string(),
                        "duration_us".to_string(),
                        "command".to_string(),
                    ],
                    row_count: rows.len(),
                    rows,
                })
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                let entries: Vec<Vec<redis::Value>> = redis::cmd("SLOWLOG")
                    .arg("GET")
                    .arg(count)
                    .query_async(&mut *c)
                    .await
                    .map_err(Self::format_error)?;

                let mut rows = Vec::new();
                for entry in entries {
                    if entry.len() >= 4 {
                        let id = redis_value_to_json(&entry[0]);
                        let timestamp = redis_value_to_json(&entry[1]);
                        let duration = redis_value_to_json(&entry[2]);
                        let command = if let redis::Value::Array(cmd_parts) = &entry[3] {
                            let parts: Vec<String> = cmd_parts
                                .iter()
                                .filter_map(|v| {
                                    if let redis::Value::BulkString(bytes) = v {
                                        String::from_utf8(bytes.clone()).ok()
                                    } else {
                                        None
                                    }
                                })
                                .collect();
                            serde_json::Value::String(parts.join(" "))
                        } else {
                            serde_json::Value::Null
                        };

                        rows.push(vec![id, timestamp, duration, command]);
                    }
                }

                Ok(QueryResult {
                    columns: vec![
                        "id".to_string(),
                        "timestamp".to_string(),
                        "duration_us".to_string(),
                        "command".to_string(),
                    ],
                    row_count: rows.len(),
                    rows,
                })
            }
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

        // Handle special commands
        match cmd_name.as_str() {
            "MULTI" => {
                return Err(ProviderError::new(
                    "Use execute_transaction() for MULTI/EXEC transactions",
                ));
            }
            "EXEC" | "DISCARD" => {
                return Err(ProviderError::new(
                    "Use execute_transaction() for MULTI/EXEC transactions",
                ));
            }
            _ => {}
        }

        match &self.conn {
            RedisConnection::Single(conn) => {
                let mut c = conn.lock().await;
                Self::execute_command_internal_single(&mut *c, &cmd_name, args).await
            }
            RedisConnection::Cluster(conn) => {
                let mut c = conn.lock().await;
                Self::execute_command_internal_cluster(&mut *c, &cmd_name, args).await
            }
        }
    }

    async fn execute_command_internal_single(
        conn: &mut ConnectionManager,
        cmd_name: &str,
        args: &[&str],
    ) -> Result<QueryResult, ProviderError> {
        let mut cmd = redis::cmd(cmd_name);
        for arg in args {
            cmd.arg(*arg);
        }

        let result: redis::Value = cmd
            .query_async(conn)
            .await
            .map_err(RedisProvider::format_error)?;

        format_command_result(result)
    }

    async fn execute_command_internal_cluster(
        conn: &mut ClusterConnection,
        cmd_name: &str,
        args: &[&str],
    ) -> Result<QueryResult, ProviderError> {
        let mut cmd = redis::cmd(cmd_name);
        for arg in args {
            cmd.arg(*arg);
        }

        let result: redis::Value = cmd
            .query_async(conn)
            .await
            .map_err(RedisProvider::format_error)?;

        format_command_result(result)
    }
}

fn format_command_result(result: redis::Value) -> Result<QueryResult, ProviderError> {
    let json_value = redis_value_to_json(&result);

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

#[async_trait]
impl DatabaseProvider for RedisProvider {
    fn database_type(&self) -> DatabaseType {
        DatabaseType::Redis
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, ProviderError> {
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

        let total_keys = self.db_size().await?;

        let mut tables: Vec<TableInfo> = prefix_counts
            .into_iter()
            .map(|(prefix, count)| TableInfo {
                schema: "db0".to_string(),
                name: prefix,
                row_count: count,
            })
            .collect();

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
                name: "size".to_string(),
                data_type: "integer".to_string(),
                is_nullable: true,
                is_primary_key: false,
                has_default: false,
            },
            ColumnInfo {
                name: "encoding".to_string(),
                data_type: "string".to_string(),
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
        let pattern = if table == "*" {
            "*".to_string()
        } else {
            table.to_string()
        };

        let all_keys = self.scan_keys(&pattern, (offset + limit) as usize).await?;
        let keys: Vec<String> = all_keys
            .into_iter()
            .skip(offset as usize)
            .take(limit as usize)
            .collect();

        let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();

        for key in keys {
            let key_type = self.get_key_type(&key).await?;
            let ttl = self.get_key_ttl(&key).await?;
            let size = self.get_key_size(&key).await.unwrap_or(0);
            let encoding = self.get_key_encoding(&key).await.unwrap_or_default();
            let value = self.get_value(&key, &key_type).await?;

            let ttl_value = if ttl == -1 {
                serde_json::Value::Null
            } else if ttl == -2 {
                serde_json::Value::String("expired".to_string())
            } else {
                serde_json::Value::Number(ttl.into())
            };

            rows.push(vec![
                serde_json::Value::String(key),
                serde_json::Value::String(key_type),
                ttl_value,
                serde_json::Value::Number(size.into()),
                serde_json::Value::String(encoding),
                value,
            ]);
        }

        Ok(QueryResult {
            columns: vec![
                "key".to_string(),
                "type".to_string(),
                "ttl".to_string(),
                "size".to_string(),
                "encoding".to_string(),
                "value".to_string(),
            ],
            row_count: rows.len(),
            rows,
        })
    }

    async fn execute_query(&self, query: &str) -> Result<QueryResult, ProviderError> {
        let trimmed = query.trim();
        let commands: Vec<&str> = trimmed.lines().filter(|l| !l.trim().is_empty()).collect();

        if commands.is_empty() {
            return Err(ProviderError::new("No command provided"));
        }

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
            self.db_size().await
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
