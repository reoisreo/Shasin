const API_BASE = "http://localhost:3000";

// Dropdown search
const searchInput=document.getElementById("modalSetInput");
const partContainer=document.getElementById("modalPartsGrid");
let SELECTED_SET=null;
let ALL_SETS=[];
let CURRENT_PARTS=[];
let CURRENT_SET_ID=null;
let EDITING_SET=null;
let EDITING_MEMBER_SET_ID=null;
let EDITING_SET_CODE=null;
let EDIT_PARTS=[];
let MAIN_CARD_REFS=[];
let RESIZE_TIMER=null;
let VIEWING_SET = null; // Currently viewing set in modal
let IS_EDIT_MODE = false; // Whether view modal is in edit mode

const MAIN_THUMB_W = 168; // should match .main-part-image width
const MAIN_GRID_GAP = 14; // should match .main-parts-grid gap

function neededWidthForThumbs(n){
    if(n<=0) return 0;
    return (n * MAIN_THUMB_W) + ((n - 1) * MAIN_GRID_GAP);
}

function approxCardInnerWidth(){
    // Use viewport-based approximation so behavior is stable across mode switches
    // Card is 90% width with max 960px, padding is 20px on each side (40px total)
    const cardW = Math.min(window.innerWidth * 0.9, 960);
    return Math.max(0, cardW - 40);
}

function getActualCardWidth(cardElement){
    // Main page is always simplified, cards are fixed at 224px
    if(cardElement){
        const rect = cardElement.getBoundingClientRect();
        return rect.width - 28; // simplified padding is 14px each side (28px total)
    }
    return 224 - 28; // simplified card width minus padding
}

function selectPartsForMain(set, cardElement){
    const total = Number(set.setTotal || set.setTotal === 0 ? set.setTotal : (set.parts?.length || 0));
    const sorted = [...(set.parts || [])].sort((a,b)=>Number(a.number)-Number(b.number));
    const avail = getActualCardWidth(cardElement);

    // 8-set: always 4-4 (2 rows) when possible; if too narrow for 4 columns show only R (part #4)
    if(total === 8){
        if(avail >= neededWidthForThumbs(4)) return { parts: sorted, columns: 4 };
        return { parts: sorted.filter(p=>Number(p.number)===4), columns: 1 };
    }

    // 5-set: one row if possible; if too narrow show first 3 (ヒキ/チュウ/ヨリ); if too narrow for 3 show ヨリ (#3)
    if(total === 5){
        if(avail >= neededWidthForThumbs(5)) return { parts: sorted, columns: 5 };
        if(avail >= neededWidthForThumbs(3)) return { parts: sorted.filter(p=>Number(p.number)<=3), columns: 3 };
        return { parts: sorted.filter(p=>Number(p.number)===3), columns: 1 };
    }

    // 4-set: one row if possible; if too narrow show C (#3)
    if(total === 4){
        if(avail >= neededWidthForThumbs(4)) return { parts: sorted, columns: 4 };
        return { parts: sorted.filter(p=>Number(p.number)===3), columns: 1 };
    }

    // 3-set: one row if possible; if too narrow show ヨリ (#3)
    if(total === 3){
        if(avail >= neededWidthForThumbs(3)) return { parts: sorted, columns: 3 };
        return { parts: sorted.filter(p=>Number(p.number)===3), columns: 1 };
    }

    // fallback: just render all, let it wrap
    return { parts: sorted, columns: Math.min(sorted.length, 4) || 1 };
}
let set3=["ヒキ","チュウ","ヨリ"];
let set4=["A","B","C","D"];
let set5=["ヒキ","チュウ","ヨリ","レア1","レア2"];
let set8=["ヒキ","チュウ","ヨリ","R","ヒキSR","チュウSR","ヨリSR","RSR"];

function setcase(i){
    const num = Number(i);
    switch(num){
        case 3:
            return set3;
        case 4:
            return set4;
        case 5:
            return set5;
        case 8:
            return set8;
        default:
            console.warn(`Unknown setTotal: ${i}, defaulting to empty array`);
            return []; 
    }
}

function resetAddSetModal(){
    searchInput.value="";
    SELECTED_SET=null;
    CURRENT_PARTS=[];
    CURRENT_SET_ID=null;
    partContainer.innerHTML="";
    document.getElementById("partsSection").classList.add("hidden");
}

function resetEditModal(){
    EDITING_MEMBER_SET_ID=null;
    EDITING_SET_CODE=null;
    EDIT_PARTS=[];
    const grid=document.getElementById("editPartsGrid");
    if(grid)grid.innerHTML="";
    const display=document.getElementById("editSetDisplay");
    if(display)display.value="";
}

async function loadDropdownData() {
    const res=await fetch(`${API_BASE}/api/sets`);
    ALL_SETS=await res.json();

    const dataList=document.getElementById("setList");
    dataList.innerHTML="";

    ALL_SETS.forEach(s=>{
        const option=document.createElement("option");
        option.value=s.setName;
        dataList.appendChild(option);
    });
}

async function searchSets(query) {
    const res=await fetch(`${API_BASE}/api/sets/search?q=${encodeURIComponent(query)}`);
    return await res.json();
}

searchInput.addEventListener("input", async()=>{
    const inputVal = searchInput.value.trim();
    if(!inputVal)return;
    SELECTED_SET = ALL_SETS.find(s => inputVal===s.setName);
    
    if (SELECTED_SET) {
        await loadParts(SELECTED_SET.id);
        document.getElementById("partsSection").classList.remove("hidden");
    }
});

// Part loading
async function loadParts(setId) {
    const set = ALL_SETS.find(s => s.id === setId);
    if (!set) return;

    SELECTED_SET = set;

    const partGrid = document.getElementById("modalPartsGrid");
    partGrid.innerHTML = "";
    document.getElementById("partsSection").classList.remove("hidden");

    // Fetch parts from backend (so we have real IDs)
    const res = await fetch(`${API_BASE}/api/setPartsModal/${setId}`);
    const partsFromDb = await res.json();

    let CURRENT_SET=setcase(set.setTotal);
    CURRENT_SET_ID=partsFromDb.length? partsFromDb[0].memberSetId:null;
    const setTotalNum = Number(set.setTotal || 0);
    
    if(partsFromDb.length>0){
        CURRENT_PARTS = partsFromDb.map(p => ({
            id: p.id,
            partNumber: p.partNumber,
            partName: p.partName,
            partCount: p.partCount
        }));
        // If we have parts in DB but fewer than expected, add missing ones
        if(partsFromDb.length < setTotalNum && CURRENT_SET.length >= setTotalNum){
            const existingNumbers = new Set(partsFromDb.map(p => Number(p.partNumber)));
            for(let i=1;i<=setTotalNum;i++){
                if(!existingNumbers.has(i)){
                    CURRENT_PARTS.push({
                        id: null,
                        partNumber: `${i}`,
                        partName: CURRENT_SET[i-1] || `Part ${i}`,
                        partCount: 0
                    });
                }
            }
            // Sort by part number
            CURRENT_PARTS.sort((a,b)=>Number(a.partNumber)-Number(b.partNumber));
        }
    }else{
        CURRENT_PARTS=[];
        if(CURRENT_SET && CURRENT_SET.length >= setTotalNum){
            for(let i=1;i<=setTotalNum;i++){
                CURRENT_PARTS.push({
                    id: null,
                    partNumber: `${i}`,
                    partName: CURRENT_SET[i-1] || `Part ${i}`,
                    partCount: 0
                });
            }
        }else{
            console.error(`Set ${set.setName} (${set.setId}): setTotal is ${setTotalNum} but setcase returned array of length ${CURRENT_SET?.length || 0}`);
            // Fallback: create generic parts
            for(let i=1;i<=setTotalNum;i++){
                CURRENT_PARTS.push({
                    id: null,
                    partNumber: `${i}`,
                    partName: `Part ${i}`,
                    partCount: 0
                });
            }
        }
    }

    renderParts();
}

// Part rendering
function renderParts(){
    partContainer.innerHTML="";
    CURRENT_PARTS.forEach((part,idx)=>{
        const wrap=document.createElement("div");
        wrap.className="part-item";

        const imgHolder=document.createElement("div");
        imgHolder.className="part-image";
        imgHolder.classList.add("placeholder");

        const fileInput=document.createElement("input");
        fileInput.type="file";
        fileInput.accept="image/*";
        fileInput.className="part-file-input";
        fileInput.dataset.index=idx;
        imgHolder.addEventListener("click",()=>{
            fileInput.click();
        });
        fileInput.addEventListener("change",()=>{
            const file=fileInput.files[0];
            if(!file)return;
            part.imageFile=file;
            const reader=new FileReader();
            reader.onload=()=>{
                imgHolder.innerHTML="";
                imgHolder.classList.remove("placeholder");
                const img=document.createElement("img");
                img.src=reader.result;
                imgHolder.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
        wrap.appendChild(imgHolder);
        wrap.appendChild(fileInput);

        const name=document.createElement("div");
        name.className="part-name";
        name.textContent=part.partName;
        wrap.appendChild(name);

        const counter=document.createElement("div");
        counter.className="part-counter";

        const minusBtn=document.createElement("button");
        minusBtn.textContent="-";

        const num=document.createElement("span");
        num.textContent=part.partCount;
        num.className="part-total";

        const plusBtn=document.createElement("button");
        plusBtn.textContent="+";

        minusBtn.addEventListener("click", async()=>{
            const newVal=Math.max(0,part.partCount-1);
            if(part.id){await updatePart(part.id,newVal);}
            part.partCount=newVal;
            num.textContent=newVal;
        });
        
        plusBtn.addEventListener("click", async()=>{
            const newVal=part.partCount+1;
            if(part.id){await updatePart(part.id,newVal);}
            part.partCount=newVal;
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
async function updatePart(partId, partCount){
    if(!CURRENT_SET_ID)return;
    await fetch(`${API_BASE}/api/setParts/update`,{
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({memberSetId:CURRENT_SET_ID, partId, partCount})
    });
}

function renderEditParts(){
    const grid=document.getElementById("viewPartsGrid");
    grid.innerHTML="";
    
    // In edit mode, use the same layout as view mode
    const total = EDIT_PARTS.length;
    let cols = total === 8 ? 4 : total;
    grid.style.gridTemplateColumns = `repeat(${cols}, ${MAIN_THUMB_W}px)`;
    grid.style.justifyContent = "center";
    grid.style.gap = `${MAIN_GRID_GAP}px`;

    EDIT_PARTS.forEach((part, idx)=>{
        const wrap=document.createElement("div");
        wrap.className="part-item";

        const imgHolder=document.createElement("div");
        imgHolder.className="part-image";
        if(part.imagePath){
            const img=document.createElement("img");
            img.src=`/images/${part.imagePath}`;
            img.alt=part.partName || "";
            img.loading="lazy";
            imgHolder.appendChild(img);
        }else{
            imgHolder.classList.add("placeholder");
        }

        const fileInput=document.createElement("input");
        fileInput.type="file";
        fileInput.accept="image/*";
        fileInput.className="part-file-input";
        fileInput.dataset.index=idx;
        imgHolder.addEventListener("click",()=>{
            fileInput.click();
        });
        fileInput.addEventListener("change",()=>{
            const file=fileInput.files[0];
            if(!file)return;
            part.imageFile=file;
            const reader=new FileReader();
            reader.onload=()=>{
                imgHolder.innerHTML="";
                imgHolder.classList.remove("placeholder");
                const img=document.createElement("img");
                img.src=reader.result;
                imgHolder.appendChild(img);
            };
            reader.readAsDataURL(file);
        });

        wrap.appendChild(imgHolder);
        wrap.appendChild(fileInput);

        const name=document.createElement("div");
        name.className="part-name";
        name.textContent=part.partName;
        wrap.appendChild(name);

        const counter=document.createElement("div");
        counter.className="part-counter";

        const minusBtn=document.createElement("button");
        minusBtn.textContent="-";

        const num=document.createElement("span");
        num.textContent=part.partCount;
        num.className="part-total";

        const plusBtn=document.createElement("button");
        plusBtn.textContent="+";

        minusBtn.addEventListener("click", ()=>{
            const newVal=Math.max(0,Number(part.partCount||0)-1);
            part.partCount=newVal;
            num.textContent=newVal;
        });
        plusBtn.addEventListener("click", ()=>{
            const newVal=Number(part.partCount||0)+1;
            part.partCount=newVal;
            num.textContent=newVal;
        });

        counter.appendChild(minusBtn);
        counter.appendChild(num);
        counter.appendChild(plusBtn);
        wrap.appendChild(counter);

        grid.appendChild(wrap);
    });
}

function openViewModal(set){
    VIEWING_SET = set;
    IS_EDIT_MODE = false;
    
    const titleEl=document.getElementById("viewSetTitle");
    const codeEl=document.getElementById("viewSetCode");
    if(titleEl)titleEl.textContent=set.setName;
    if(codeEl)codeEl.textContent=set.setId;
    
    // Show view mode, hide edit buttons
    document.getElementById("editModalButtons").classList.add("hidden");
    document.getElementById("viewModalMenuBtn").classList.remove("hidden");
    
    renderViewParts(set);
    document.getElementById("viewModal").classList.remove("hidden");
}

function switchToEditMode(){
    if(!VIEWING_SET) return;
    IS_EDIT_MODE = true;
    
    EDITING_MEMBER_SET_ID=VIEWING_SET.memberSetId;
    EDITING_SET_CODE=VIEWING_SET.setId;
    
    EDIT_PARTS = (VIEWING_SET.parts||[]).map(p=>({
        partId: p.partId,
        partNumber: p.number,
        partName: p.partName,
        partCount: Number(p.partCount||0),
        imagePath: p.imagePath || null,
        imageFile: null
    }));
    
    // Hide menu button, show edit buttons
    document.getElementById("viewModalMenuBtn").classList.add("hidden");
    document.getElementById("editModalButtons").classList.remove("hidden");
    
    renderEditParts();
}

function renderViewParts(set){
    const grid=document.getElementById("viewPartsGrid");
    grid.innerHTML="";
    
    const total = Number(set.setTotal || set.setTotal === 0 ? set.setTotal : (set.parts?.length || 0));
    const sorted = [...(set.parts || [])].sort((a,b)=>Number(a.number)-Number(b.number));
    
    // Determine columns: 8-set = 4, others = total (3,4,5)
    let cols = total === 8 ? 4 : total;
    
    grid.style.gridTemplateColumns = `repeat(${cols}, ${MAIN_THUMB_W}px)`;
    grid.style.justifyContent = "center";
    grid.style.gap = `${MAIN_GRID_GAP}px`;
    
    sorted.forEach(p=>{
        grid.appendChild(buildMainPartElement(p));
    });
}

function openEditModal(set){
    // Legacy function - now redirects to view modal in edit mode
    openViewModal(set);
    switchToEditMode();
}

// List loading
async function loadAllSets() {
    const res=await fetch(`${API_BASE}/api/memberSets`);
    return await res.json();
}

function representativePartNumberForSet(total){
    // Simplified mode: pick a single "representative" part
    // 8-set: R (#4), 4-set: C (#3), 3/5-set: ヨリ (#3)
    if(total === 8) return 4;
    if(total === 4) return 3;
    if(total === 3) return 3;
    if(total === 5) return 3;
    return null;
}

function buildMainPartElement(p){
    const wrap=document.createElement("div");
    wrap.className="main-part "+(p.partCount>0? "owned":"missing");

    const imgwrap=document.createElement("div");
    imgwrap.className="main-part-image";
    if(p.imagePath){
        const img=document.createElement("img");
        img.src=`/images/${p.imagePath}`;
        img.alt=p.partName;
        img.loading="lazy";
        imgwrap.appendChild(img);
    }else imgwrap.textContent="";

    const name=document.createElement("div");
    name.className="main-part-name";
    name.textContent=p.partName;
    wrap.appendChild(imgwrap);
    wrap.appendChild(name);
    return wrap;
}

function applyMainGridLayout(card,set){
    const partsGrid=card.querySelector(".main-parts-grid");
    if(!partsGrid)return;
    const total = Number(set.setTotal || set.setTotal === 0 ? set.setTotal : (set.parts?.length || 0));
    // Always show simplified view (single representative part)
    const repNum = representativePartNumberForSet(total);
    const sortedAll = [...(set.parts || [])].sort((a,b)=>Number(a.number)-Number(b.number));
    const rep = repNum == null ? null : sortedAll.find(p=>Number(p.number)===repNum);
    const renderParts = rep ? [rep] : (sortedAll.length ? [sortedAll[0]] : []);
    const cols = 1;
    
    // Set grid columns
    partsGrid.style.gridTemplateColumns = `repeat(${cols}, ${MAIN_THUMB_W}px)`;
    partsGrid.style.width = '';
    partsGrid.style.maxWidth = '';
    partsGrid.style.margin = '';
    partsGrid.innerHTML="";
    renderParts.forEach(p=>{
        partsGrid.appendChild(buildMainPartElement(p));
    });
}

async function renderSetCard(set) {
    const container=document.createElement("div");
    container.className="set-card";

    const headerRow=document.createElement("div");
    headerRow.className="set-card-header";

    const title=document.createElement("div");
    title.className="set-title-badge";
    title.textContent=set.setName;

    const code=document.createElement("div");
    code.className="set-code";
    code.textContent= set.setId;

    const partsGrid=document.createElement("div");
    partsGrid.className="main-parts-grid";

    headerRow.appendChild(title);
    container.appendChild(headerRow);
    container.appendChild(code);
    container.appendChild(partsGrid);

    // Double-click to open view modal
    container.addEventListener("dblclick", (e)=>{
        e.stopPropagation();
        openViewModal(set);
    });

    // layout will be applied after append when width is known
    return container;
}

async function init(preserveScroll = false){
    const scrollY = preserveScroll ? window.scrollY : null;
    const sets=await loadAllSets();
    MAIN_CARD_REFS = [];
    const container=document.getElementById("set-container");
    container.innerHTML="";
    for(const set of sets){
        const card=await renderSetCard(set);
        container.appendChild(card);
        MAIN_CARD_REFS.push({card,set});
        applyMainGridLayout(card,set);
    }
    // Restore scroll position if requested
    if(preserveScroll && scrollY !== null){
        requestAnimationFrame(()=>{
            window.scrollTo(0, scrollY);
        });
    }
}
init().then(()=>loadDropdownData());

// Always use simplified view for main page
document.body.classList.add("simplified");

window.addEventListener("resize", ()=>{
    if(RESIZE_TIMER) clearTimeout(RESIZE_TIMER);
    RESIZE_TIMER = setTimeout(()=>{
        MAIN_CARD_REFS.forEach(ref=>{
            applyMainGridLayout(ref.card, ref.set);
        });
    }, 200);
});

// Modal
const modal=document.getElementById("modal");
const modalContent=modal.querySelector(".modal-content");
document.getElementById("openModalBtn").onclick=async()=>{
    modal.classList.remove("hidden");
    await loadDropdownData();
};
document.getElementById("closeModalBtn").onclick=()=>modal.classList.add("hidden");
document.getElementById("modalCloseBtn").onclick=()=>modal.classList.add("hidden");

// Click outside to close
modal.addEventListener("click",(e)=>{
    if(e.target===modal)modal.classList.add("hidden");
});
// Prevent closing when clicking inside modal-content
modalContent.addEventListener("click",(e)=>e.stopPropagation());

// View/Edit modal
const viewModal=document.getElementById("viewModal");
const viewModalContent=viewModal.querySelector(".modal-content");
document.getElementById("viewModalCloseBtn").onclick=()=>{
    viewModal.classList.add("hidden");
    resetViewModal();
};
document.getElementById("closeEditBtn").onclick=()=>{
    if(IS_EDIT_MODE){
        // Cancel edit mode, go back to view mode
        IS_EDIT_MODE = false;
        if(VIEWING_SET){
            renderViewParts(VIEWING_SET);
            document.getElementById("editModalButtons").classList.add("hidden");
            document.getElementById("viewModalMenuBtn").classList.remove("hidden");
        }
    } else {
        viewModal.classList.add("hidden");
        resetViewModal();
    }
};
document.getElementById("viewModalMenuBtn").onclick=()=>{
    switchToEditMode();
};
// Click outside to close
viewModal.addEventListener("click",(e)=>{
    if(e.target===viewModal){
        viewModal.classList.add("hidden");
        resetViewModal();
    }
});
// Prevent closing when clicking inside modal-content
viewModalContent.addEventListener("click",(e)=>e.stopPropagation());

function resetViewModal(){
    VIEWING_SET = null;
    IS_EDIT_MODE = false;
    EDITING_MEMBER_SET_ID=null;
    EDITING_SET_CODE=null;
    EDIT_PARTS=[];
    const grid=document.getElementById("viewPartsGrid");
    if(grid)grid.innerHTML="";
    const title=document.getElementById("viewSetTitle");
    if(title)title.textContent="";
    const code=document.getElementById("viewSetCode");
    if(code)code.textContent="";
    document.getElementById("editModalButtons").classList.add("hidden");
    document.getElementById("viewModalMenuBtn").classList.remove("hidden");
}

document.getElementById("saveEditBtn").addEventListener("click", async ()=>{
    if(!EDITING_MEMBER_SET_ID || !EDITING_SET_CODE){
        alert("編集するセットが見つかりません");
        return;
    }

    // 1) update counts (bulk)
    const updates=EDIT_PARTS.map(p=>({partId:p.partId, partCount:Number(p.partCount||0)}));
    await fetch(`${API_BASE}/api/setParts/bulkUpdate`,{
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({memberSetId: EDITING_MEMBER_SET_ID, updates})
    });

    // 2) upload any new images (overwrite if exists)
    const formData=new FormData();
    formData.append("setId", EDITING_SET_CODE);
    EDIT_PARTS.forEach(p=>{
        if(p.imageFile){
            const ext=p.imageFile.name.slice(p.imageFile.name.lastIndexOf("."));
            // server extracts partNumber from "(\d+)\." so we pass "01.jpg", "2.png", etc.
            const nameForServer=`${p.partNumber}${ext}`;
            formData.append("partImages", p.imageFile, nameForServer);
        }
    });
    if([...formData.keys()].includes("partImages")){
        await fetch(`${API_BASE}/api/uploadImages`,{
            method:"POST",
            body: formData
        });
    }

    viewModal.classList.add("hidden");
    resetViewModal();
    init(true); // Preserve scroll position
});

// Save button
document.getElementById("saveSetBtn").addEventListener("click",async ()=>{
    if(!SELECTED_SET){
        alert("セットを選択してください");
        return;
    }

    //collect payload
    const partsPayload=CURRENT_PARTS.map((p,idx)=>({
        partNumber: idx+1,
        partName: p.partName,
        partCount: p.partCount
    }));

    //save set
    const res=await fetch(`${API_BASE}/api/memberSets/addWithParts`,{
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
            memberId: 1,
            setId: SELECTED_SET.setId,
            parts: partsPayload
        })
    });
    await res.json();

    //upload image
    const formData=new FormData();
    formData.append("setId",SELECTED_SET.setId);
    CURRENT_PARTS.forEach(p=>{
        if(p.imageFile){
            const ext=p.imageFile.name.slice(p.imageFile.name.lastIndexOf("."));
            // server extracts partNumber from "(\d+)\." so we pass "01.jpg", "2.png", etc.
            const nameForServer=`${p.partNumber}${ext}`;
            formData.append("partImages", p.imageFile, nameForServer);
        }
    });
    await fetch(`${API_BASE}/api/uploadImages`,{
        method: "POST",
        body: formData
    });

    if(res.ok){
        console.log("Set added successfully");
        resetAddSetModal();
    }else{
        console.log("Failed to add set");
    }

    modal.classList.add("hidden");
    init(true); // Preserve scroll position
});