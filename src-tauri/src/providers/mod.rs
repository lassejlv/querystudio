pub mod libsql;
pub mod mysql;
pub mod postgres;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    #[default]
    Postgres,
    Mysql,
    Libsql,
}

impl fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DatabaseType::Postgres => write!(f, "PostgreSQL"),
            DatabaseType::Mysql => write!(f, "MySQL"),
            DatabaseType::Libsql => write!(f, "libSQL/Turso"),
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

    pub fn to_libsql_url(&self) -> (String, Option<String>) {
        match self {
            ConnectionParams::ConnectionString { connection_string } => {
                if let Some(idx) = connection_string.find("?authToken=") {
                    let url = connection_string[..idx].to_string();
                    let token = connection_string[idx + 11..].to_string();
                    (url, Some(token))
                } else if let Some(idx) = connection_string.find('#') {
                    let url = connection_string[..idx].to_string();
                    let token = connection_string[idx + 1..].to_string();
                    (url, Some(token))
                } else {
                    (connection_string.clone(), None)
                }
            }
            ConnectionParams::Parameters {
                host,
                port,
                database,
                username: _,
                password,
            } => {
                let url = if *port == 443 || *port == 0 {
                    format!("libsql://{}.{}", database, host)
                } else {
                    format!("libsql://{}.{}:{}", database, host, port)
                };
                let auth_token = if password.is_empty() {
                    None
                } else {
                    Some(password.clone())
                };
                (url, auth_token)
            }
        }
    }
}

#[async_trait]
#[allow(dead_code)]
pub trait DatabaseProvider: Send + Sync {
    fn database_type(&self) -> DatabaseType;
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
        DatabaseType::Libsql => {
            let provider = libsql::LibsqlProvider::connect(params).await?;
            Ok(Box::new(provider))
        }
    }
}
