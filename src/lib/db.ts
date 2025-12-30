import { Pool, PoolClient } from "pg"

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required")
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Log pool errors
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err)
})

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly query?: string
  ) {
    super(message)
    this.name = "DatabaseError"
  }
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  let client: PoolClient | null = null
  try {
    client = await pool.connect()
    const result = await client.query(text, params)
    return result.rows as T[]
  } catch (error) {
    const dbError = new DatabaseError(
      `Database query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      error instanceof Error ? error : undefined,
      text
    )
    console.error("Database error:", {
      message: dbError.message,
      query: text.substring(0, 100),
      params: params?.length,
    })
    throw dbError
  } finally {
    if (client) {
      client.release()
    }
  }
}

export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export default pool
