const API_BASE = "http://localhost:3000";

// Dropdown search
const searchInput=document.getElementById("modalSetInput");
const partContainer=document.getElementById("modalPartsRow");
let SELECTED_SET=null;
let CURRENT_PARTS=[];

async function searchSets(query) {
    const res=await fetch(`${API_BASE}/api/sets/search?q=${encodeURIComponent(query)}`);
    return await res.json();
}

searchInput.addEventListener("input", async()=>{
    const q=searchInput.value.trim();
    if(!q)return;

    const results=await searchSets(q);

    if(results.length===1){
        SELECTED_SET=results[0];
        await loadParts(results[0].setId);
    }
});

// Part loading
async function loadParts(setId) {
    const res=await fetch(`${API_BASE}/api/setParts/${setId}`);
    CURRENT_PARTS=await res.json();
    renderParts();
}

// Part rendering
function renderParts(){
    partContainer.innerHTML="";
    CURRENT_PARTS.forEach(part=>{
        const wrap=document.createElement("div");
        wrap.className="part-item";

        const imgHolder=document.createElement("div");
        imgHolder.className="part-image";
        imgHolder.textContent="Image";
        wrap.appendChild(imgHolder);

        const name=document.createElement("div");
        name.className="part-name";
        name.textContent=part.partName;
        wrap.appendChild(name);

        const counter=document.createElement("div");
        counter.className="part-counter";

        const minusBtn=document.createElement("button");
        minusBtn.textContent="-";

        const num=document.createElement("span");
        num.textContent=part.partTotal;
        num.className="part-total";

        const plusBtn=document.createElement("button");
        plusBtn.textContent="+";

        minusBtn.addEventListener("click", async()=>{
            const newVal=Math.max(0,part.partTotal-1);
            await updatePart(part.id,newVal);
            part.partTotal=newVal;
            num.textContent=newVal;
        });
        
        plusBtn.addEventListener("click", async()=>{
            const newVal=part.partTotal+1;
            await updatePart(part.id,newVal);
            part.partTotal=newVal;
            num.textContent=newVal;
        });
        counter.appendChild(minusBtn);
        counter.appendChild(num);
        counter.appendChild(plusBtn);

        wrap.appendChild(counter);

        partContainer.appendChild(wrap);
    });
}

// Part updating
async function updatePart(partId, total){
    await fetch(`${API_BASE}/api/setParts/update`,{
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({partId, partTotal:total})
    });
}

// List loading
async function loadAllSets() {
    const res=await fetch(`${API_BASE}/api/sets`);
    return await res.json();
}

async function renderSetCard(set) {
    const container=document.createElement("div");
    container.className="set-card";

    const title=document.createElement("div");
    title.className="set-title";
    title.textContent=set.setName;

    const id=document.createElement("div");
    id.className="set-id";
    id.textContent= `${set.setId} - ${set.releaseOrder}`;

    const row=document.createElement("div");
    row.className="parts-row";

    const parts=await fetch(`${API_BASE}/api/setParts/${set.setId}`).then(r=>r.json());

    parts.forEach(p=>{
        const box=document.createElement("div");
        box.className="part-box";
        box.textContent=`${p.partName}(${p.partTotal})`;
        row.appendChild(box);
    });

    container.appendChild(title);
    container.appendChild(id);
    container.appendChild(row);

    return container;
}

async function init(){
    const sets=await loadAllSets();
    const container=document.getElementById("set-container");
    container.innerHTML="";
    for(const set of sets){
        const card=await renderSetCard(set);
        container.appendChild(card);
    }
}
init();

// Modal
const modal=document.getElementById("modal");
document.getElementById("openModalBtn").onclick=()=>modal.classList.remove("hidden");
document.getElementById("closeModalBtn").onclick=()=>modal.classList.add("hidden");

// Save button
document.getElementById("saveSetBtn").addEventListener("click",()=>{
    modal.classList.add("hidden");
    init();
})