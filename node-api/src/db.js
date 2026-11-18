import mysql from "mysql2/promise";

export function createPool(settings) {
  return mysql.createPool({
    ...settings,
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    // DATE/DATETIME dikembalikan sebagai string 'YYYY-MM-DD HH:MM:SS' seperti PDO.
    dateStrings: true,
  });
}

export async function withTransaction(pool, work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}
