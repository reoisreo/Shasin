const sqlite3=require('sqlite3').verbose();
const fs=require('fs');

const dbFile='./db.sqlite';
const schema=fs.readFileSync('./schema.sql','utf8');

const db=new sqlite3.Database(dbFile);

db.exec(schema,(err)=>{
    if(err){
        console.error("Error applying schema:",err);
    }else{
        console.log("Database initialized successfully.");
    }
    db.close();
})