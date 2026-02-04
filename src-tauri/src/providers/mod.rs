pub mod mongodb;
pub mod mysql;
pub mod postgres;
pub mod redis;
pub mod sqlite;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::any::Any;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    #[default]
    Postgres,
    Mysql,
    Sqlite,
    Redis,
    Mongodb,
}

impl fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DatabaseType::Postgres => write!(f, "PostgreSQL"),
            DatabaseType::Mysql => write!(f, "MySQL"),
            DatabaseType::Sqlite => write!(f, "SQLite"),
            DatabaseType::Redis => write!(f, "Redis"),
            DatabaseType::Mongodb => write!(f, "MongoDB"),
        }
    }
}

#[derive(Debug)]
pub struct ProviderError {
    pub message: String,
    pub detail: Option<String>,
    pub hint: Option<String>,
}

impl ProviderError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            detail: None,
            hint: None,
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }
}

impl fmt::Display for ProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)?;
        if let Some(detail) = &self.detail {
            write!(f, "\nDetail: {}", detail)?;
        }
        if let Some(hint) = &self.hint {
            write!(f, "\nHint: {}", hint)?;
        }
        Ok(())
    }
}

impl std::error::Error for ProviderError {}

impl From<ProviderError> for String {
    fn from(err: ProviderError) -> String {
        err.to_string()
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TableInfo {
    pub schema: String,
    pub name: String,
    pub row_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub has_default: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ConnectionParams {
    ConnectionString {
        connection_string: String,
    },
    Parameters {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: String,
    },
}

impl ConnectionParams {
    pub fn to_postgres_string(&self) -> String {
        match self {
            ConnectionParams::ConnectionString { connection_string } => connection_string.clone(),
            ConnectionParams::Parameters {
                host,
                port,
                database,
                username,
                password,
            } => format!(
                "host={} port={} dbname={} user={} password={}",
                host, port, database, username, password
            ),
        }
    }

    pub fn to_mysql_url(&self) -> String {
        match self {
            ConnectionParams::ConnectionString { connection_string } => connection_string.clone(),
            ConnectionParams::Parameters {
                host,
                port,
                database,
                username,
                password,
            } => format!(
                "mysql://{}:{}@{}:{}/{}",
                username, password, host, port, database
            ),
        }
    }

}

#[async_trait]
#[allow(dead_code)]
pub trait DatabaseProvider: Send + Sync + Any {
    fn database_type(&self) -> DatabaseType;
    fn as_any(&self) -> &dyn Any;
    async fn list_tables(&self) -> Result<Vec<TableInfo>, ProviderError>;
    async fn get_table_columns(
        &self,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ColumnInfo>, ProviderError>;
    async fn get_table_data(
        &self,
        schema: &str,
        table: &str,
        limit: i64,
        offset: i64,
    ) -> Result<QueryResult, ProviderError>;
    async fn execute_query(&self, query: &str) -> Result<QueryResult, ProviderError>;
    async fn get_table_count(&self, schema: &str, table: &str) -> Result<i64, ProviderError>;

    /// Insert a document into a collection (primarily for MongoDB)
    /// The document is a JSON object as a string
    async fn insert_document(
        &self,
        _collection: &str,
        _document: &str,
    ) -> Result<String, ProviderError> {
        Err(
            ProviderError::new("insert_document is not supported for this database type")
                .with_hint("Use SQL INSERT statements via execute_query instead."),
        )
    }

    /// Update a document in a collection (primarily for MongoDB)
    /// filter and update are JSON objects as strings
    async fn update_document(
        &self,
        _collection: &str,
        _filter: &str,
        _update: &str,
    ) -> Result<u64, ProviderError> {
        Err(
            ProviderError::new("update_document is not supported for this database type")
                .with_hint("Use SQL UPDATE statements via execute_query instead."),
        )
    }

    /// Delete a document from a collection (primarily for MongoDB)
    /// filter is a JSON object as a string
    async fn delete_document(
        &self,
        _collection: &str,
        _filter: &str,
    ) -> Result<u64, ProviderError> {
        Err(
            ProviderError::new("delete_document is not supported for this database type")
                .with_hint("Use SQL DELETE statements via execute_query instead."),
        )
    }
}

pub async fn create_provider(
    db_type: DatabaseType,
    params: ConnectionParams,
) -> Result<Box<dyn DatabaseProvider>, ProviderError> {
    match db_type {
        DatabaseType::Postgres => {
            let provider = postgres::PostgresProvider::connect(params).await?;
            Ok(Box::new(provider))
        }
        DatabaseType::Mysql => {
            let provider = mysql::MysqlProvider::connect(params).await?;
            Ok(Box::new(provider))
        }
        DatabaseType::Sqlite => {
            let provider = sqlite::SqliteProvider::connect(params).await?;
            Ok(Box::new(provider))
        }
        DatabaseType::Redis => {
            let provider = redis::RedisProvider::connect(params).await?;
            Ok(Box::new(provider))
        }
        DatabaseType::Mongodb => {
            let provider = mongodb::MongoDbProvider::connect(params).await?;
            Ok(Box::new(provider))
        }
    }
}
