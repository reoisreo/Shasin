const sqlite3=require('sqlite3').verbose();
const fs=require('fs');

const db=new sqlite3.Database('./db.sqlite');

function importCSV(csvPath){
    const raw=fs.readFileSync(csvPath,'utf8');
    const lines=raw.trim().split('\n');

    const header=lines.shift().split(',');
    const idx={
        setId: header.indexOf("setId"),
        setName: header.indexOf("setName"),
        setTotal: header.indexOf("setTotal"),
        releaseOrder: header.indexOf("releaseOrder"),
        description: header.indexOf("description")
    };

    db.serialize(()=>{
        const stmt=db.prepare(`
            INSERT OR IGNORE INTO sets (setId, setName, setTotal, releaseOrder, description)
            VALUES (?, ?, ?, ?, ?)
        `);

        for(const line of lines){
            const cols=line.split(',');
            stmt.run(
                cols[idx.setId],
                cols[idx.setName],
                Number(cols[idx.setTotal]),
                Number(cols[idx.releaseOrder]),
                cols[idx.description]||null
            );
        }
        stmt.finalize();
    });
    console.log("Import completed.");
}
importCSV("./data/Nagi.csv");