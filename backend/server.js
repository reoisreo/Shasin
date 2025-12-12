const express=require('express');
const app=express();
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});
const path=require('path');
const PORT=3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());

app.get('/api/hello',(req,res)=>{
    res.json({message:"Backend is working!"});
});

const sqlite3=require('sqlite3').verbose();
const db=new sqlite3.Database('./db.sqlite');

app.get('/api/addNagi',(req,res)=>{
    db.run(
        "INSERT INTO members (name,groupName) VALUES (?, ?)",
        ["Inoue Nagi", "Nogizaka46"],
        function(err){
            if(err)return res.status(500).json({error:err.message});
            res.json({message: "Nagi added", memberId: this.lastID});
        }
    );
});

app.post('/api/addSet',(req,res)=>{
    const {memberId,setId,setName,total,releaseCode}=req.body;

    if(!memberId||!setId||!setName||!total||!releaseCode){
        return res.status(400).json({error:"Missing fields"});
    }

    const insertSql=`
        INSERT INTO sets (memberId, setId, setName, total, releaseCode)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.run(insertSql, [memberId, setId, setName, total, releaseCode],function(err){
        if(err) return res.status(500).json({error:err.message});

        const newSetId=this.lastID;
        const insertPartSql=`
            INSERT INTO parts (setId, partNumber, owned)
            VALUES (?, ?, 0)
        `;
        for(let i=1;i<=total;i++){
            db.run(insertPartSql, [newSetId, i]);
        }
        res.json({
            message:"Set added",
            setId: newSetId
        });
    });
});

app.get('/api/sets/:memberId',(req,res)=>{
    const memberId=req.params.memberId;

    const sql=`
        SELECT s.id AS setId, s.setId AS code, s.setName, s.total, s.releaseCode
        FROM sets s
        WHERE s.memberId = ?
        ORDER BY s.releaseCode
    `;
    db.all(sql,[memberId],(err,sets)=>{
        if(err)return res.status(500).json({error:err.message});
        res.json(sets);
    });
});

app.get('/api/parts/:setId',(req,res)=>{
    const setId=req.params.setId;

    const sql=`
        SELECT id, partNumber, owned
        FROM parts
        WHERE setId = ?
        ORDER BY partNumber
    `;

    db.all(sql,[setId],(err,parts)=>{
        if(err)return res.status(500).json({error:err.message});
        res.json(parts);
    });
});

app.post('/api/updatePart',(req,res)=>{
    const {partId, owned}=req.body;

    if(partId==undefined||owned==undefined){
        return res.status(400).json({error:"Missing partId or owned."});
    }
    db.run(
        "UPDATE parts SET owned = ? WHERE id = ?",
        [owned, partId],
        function(err){
            if(err)return res.status(500).json({error:err.message});
            res.json({message:"Updated."});
        }
    );
});

app.get('/api/members',(req,res)=>{
    db.all("SELECT id, name, groupName FROM members ORDER BY name",[],(err,rows)=>{
        if(err)return res.status(500).json({error:err.message});
        res.json(rows);
    });
});
app.listen(PORT,()=>{
    console.log(`Server running at http://localhost:${PORT}`)
})