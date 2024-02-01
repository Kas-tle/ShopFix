const sqlite3 = require('sqlite3').verbose();
import path from 'path';
import { Database } from 'sqlite3';
import { MessageType, statusMessage } from './console';

let database: any = null;

export async function databaseConnection(sqlitePath: string): Promise<Database> {
    return new Promise((resolve, reject) => {
        if (!database) {
            const databasePath = path.join(sqlitePath);
            database = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err: { message: any; }) => {
                if (err) {
                    statusMessage(MessageType.Error, `Error connecting to the database: ${err.message}`);
                    reject(err);
                }
                statusMessage(MessageType.Info, `Connected to the database`)
                resolve(database);
            });
        } else {
            resolve(database);
        }
    });
}

export async function updateRows(database: Database, table: string, whereKey: string, whereValues: (string | number | boolean | null)[], updateKeys: string[], updateValues: (string | number | boolean | null)[][]): Promise<void> {
    return new Promise((resolve, reject) => {
        const setClause = updateKeys.map((key) => `${key} = ?`).join(', ');
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereKey} = ?`;

        database.serialize(() => {
            database.run("BEGIN TRANSACTION");
            for (let i = 0; i < whereValues.length; i++) {
                const allParams = [...updateValues[i], whereValues[i]];
                database.run(sql, allParams, (err) => {
                    if (err) {
                        statusMessage(MessageType.Error, `Error updating row in table '${table}' with whereKey '${whereKey}' and whereValue '${whereValues[i]}': ${err.message}`);
                        reject(err);
                    }
                });
            }
            database.run("COMMIT", (err) => {
                if (err) {
                    statusMessage(MessageType.Error, `Error committing transaction on table '${table}': ${err.message}`);
                    reject(err);
                } else {
                    statusMessage(MessageType.Plain, `Updated ${whereValues.length} rows in table '${table}'`);
                    resolve();
                }
            });
        });
    });
}