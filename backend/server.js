const { error } = require('console');
const express=require('express');
const app=express();
const path=require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

const sqlite3=require('sqlite3');
const db=new sqlite3.Database('./db.sqlite');

// GET hello
app.get('/api/hello',(req,res)=>{
    res.json({message:"Backend is working!"});
});

// GET all sets
app.get('/api/sets',(req,res)=>{
    db.all("SELECT * FROM sets ORDER BY releaseOrder",[],(err,rows)=>{
        if(err)return res.status(500).json({error:err.message});
        res.json(rows);
    });
});

// Add new set
app.post('/api/addSet',(req,res)=>{
    const {setId, setName,setTotal, releaseOrder, description}=req.body;
    if(!setId||!setName||!setTotal||!releaseOrder){
        return res.status(500).json({error:"Missing required fields."});
    }
    
    const sql=`
        INSERT INTO sets (setId, setName, setTotal, releaseOrder, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.run(sql,[setId,setName,setTotal,releaseOrder,description||null],function (err){
        if(err)return res.status(500).json({error:err.message});
        res.json({message: "Set added", id:this.lastID});
    });
});

// Import .csv
app.post('/api/importSets',(req,res)=>{
    const {rows}=req.body;

    if(!Array.isArray(rows)){return res.status(400).json({error:"rows[] required"});}

    const sql=`
        INSERT OR IGNORE INTO sets (setId, setName, setTotal, releaseOrder, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    const stmt=db.prepare(sql);

    for(const r of rows){
        stmt.run([
            r.setId,
            r.setName,
            r.setTotal,
            r.releaseOrder,
            r.description || null
        ]);
    }
    stmt.finalize(err=>{
        if(err)return res.status(500).json({error:err.message});
        res.json({message:"csv import completed"});
    });
});

app.get('/api/sets/search',(req,res)=>{
    const q=req.query.q||"";
    db.all(
        "SELECT * FROM sets WHERE setName LIKE ? ORDER BY releaseOrder",
        [`%${q}%`],
        (err,rows)=>{
            if(err)return res.status(500).json({error:err.message});
            res.json(rows);
        }
    );
});

app.get('/api/setParts/:setId',(req,res)=>{
    const {setId}=req.params;
    db.all(
        "SELECT * FROM set_partss WHERE setId = ? ORDER BY id",
        [setId],
        (err,rows)=>{
            if(err)return res.status(500).json({error:err.message});
            res.json(rows);
        }
    );
});

app.post('/api/setParts/update',(req,res)=>{
    const {partId,partTotal}=req.body;
    if(!partId)return res.status(400).json({error:"Missing partId"});
    db.run(
        "UPDATE set_parts SET partTotal = ? WHERE id = ?",
        [partTotal, partId],
        function(err){
            if(err)return res.status(500).json({error:err.message});
            res.json({message: "Part Updated", changes:this.changes});
        }
    );
});

app.post('/api/uploadPartImage',(req,res)=>{
    res.json({message:"Still working on this"});
});

// Start
const PORT=3000;
app.listen(PORT,()=>{
    console.log(`Server running at http://localhost:${PORT}`);
});