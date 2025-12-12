const API_BASE = "http://localhost:3000";
//Utility
function getPartLabels(total){
    if(total==3)return ["ヒキ","チュウ","ヨリ"];
    if(total==4)return ["A","B","C","D"];
    if(total==5)return ["ヒキ","チュウ","ヨリ","R","SR"];
    return [];
}
//Load
async function loadSets() {
    const res=await fetch(`${API_BASE}/api/sets/1`);
    return await res.json();
}
async function loadParts(setId) {
    const res=await fetch(`${API_BASE}/api/parts/${setId}`);
    return await res.json();
}
//Update
async function updatePart(partId, owned) {
    await fetch(`${API_BASE}/api/updatePart`,{
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ partId, owned})
    });
}
async function renderSetCard(set){
    const container=document.createElement("div");
    container.className="set-card";

    const title=document.createElement("div");
    title.className="set-title";
    title.textContent=set.setName;

    const id=document.createElement("div");
    id.className="set-id";
    id.textContent= `${set.setId} - ${set.releaseCode}`;

    const partsRow=document.createElement("div");
    partsRow.className="parts-row";

    const labels=getPartLabels(set.total);

    const parts=await loadParts(set.setId);

    for(let i=0;i<parts.length;i++){
        const p=parts[i];

        const box=document.createElement("div");
        box.className="part-box "+(p.owned? "part-owned":"part-missing");
        box.textContent=labels[i];

        box.addEventListener("click",async()=>{
            const newOwned=p.owned? 0:1;
            await updatePart(p.id,newOwned);
            p.owned=newOwned;
            box.className="part-box "+(newOwned?"part-owned":"part-missing");
        });
        partsRow.appendChild(box);
    }
    container.appendChild(title);
    container.appendChild(id);
    container.appendChild(partsRow);

    return container;
}

async function init(params) {
    const sets=await loadSets();

    const container=document.getElementById("set-container");
    container.innerHTML="";

    for(const set of sets){
        const card=await renderSetCard(set);
        container.appendChild(card);
    }
}

init();

//Modal
const modal=document.getElementById("modal");
const openModalBtn=document.getElementById("openModalBtn");
const closeModalBtn=document.getElementById("closeModalBtn");
const saveSetBtn=document.getElementById("saveSetBtn");

openModalBtn.addEventListener("click",()=>{modal.classList.remove("hidden");});
closeModalBtn.addEventListener("click", ()=>{modal.classList.add("hidden");});

//New Set
saveSetBtn.addEventListener("click", async()=>{
    const setName=document.getElementById("modalSetName").value;
    const setId=document.getElementById("modalSetID").value;
    const total=parseInt(document.getElementById("modalTotal").value);
    const year=document.getElementById("modalYear").value;
    const month=document.getElementById("modalMonth").value;
    const index=document.getElementById("modalIndex").value;

    const releaseCode=`${year}-${String(month).padStart(2,'0')}-${index}`;

    const res=await fetch(`${API_BASE}/api/addSet`,{
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
            memberId: 1,
            setId: setId,
            setName: setName,
            total: total,
            releaseCode: releaseCode
        })
    });
    modal.classList.add("hidden");
    init();
})