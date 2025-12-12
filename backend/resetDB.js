const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

db.serialize(() => {
    db.run("DROP TABLE IF EXISTS parts");
    db.run("DROP TABLE IF EXISTS sets");
    db.run("DROP TABLE IF EXISTS members");

    db.run(`
        CREATE TABLE members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            groupName TEXT
        )
    `);

    db.run(`
        CREATE TABLE sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memberId INTEGER,
            setId TEXT,
            setName TEXT,
            total INTEGER,
            releaseCode TEXT
        )
    `);

    db.run(`
        CREATE TABLE parts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setId INTEGER,
            partNumber INTEGER,
            owned INTEGER
        )
    `);
});
