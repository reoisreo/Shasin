DROP TABLE IF EXISTS parts;
DROP TABLE IF EXISTS member_sets;
DROP TABLE IF EXISTS sets;  
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS member_set_parts;

CREATE TABLE members(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    groupName TEXT NOT NULL
);

CREATE TABLE sets(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setId TEXT UNIQUE NOT NULL,
    setName TEXT NOT NULL,
    setTotal INTEGER NOT NULL,
    releaseOrder INTEGER NOT NULL,
    description TEXT
);

CREATE TABLE member_sets(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberId INTEGER NOT NULL,
    setId INTEGER NOT NULL,
    FOREIGN KEY(memberId) REFERENCES members(id),
    FOREIGN KEY(setId) REFERENCES sets(id),
    UNIQUE(memberId, setId)
);

CREATE TABLE member_set_parts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memberSetId INTEGER NOT NULL,
    partId INTEGER NOT NULL,
    partCount INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(memberSetId) REFERENCES member_sets(id),
    FOREIGN KEY(partId) REFERENCES parts(id),
    UNIQUE(memberSetId, partId)
    CHECK (partCount>=0)
);

CREATE TABLE parts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setId INTEGER NOT NULL,
    partNumber INTEGER NOT NULL,
    partName TEXT NOT NULL,
    imagePath TEXT DEFAULT NULL,
    FOREIGN KEY(setId) REFERENCES sets(id),
    UNIQUE(setId, partNumber)
);