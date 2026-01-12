use crate::providers::{DatabaseType, QueryResult};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::providers::{ToolDefinition, ToolParameters};

pub fn get_tool_definitions(db_type: DatabaseType) -> Vec<ToolDefinition> {
    vec![
        list_tables_tool(),
        get_table_columns_tool(db_type),
        execute_select_query_tool(db_type),
        get_table_sample_tool(db_type),
    ]
}

fn list_tables_tool() -> ToolDefinition {
    ToolDefinition {
        name: "list_tables".to_string(),
        description: "List all tables in the database. Returns table names, schemas, and approximate row counts. Use this first to understand what data is available.".to_string(),
        parameters: ToolParameters {
            param_type: "object".to_string(),
            properties: json!({}),
            required: vec![],
        },
    }
}

fn get_table_columns_tool(db_type: DatabaseType) -> ToolDefinition {
    let schema_desc = match db_type {
        DatabaseType::Postgres => "The schema name (usually 'public' for PostgreSQL)",
        DatabaseType::Mysql => "The database/schema name",
        DatabaseType::Libsql => "The schema name (always 'main' for libSQL/Turso)",
    };

    ToolDefinition {
        name: "get_table_columns".to_string(),
        description: "Get detailed column information for a specific table. Returns column names, data types, nullability, default values, and primary key status. Essential for understanding table structure before querying.".to_string(),
        parameters: ToolParameters {
            param_type: "object".to_string(),
            properties: json!({
                "schema": {
                    "type": "string",
                    "description": schema_desc
                },
                "table": {
                    "type": "string",
                    "description": "The table name to inspect"
                }
            }),
            required: vec!["schema".to_string(), "table".to_string()],
        },
    }
}

fn execute_select_query_tool(db_type: DatabaseType) -> ToolDefinition {
    let query_desc = match db_type {
        DatabaseType::Postgres => {
            "The SELECT SQL query to execute. Must be a valid PostgreSQL SELECT statement."
        }
        DatabaseType::Mysql => {
            "The SELECT SQL query to execute. Must be a valid MySQL SELECT statement."
        }
        DatabaseType::Libsql => {
            "The SELECT SQL query to execute. Must be a valid SQLite/libSQL SELECT statement."
        }
    };

    ToolDefinition {
        name: "execute_select_query".to_string(),
        description: "Execute a read-only SELECT query against the database. Returns up to 50 rows. Use LIMIT clauses for large tables. Only SELECT statements are allowed for safety.".to_string(),
        parameters: ToolParameters {
            param_type: "object".to_string(),
            properties: json!({
                "query": {
                    "type": "string",
                    "description": query_desc
                }
            }),
            required: vec!["query".to_string()],
        },
    }
}

fn get_table_sample_tool(db_type: DatabaseType) -> ToolDefinition {
    let schema_desc = match db_type {
        DatabaseType::Postgres => "The schema name (usually 'public')",
        DatabaseType::Mysql => "The database/schema name",
        DatabaseType::Libsql => "The schema name (always 'main' for libSQL/Turso)",
    };

    ToolDefinition {
        name: "get_table_sample".to_string(),
        description: "Get a quick sample of rows from a table. Useful for understanding what kind of data a table contains before writing more specific queries.".to_string(),
        parameters: ToolParameters {
            param_type: "object".to_string(),
            properties: json!({
                "schema": {
                    "type": "string",
                    "description": schema_desc
                },
                "table": {
                    "type": "string",
                    "description": "The table name to sample"
                },
                "limit": {
                    "type": "number",
                    "description": "Number of sample rows to return (default: 10, max: 100)"
                }
            }),
            required: vec!["schema".to_string(), "table".to_string()],
        },
    }
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct ListTablesArgs {}

#[derive(Debug, Deserialize)]
pub struct GetTableColumnsArgs {
    pub schema: String,
    pub table: String,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteSelectQueryArgs {
    pub query: String,
}

#[derive(Debug, Deserialize)]
pub struct GetTableSampleArgs {
    pub schema: String,
    pub table: String,
    #[serde(default = "default_sample_limit")]
    pub limit: i64,
}

fn default_sample_limit() -> i64 {
    10
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum ToolResult {
    Tables(Vec<TableSummary>),
    Columns(Vec<ColumnSummary>),
    QueryData(QueryDataResult),
    Error(ToolError),
}

#[derive(Debug, Serialize)]
pub struct TableSummary {
    pub schema: String,
    pub name: String,
    pub row_count: i64,
}

#[derive(Debug, Serialize)]
pub struct ColumnSummary {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub has_default: bool,
}

#[derive(Debug, Serialize)]
pub struct QueryDataResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub total_rows: usize,
    pub showing: usize,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
pub struct ToolError {
    pub error: String,
}

impl From<QueryResult> for QueryDataResult {
    fn from(result: QueryResult) -> Self {
        let max_rows = 50;
        let showing = result.rows.len().min(max_rows);
        let truncated = result.row_count > max_rows;

        QueryDataResult {
            columns: result.columns,
            rows: result.rows.into_iter().take(max_rows).collect(),
            total_rows: result.row_count,
            showing,
            truncated,
        }
    }
}

pub fn get_system_prompt(db_type: DatabaseType) -> String {
    let db_name = match db_type {
        DatabaseType::Postgres => "PostgreSQL",
        DatabaseType::Mysql => "MySQL",
        DatabaseType::Libsql => "libSQL/Turso",
    };

    let sql_syntax_tips = match db_type {
        DatabaseType::Postgres => {
            r#"
- Use double quotes for identifiers: "table_name", "column_name"
- Use single quotes for strings: 'value'
- Use :: for type casting: column::text
- LIMIT and OFFSET for pagination
- Use ILIKE for case-insensitive matching"#
        }
        DatabaseType::Mysql => {
            r#"
- Use backticks for identifiers: `table_name`, `column_name`
- Use single quotes for strings: 'value'
- Use CAST() for type casting: CAST(column AS CHAR)
- LIMIT and OFFSET for pagination
- Use LOWER() with LIKE for case-insensitive matching"#
        }
        DatabaseType::Libsql => {
            r#"
- Use double quotes for identifiers: "table_name", "column_name"
- Use single quotes for strings: 'value'
- Use CAST() for type casting: CAST(column AS TEXT)
- LIMIT and OFFSET for pagination
- Use LOWER() with LIKE for case-insensitive matching
- SQLite-compatible syntax (libSQL is a SQLite fork)
- No schemas - all tables are in the 'main' schema"#
        }
    };

    format!(
        r#"You are Querybuddy, an expert {db_name} assistant.

## Formatting Rules (IMPORTANT)

Always use rich markdown formatting:

- **Tables**: Display schema/column info in markdown tables:
  | Column | Type | Nullable | Default |
  |--------|------|----------|---------|
  | id | bigint | NO | auto |

- **Code**: SQL in ```sql blocks, identifiers in `backticks`
- **Lists**: Use bullet points for multiple items
- **Bold**: Key terms and column names
- **Headers**: Use ### for sections when needed

## Database: {db_name}

SQL Syntax Tips for {db_name}:
{sql_syntax_tips}

## Capabilities

✅ List tables, examine schemas, run SELECT queries, explain SQL, debug errors
❌ Cannot execute INSERT/UPDATE/DELETE (but can write examples for you to copy)

## Response Style

- Be concise and direct
- Format data nicely - never dump raw JSON
- Use tables for structured data (columns, query results)
- Suggest follow-up queries when helpful"#
    )
}

pub fn validate_select_query(query: &str) -> Result<(), String> {
    let trimmed = query.trim().to_uppercase();

    if !trimmed.starts_with("SELECT") && !trimmed.starts_with("WITH") {
        return Err(
            "Only SELECT queries (including WITH clauses) are allowed for safety".to_string(),
        );
    }

    let dangerous_patterns = [
        "INSERT ",
        "UPDATE ",
        "DELETE ",
        "DROP ",
        "TRUNCATE ",
        "ALTER ",
        "CREATE ",
        "GRANT ",
        "REVOKE ",
        "EXEC ",
        "EXECUTE ",
    ];

    for pattern in dangerous_patterns {
        if trimmed.contains(pattern) {
            return Err(format!(
                "Query contains forbidden keyword: {}",
                pattern.trim()
            ));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_select_query_valid() {
        assert!(validate_select_query("SELECT * FROM users").is_ok());
        assert!(validate_select_query("select id from users").is_ok());
        assert!(validate_select_query("WITH cte AS (SELECT 1) SELECT * FROM cte").is_ok());
        assert!(validate_select_query("  SELECT * FROM users  ").is_ok());
    }

    #[test]
    fn test_validate_select_query_invalid() {
        assert!(validate_select_query("INSERT INTO users VALUES (1)").is_err());
        assert!(validate_select_query("UPDATE users SET name = 'x'").is_err());
        assert!(validate_select_query("DELETE FROM users").is_err());
        assert!(validate_select_query("DROP TABLE users").is_err());
        assert!(validate_select_query("SELECT * FROM users; DROP TABLE users").is_err());
    }

    #[test]
    fn test_tool_definitions_postgres() {
        let tools = get_tool_definitions(DatabaseType::Postgres);
        assert_eq!(tools.len(), 4);
        assert_eq!(tools[0].name, "list_tables");
    }

    #[test]
    fn test_tool_definitions_mysql() {
        let tools = get_tool_definitions(DatabaseType::Mysql);
        assert_eq!(tools.len(), 4);

        let query_tool = tools
            .iter()
            .find(|t| t.name == "execute_select_query")
            .unwrap();
        let props = query_tool.parameters.properties.as_object().unwrap();
        let query_desc = props["query"]["description"].as_str().unwrap();
        assert!(query_desc.contains("MySQL"));
    }
}
