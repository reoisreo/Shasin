const { error } = require('console');
const express=require('express');
const multer=require('multer');
const fs=require('fs');
const app=express();
const path=require('path');

const upload=multer({
    storage: multer.diskStorage({
        destination: (req,file,cb)=>{
            const dir=path.join(__dirname,'public/images');
            if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});
            cb(null,dir);
        },
        filename: (req,file,cb)=>{
            cb(null,file.originalname);
        }
    }),
    fileFilter:(req,file,cb)=>{
        if(!file.mimetype.startsWith('image/'))return cb(new Error('Not an image'),false);
        cb(null,true);
    }
});

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

// GET owned
app.get('/api/memberSets',(req,res)=>{
    const memberId=1;
    db.all(`
        SELECT ms.id AS memberSetId, s.id AS setDbId, s.setId AS setCode, s.setName, s.setTotal, s.releaseOrder, s.description, p.id AS partId, p.partNumber, p.partName, p.imagePath, msp.partCount
        FROM member_sets ms
        JOIN sets s ON ms.setId = s.id
        JOIN member_set_parts msp ON msp.memberSetId = ms.id
        JOIN parts p ON p.id = msp.partId
        WHERE ms.memberId = ?
        ORDER BY s.releaseOrder, p.partNumber
    `, [memberId], (err,rows)=>{
        if(err)return res.status(500).json({error:err.message});
        const map={};
        for(const r of rows){
            if(!map[r.memberSetId]){
                map[r.memberSetId]={
                    memberSetId: r.memberSetId,
                    id: r.id,
                    setDbId: r.setDbId,
                    setId: r.setCode,
                    setName: r.setName,
                    setTotal: r.setTotal,
                    releaseOrder: r.releaseOrder,
                    description: r.description,
                    parts: []
                };
            }
            map[r.memberSetId].parts.push({
                    partId: r.partId,
                    number: r.partNumber,
                    partName: r.partName,
                    imagePath: r.imagePath,
                    partCount: r.partCount
                });
        }
        const result = Object.values(map).sort((a,b)=>Number(a.releaseOrder)-Number(b.releaseOrder));
        res.json(result);
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
        "SELECT * FROM sets WHERE setName LIKE ? OR setId LIKE ? ORDER BY releaseOrder",
        [`%${q}%`, `%${q}%`],
        (err,rows)=>{
            if(err)return res.status(500).json({error:err.message});
            res.json(rows);
        }
    );
});

app.get('/api/setParts/:setId',(req,res)=>{
    db.all(
        "SELECT * FROM parts WHERE setId = ? ORDER BY partNumber",
        [req.params.setId],
        (err,rows)=>{
            if(err)return res.status(500).json({error:err.message});
            res.json(rows);
        }
    );
});

app.post('/api/setParts/update',(req,res)=>{
    const {memberSetId, partId, partCount}=req.body;
    if(memberSetId==null||partId==null||partCount==null)return res.status(400).json({error:"Missing memberSetId, partId or partCount"});
    db.run(`
        UPDATE member_set_parts
        SET partCount = ?
        WHERE memberSetId = ? AND partId = ?
        `, [partCount, memberSetId, partId],
        function(err){
            if(err)return res.status(500).json({error:err.message});
            res.json({message: "Part Updated", changes:this.changes});
        }
    );
});

// Bulk update counts for a memberSet
app.post('/api/setParts/bulkUpdate', (req, res) => {
    const { memberSetId, updates } = req.body;
    if (memberSetId == null || !Array.isArray(updates)) {
        return res.status(400).json({ error: "memberSetId and updates[] required" });
    }

    const stmt = db.prepare(`
        UPDATE member_set_parts
        SET partCount = ?
        WHERE memberSetId = ? AND partId = ?
    `);

    let updated = 0;
    for (const u of updates) {
        if (u?.partId == null || u?.partCount == null) continue;
        stmt.run([u.partCount, memberSetId, u.partId], function (err) {
            if (!err) updated += this.changes || 0;
        });
    }

    stmt.finalize(err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Bulk update completed", updated });
    });
});

app.post('/api/uploadPartImage',(req,res)=>{
    res.json({message:"Still working on this"});
});

app.get('/api/setPartsModal/:setId',(req,res)=>{
    const setId=req.params.setId;
    const memberId=1;
    db.all(`
        SELECT p.id, p.partNumber, p.partName, p.imagePath, ms.id AS memberSetId, COALESCE(msp.partCount, 0) AS partCount
        FROM parts p
        LEFT JOIN member_sets ms ON ms.setId = p.setId AND ms.memberId = ?
        LEFT JOIN member_set_parts msp ON msp.memberSetId = ms.id AND msp.partId = p.id
        WHERE p.setId = ?
        ORDER BY p.partNumber
        `, [memberId, setId], (err,rows)=>{
            if(err)return res.status(500).json({error:err.message});
            res.json(rows);
        }
    );
});

// Add set to user collection
app.post('/api/memberSets/addWithParts', (req, res) => {
    const { memberId, setId, parts } = req.body;
    if (!memberId || !setId || !Array.isArray(parts)) {
        return res.status(400).json({ error: "memberId, setId and parts[] required" });
    }

    db.get(
        `SELECT id FROM sets WHERE setId = ?`,
        [setId],
        (err, row)=>{
            if(err)return res.status(500).json({error:err.message});
            if(!row)return res.status(400).json({error:"Set not found"});

            const internalSetId=row.id;

            db.run(
                `INSERT INTO member_sets (memberId, setId) VALUES (?, ?)`,
                [memberId, internalSetId],
                function (err) {
                    if(err)return res.status(500).json({ error: err.message });

                    const memberSetId = this.lastID;

                    if (parts.length === 0)return res.json({ message: "Set added, no parts to save", memberSetId });

                    // Ensure partName exists
                    const stmtParts = db.prepare(`
                        INSERT OR IGNORE INTO parts (setId, partNumber, partName)
                        VALUES (?, ?, ?)
                    `);

                for (const p of parts) {
                    const partName = p.partName || `Part ${p.partNumber}`;
                    stmtParts.run([setId, p.partNumber, partName], err => {
                        if (err) console.error("Insert part error:", err);
                    });
                }

                stmtParts.finalize(err => {
                    if(err)return res.status(500).json({ error: err.message });

                    // Fetch inserted part IDs
                    db.all(`SELECT id, partNumber FROM parts WHERE setId = ?`, [setId], (err, partsInDB) => {
                        if (err)return res.status(500).json({ error: err.message });
                        const mapNumberToId = {};
                        for (const p of partsInDB) {
                            mapNumberToId[p.partNumber] = p.id;
                        }

                        const stmt= db.prepare(`
                            INSERT INTO member_set_parts (memberSetId, partId, partCount)
                            VALUES (?, ?, ?)
                        `);

                        for (const p of parts) {
                            const partId = mapNumberToId[p.partNumber];
                            if(partId)stmt.run([memberSetId, partId, p.partCount]);
                        }

                        stmt.finalize(err => {
                            if(err)return res.status(500).json({ error: err.message });
                            res.json({ message: "Set and parts added to the collection", memberSetId });
                        });
                    });
                });
            });
        }
    );
});

app.post('/api/uploadImages', upload.array('partImages'), (req, res) => {
    const { setId } = req.body;
    if (!setId) return res.status(400).json({ error: "setId required" });

    const files = req.files;
    if (!files || files.length === 0)
        return res.status(400).json({ error: "No files uploaded" });

    db.get(
        `SELECT id FROM sets WHERE setId = ?`,
        [setId],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(400).json({ error: "Set not found" });

            const internalSetId = row.id;

            files.forEach((file, idx) => {
                const match=file.originalname.match(/(\d+)\./);
                if(!match)return;
                const partNumber = Number(match[1]);
                const ext = path.extname(file.originalname);
                const fileName = `${setId}${String(partNumber).padStart(2,'0')}${ext}`;
                const newPath = path.join(file.destination, fileName);

                // On Windows, rename() fails if destination exists; overwrite explicitly.
                if (fs.existsSync(newPath)) {
                    try { fs.unlinkSync(newPath); } catch (e) {}
                }
                fs.renameSync(file.path, newPath);

                db.run(
                    `UPDATE parts
                     SET imagePath = ?
                     WHERE setId = ? AND partNumber = ?`,
                    [fileName, setId, partNumber]
                );
            });

            res.json({ message: "Images uploaded and DB updated" });
        }
    );
});

// Start
const PORT=3000;
app.listen(PORT,()=>{
    console.log(`Server running at http://localhost:${PORT}`);
});