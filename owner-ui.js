/* Owner tools for ellyokinyo.com.
   index.html loads this file only after Firebase Auth reports a signed-in
   user (or the localhost ?owner preview). Visitors never request it, and
   none of this markup is in the served HTML. Owner panels are created only
   when the signed-in account is the owner (isOwner, checked in index.html).
   Writes still go through saveDoc, so firestore.rules stay the real guard. */
(function(){
    "use strict";
    const MARK="data-owner-ui";

    /* ---- styles that only the owner tools use ---- */
    (function injectStyle(){
        if(document.getElementById("owner-ui-style")) return;
        const st=document.createElement("style");
        st.id="owner-ui-style";
        st.textContent=
            "#owner-banner{background:rgba(250,189,47,.1);border-bottom:1px solid rgba(250,189,47,.4);color:var(--cream);font-size:13px;padding:12px 18px}"+
            "#owner-banner code{font-family:inherit;background:rgba(250,189,47,.18);padding:1px 6px;border-radius:4px;color:var(--yellow);user-select:all}"+
            "@media print{#owner-banner{display:none!important}}";
        document.head.appendChild(st);
    })();

    /* ---- markup ---- */
    const PORTFOLIO_PANEL=
        '<details class="owner-only no-print portfolio-data" '+MARK+'>'+
            '<summary>Portfolio data (not shown publicly)</summary>'+
            '<p class="draft-note">Saved on this account. The five projects above are what visitors see.</p>'+
            '<div class="owner-tools">'+
                '<span id="import-status" style="font-size:12px;color:var(--muted)"></span>'+
                '<button id="gh-import-btn" onclick="importGithub()" class="btn"><i class="fa-brands fa-github"></i> Import</button>'+
                '<button onclick="sortPortfolioRecent()" class="btn"><i class="fa-solid fa-arrow-down-wide-short"></i> Sort: recent</button>'+
                '<button id="select-btn" onclick="toggleSelectMode()" class="btn"><i class="fa-solid fa-check-double"></i> Select</button>'+
                '<button onclick="showProjectModal()" class="btn btn-accent"><i class="fa-solid fa-plus"></i> New</button>'+
            '</div>'+
            '<div id="portfolio-bulk"></div>'+
            '<div id="portfolio-owner-grid" class="grid2"></div>'+
        '</details>';
    const SUMMARY_EDIT=
        '<div class="owner-only" id="cv-summary-edit" style="margin-top:14px" '+MARK+'>'+
            '<button onclick="toggleSummaryEdit()" id="cv-summary-btn" class="btn">Edit</button>'+
        '</div>';
    const SKILL_INPUT=
        '<div class="owner-only no-print" style="margin-top:16px;display:flex;gap:10px" '+MARK+'>'+
            '<input id="skill-input" class="inp" type="text" placeholder="Add a skill, press Enter" onkeydown="if(event.key===\'Enter\')addSkill()">'+
            '<button onclick="addSkill()" class="btn">Add</button>'+
        '</div>';
    const CV_IMPORT=
        '<details class="owner-only no-print" style="margin-top:20px" '+MARK+'>'+
            '<summary style="cursor:pointer;color:var(--muted);font-size:13px">Import / restore profile (paste JSON)</summary>'+
            '<textarea id="import-json" class="inp" style="margin-top:10px;min-height:130px;font-size:12px" placeholder="Paste the profile JSON here, then press Load"></textarea>'+
            '<button onclick="importCv()" class="btn btn-accent" style="margin-top:10px">Load</button>'+
        '</details>';
    const NEW_POST_BTN='<button onclick="newPost()" class="owner-only btn" '+MARK+'><i class="fa-solid fa-plus"></i> New Post</button>';
    const MODALS=
        '<div id="project-modal" class="overlay hidden" '+MARK+'><div class="modal">'+
            '<h3 id="project-modal-title">Add Project</h3>'+
            '<input id="proj-title" class="inp" placeholder="Project title">'+
            '<textarea id="proj-desc" class="inp" placeholder="Short description"></textarea>'+
            '<input id="proj-link" class="inp" placeholder="Link (optional) — https://...">'+
            '<input id="proj-status" class="inp" placeholder="Status (optional) — e.g. Live, In progress">'+
            '<div class="row-actions"><button onclick="hideProjectModal()" class="btn">Cancel</button><button onclick="saveProject()" class="btn btn-accent">Save</button></div>'+
        '</div></div>'+
        '<div id="entry-modal" class="overlay hidden" '+MARK+'><div class="modal">'+
            '<h3 id="entry-modal-title">Add</h3>'+
            '<div id="entry-fields"></div>'+
            '<div class="row-actions"><button onclick="hideEntryModal()" class="btn">Cancel</button><button onclick="saveEntry()" class="btn btn-accent">Save</button></div>'+
        '</div></div>'+
        '<div id="blog-modal" class="overlay hidden" '+MARK+'><div class="modal" style="max-width:640px">'+
            '<h3>Write post</h3>'+
            '<input id="blog-title" class="inp" placeholder="Post title">'+
            '<select id="blog-category" class="inp" aria-label="Category"><option value="economics">Economics</option><option value="notes">Notes from Helsinki</option></select>'+
            '<div style="margin-bottom:8px"><button type="button" onclick="insertBlogImage()" class="btn" style="font-size:12px;padding:6px 12px"><i class="fa-solid fa-image"></i> Insert image</button></div>'+
            '<textarea id="blog-body" class="inp" style="min-height:280px" placeholder="Write in Markdown…"></textarea>'+
            '<p class="md-hint"><span>Markdown:</span> <code># Heading</code> <code>**bold**</code> <code>*italic*</code> <code>[link](https://…)</code> <code>- list item</code> <code>`code`</code></p>'+
            '<div class="row-actions"><button onclick="hideBlogModal()" class="btn">Cancel</button><button onclick="saveBlogPost()" class="btn btn-accent">Save</button></div>'+
        '</div></div>';
    const CV_ADD_SECTIONS=["experience","education","certifications","recommendations","languages"];

    function frag(html){ const t=document.createElement("template"); t.innerHTML=html; return t.content; }
    function mounted(){ return !!document.querySelector("["+MARK+"]"); }

    function mount(){
        if(mounted()) return;
        document.getElementById("content-1").appendChild(frag(PORTFOLIO_PANEL));
        const sv=document.getElementById("cv-summary-view");
        sv.parentNode.insertBefore(frag(SUMMARY_EDIT), sv.nextSibling);
        CV_ADD_SECTIONS.forEach(function(s){
            const list=document.getElementById("cv-"+s);
            const head=list && list.previousElementSibling;
            if(head) head.appendChild(frag('<button onclick="openEntryModal(\''+s+'\')" class="owner-only no-print btn btn-accent" '+MARK+'>+ Add</button>'));
        });
        const sk=document.getElementById("cv-skills");
        sk.parentNode.insertBefore(frag(SKILL_INPUT), sk.nextSibling);
        document.getElementById("content-2").appendChild(frag(CV_IMPORT));
        const bh=document.querySelector("#blog-list .head-row");
        if(bh) bh.appendChild(frag(NEW_POST_BTN));
        document.body.appendChild(frag(MODALS));
    }
    function unmount(){
        const a=document.querySelector(".tab-content.active");
        if(a && a.hasAttribute(MARK)) switchTab(6, {silent:true});
        document.querySelectorAll("["+MARK+"]").forEach(function(el){ el.remove(); });
        selectMode=false; selected.clear();
    }
    function syncBanner(){
        let banner=document.getElementById("owner-banner");
        if(currentUser && !isOwner){
            if(!banner){
                banner=document.createElement("div");
                banner.id="owner-banner";
                banner.appendChild(document.createTextNode("Signed in, but this account isn't the owner yet. Your user ID: "));
                const code=document.createElement("code"); code.id="uid-value"; banner.appendChild(code);
                banner.appendChild(frag(' — paste it into <code>OWNER_UID</code> and your Firestore rules, then redeploy.'));
                document.body.insertBefore(banner, document.body.firstChild);
            }
            document.getElementById("uid-value").textContent=currentUser.uid;
        } else if(banner) banner.remove();
    }
    /* Called by index.html on every auth change once this file is loaded. */
    function sync(){
        syncBanner();
        if(isOwner) mount(); else if(mounted()) unmount();
    }

    /* ---- portfolio data (collapsed owner panel) ---- */
    let selectMode=false, selected=new Set();
    function cardParts(i){
        if(!isOwner) return null;
        if(selectMode) return {
            cardOpen:'<div class="card'+(selected.has(i)?" selected":"")+'" onclick="toggleSelect('+i+')" style="cursor:pointer">',
            ctrls:'<input type="checkbox" '+(selected.has(i)?"checked":"")+' class="no-print" style="pointer-events:none">'
        };
        return { cardOpen:'<div class="card">', ctrls:'<div class="card-ctrls no-print">'+
            '<button class="icon-btn" title="Move up" onclick="moveProject('+i+',-1)"><i class="fa-solid fa-arrow-up"></i></button>'+
            '<button class="icon-btn" title="Move down" onclick="moveProject('+i+',1)"><i class="fa-solid fa-arrow-down"></i></button>'+
            '<button class="icon-btn" title="Edit" onclick="showProjectModal('+i+')"><i class="fa-solid fa-pen"></i></button>'+
            '<button class="icon-btn" title="Delete" onclick="deleteProject('+i+')"><i class="fa-solid fa-trash-can"></i></button></div>' };
    }
    function renderOwnerPortfolio(){
        const ownerGrid=document.getElementById("portfolio-owner-grid");
        const bulk=document.getElementById("portfolio-bulk");
        if(bulk){
            if(isOwner && selectMode){
                bulk.innerHTML='<div class="bulk-bar"><span>'+selected.size+' selected</span>'+
                    '<button class="btn" onclick="selectAllProjects()">'+((portfolio.length&&selected.size===portfolio.length)?"Clear all":"Select all")+'</button>'+
                    '<button class="btn" onclick="deleteSelectedProjects()"><i class="fa-solid fa-trash-can"></i> Delete selected</button>'+
                    '<button class="btn" onclick="toggleSelectMode()">Done</button></div>';
            } else bulk.innerHTML="";
        }
        if(!ownerGrid) return;
        if(!isOwner){ ownerGrid.innerHTML=""; return; }
        ownerGrid.innerHTML=portfolio.length?projectCards(portfolio,true):'<p class="empty" style="text-align:left">Nothing saved yet.</p>';
    }
    let editingProjectIndex=null;
    function showProjectModal(i){
        if(!isOwner) return;
        const editing=(typeof i==="number");
        editingProjectIndex=editing?i:null;
        document.getElementById("project-modal-title").textContent=editing?"Edit Project":"Add Project";
        const p=editing?portfolio[i]:{title:"",desc:"",link:"",status:""};
        document.getElementById("proj-title").value=p.title||"";
        document.getElementById("proj-desc").value=(p.desc==="No description"?"":(p.desc||""));
        document.getElementById("proj-link").value=p.link||"";
        document.getElementById("proj-status").value=p.status||"";
        document.getElementById("project-modal").classList.remove("hidden");
    }
    function hideProjectModal(){ const m=document.getElementById("project-modal"); if(m) m.classList.add("hidden"); editingProjectIndex=null; }
    function saveProject(){
        if(!isOwner) return;
        const title=document.getElementById("proj-title").value.trim(); if(!title)return;
        const item={title:title,desc:document.getElementById("proj-desc").value.trim()||"No description",link:document.getElementById("proj-link").value.trim(),status:document.getElementById("proj-status").value.trim()};
        if(editingProjectIndex!==null && portfolio[editingProjectIndex]) portfolio[editingProjectIndex]=item;
        else portfolio.unshift(item);
        saveDoc("public","portfolio",portfolio); renderPortfolio(); hideProjectModal();
        ["proj-title","proj-desc","proj-link","proj-status"].forEach(function(id){document.getElementById(id).value="";});
    }
    function moveProject(i,dir){
        if(!isOwner) return;
        const j=i+dir; if(j<0||j>=portfolio.length) return;
        const t=portfolio[i]; portfolio[i]=portfolio[j]; portfolio[j]=t;
        saveDoc("public","portfolio",portfolio); renderPortfolio();
    }
    function deleteProject(i){ if(!isOwner) return; if(!confirm("Delete this project?"))return; portfolio.splice(i,1); saveDoc("public","portfolio",portfolio); renderPortfolio(); }
    function toggleSelectMode(){ if(!isOwner) return; selectMode=!selectMode; selected.clear(); const b=document.getElementById("select-btn"); if(b) b.innerHTML=selectMode?'<i class="fa-solid fa-xmark"></i> Cancel':'<i class="fa-solid fa-check-double"></i> Select'; renderPortfolio(); }
    function toggleSelect(i){ if(selected.has(i)) selected.delete(i); else selected.add(i); renderPortfolio(); }
    function selectAllProjects(){ if(selected.size===portfolio.length){ selected.clear(); } else { selected=new Set(portfolio.map(function(_,i){return i;})); } renderPortfolio(); }
    function deleteSelectedProjects(){
        if(!isOwner || !selected.size) return;
        if(!confirm("Delete "+selected.size+" selected project"+(selected.size>1?"s":"")+"?")) return;
        Array.from(selected).sort(function(a,b){return b-a;}).forEach(function(i){ portfolio.splice(i,1); });
        selected.clear(); selectMode=false;
        const b=document.getElementById("select-btn"); if(b) b.innerHTML='<i class="fa-solid fa-check-double"></i> Select';
        saveDoc("public","portfolio",portfolio); renderPortfolio();
    }
    function projDate(p){ return p.updated?new Date(p.updated).getTime():Infinity; }
    function sortPortfolioRecent(){ if(!isOwner) return; selected.clear(); portfolio.sort(function(a,b){ return projDate(b)-projDate(a); }); saveDoc("public","portfolio",portfolio); renderPortfolio(); }
    async function importGithub(){
        if(!isOwner) return;
        const btn=document.getElementById("gh-import-btn"), statusEl=document.getElementById("import-status");
        const orig=btn.innerHTML; btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Importing…'; statusEl.textContent="";
        try {
            const res=await fetch("https://api.github.com/users/eokinyo/repos?sort=pushed&per_page=100");
            if(!res.ok){
                if(res.status===403) throw new Error("GitHub rate limit reached — try again shortly.");
                if(res.status===404) throw new Error("GitHub user not found.");
                throw new Error("GitHub request failed ("+res.status+").");
            }
            const repos=await res.json();
            let added=0, changed=false;
            repos.filter(function(r){ return !r.fork && !r.archived && String(r.name).toLowerCase()!=="eokinyo"; })
                 .forEach(function(r){
                    const link=r.html_url, upd=r.pushed_at||r.updated_at||"";
                    const existing=portfolio.find(function(p){return String(p.link||"").toLowerCase()===String(link).toLowerCase();});
                    if(existing){ if(existing.updated!==upd){ existing.updated=upd; changed=true; } return; }
                    portfolio.push({title:r.name,desc:r.description||"No description",link:link,status:r.language||"",updated:upd});
                    added++; changed=true;
                 });
            if(changed){ selected.clear(); portfolio.sort(function(a,b){ return projDate(b)-projDate(a); }); saveDoc("public","portfolio",portfolio); renderPortfolio(); }
            statusEl.textContent=added>0?("Imported "+added+" repo"+(added>1?"s":"")+" into Portfolio data. Visitors still see the five selected projects."):(changed?"Refreshed the saved list.":"No new repos to import.");
        } catch(e){
            statusEl.textContent=e.message||"Import failed.";
        } finally {
            btn.disabled=false; btn.innerHTML=orig;
            setTimeout(function(){ if(statusEl) statusEl.textContent=""; }, 9000);
        }
    }

    /* ---- cv editing ---- */
    function cvCtrls(section,i){
        return '<div class="card-ctrls no-print"><button class="icon-btn" title="Edit" onclick="openEntryModal(\''+section+'\','+i+')"><i class="fa-solid fa-pen"></i></button><button class="icon-btn" title="Delete" onclick="deleteCvEntry(\''+section+'\','+i+')"><i class="fa-solid fa-trash-can"></i></button></div>';
    }
    function skillDel(i){ return '<button onclick="deleteSkill('+i+')">&times;</button>'; }
    function toggleSummaryEdit(){
        if(!isOwner)return;
        const view=document.getElementById("cv-summary-view"), btn=document.getElementById("cv-summary-btn"), host=document.getElementById("cv-summary-edit");
        let input=document.getElementById("cv-summary-input"), tag=document.getElementById("cv-tagline-input");
        if(!input){
            tag=document.createElement("input");
            tag.id="cv-tagline-input"; tag.className="inp"; tag.type="text"; tag.setAttribute("aria-label","Tagline"); tag.style.marginBottom="10px";
            input=document.createElement("textarea");
            input.id="cv-summary-input"; input.className="inp"; input.setAttribute("aria-label","Professional summary");
            host.insertBefore(tag, btn); host.insertBefore(input, btn);
            input.classList.add("hidden"); tag.classList.add("hidden");
        }
        if(input.classList.contains("hidden")){
            input.value=cv.summary||""; input.classList.remove("hidden");
            tag.value=cv.tagline||"Economist · Researcher & Data Analyst"; tag.classList.remove("hidden");
            view.classList.add("hidden"); btn.textContent="Save";
        } else {
            cv.summary=input.value.trim(); cv.tagline=tag.value.trim();
            input.classList.add("hidden"); tag.classList.add("hidden");
            view.classList.remove("hidden"); btn.textContent="Edit";
            saveDoc("public","cv",cv); renderCv();
        }
    }
    const ENTRY_FIELDS = {
        experience:{label:"Experience", fields:[["role","Role / job title"],["company","Company / organisation"],["period","Period (e.g. 2024 – Present)"],["description","Short description","area"],["order","Order (optional — lower numbers show first)"]]},
        education:{label:"Education", fields:[["degree","Degree / qualification"],["school","School / institution"],["period","Period (e.g. 2019 – 2023)"],["order","Order (optional — lower numbers show first)"]]},
        certifications:{label:"Certification", fields:[["name","Certification / course name"],["issuer","Issuer"],["date","Date"],["order","Order (optional — lower numbers show first)"]]},
        recommendations:{label:"Recommendation", fields:[["title","Title (e.g. Organisation — Role)"],["detail","Detail (dates or project)"],["link","Link to letter (optional)"]]},
        languages:{label:"Language", fields:[["name","Language"],["level","Level (e.g. C2, A2, Mother tongue)"]]}
    };
    let entrySection=null, entryIndex=null;
    function openEntryModal(section, index){
        if(!isOwner) return;
        const cfg=ENTRY_FIELDS[section]; if(!cfg) return;
        entrySection=section; entryIndex=(typeof index==="number")?index:null;
        document.getElementById("entry-modal-title").textContent=(entryIndex!==null?"Edit ":"Add ")+cfg.label;
        const item=(entryIndex!==null && cv[section] && cv[section][entryIndex])?cv[section][entryIndex]:{};
        document.getElementById("entry-fields").innerHTML=cfg.fields.map(function(f){
            const key=f[0], ph=f[1], type=f[2], raw=item[key], val=escapeHtml(raw==null?"":raw);
            if(type==="area") return '<textarea id="entry-'+key+'" class="inp" placeholder="'+ph+'" style="margin-bottom:12px">'+val+'</textarea>';
            return '<input id="entry-'+key+'" class="inp" placeholder="'+ph+'" value="'+val+'" style="margin-bottom:12px">';
        }).join("");
        document.getElementById("entry-modal").classList.remove("hidden");
    }
    function hideEntryModal(){ const m=document.getElementById("entry-modal"); if(m) m.classList.add("hidden"); entrySection=null; entryIndex=null; }
    function saveEntry(){
        if(!isOwner || !entrySection) return;
        const cfg=ENTRY_FIELDS[entrySection]; const obj={}; let hasValue=false;
        cfg.fields.forEach(function(f){
            const el=document.getElementById("entry-"+f[0]); const v=el?el.value.trim():"";
            if(f[0]==="order"){
                if(!v) return;
                const n=Number(v);
                if(!isFinite(n)) return;
                obj.order=n; hasValue=true; return;
            }
            obj[f[0]]=v; if(v) hasValue=true;
        });
        if(!hasValue){ hideEntryModal(); return; }
        cv[entrySection]=cv[entrySection]||[];
        if(entryIndex!==null && cv[entrySection][entryIndex]) cv[entrySection][entryIndex]=obj;
        else cv[entrySection].push(obj);
        saveDoc("public","cv",cv); renderCv(); hideEntryModal();
    }
    function deleteCvEntry(section,i){
        if(!isOwner || !ENTRY_FIELDS[section] || !Array.isArray(cv[section])) return;
        if(!confirm("Delete this entry?")) return;
        cv[section].splice(i,1); saveDoc("public","cv",cv); renderCv();
    }
    function addSkill(){ if(!isOwner)return; const input=document.getElementById("skill-input"); const s=input.value.trim(); if(!s)return; cv.skills.push(s); saveDoc("public","cv",cv); renderCv(); input.value=""; input.focus(); }
    function deleteSkill(i){ if(isOwner){cv.skills.splice(i,1);saveDoc("public","cv",cv);renderCv();} }
    function importCv(){
        if(!isOwner) return;
        const ta=document.getElementById("import-json");
        let data;
        try { data=JSON.parse(ta.value); } catch(e){ alert("That isn't valid JSON — copy the whole block exactly as given."); return; }
        if(!data || typeof data!=="object" || Array.isArray(data)){ alert("Expected a profile object."); return; }
        cv={
            summary:data.summary||"",
            tagline:data.tagline||cv.tagline||"",
            experience:data.experience||[],
            education:data.education||[],
            skills:data.skills||[],
            certifications:data.certifications||[],
            recommendations:data.recommendations||[],
            languages:data.languages||[]
        };
        saveDoc("public","cv",cv);
        renderCv();
        ta.value="";
        alert("Profile loaded ✓");
    }

    /* ---- writing editor ---- */
    let editingSlug=null;
    function postCtrls(slug){
        return '<div class="no-print" style="display:flex;gap:10px;margin-top:22px"><button class="btn" onclick="editPost(\''+slug+'\')">Edit</button><button class="btn" onclick="deletePost(\''+slug+'\')">Delete</button></div>';
    }
    function insertBlogImage(){
        if(!isOwner) return;
        const url=prompt("Image URL (or a path in your site, e.g. img/photo.jpg):"); if(!url) return;
        const alt=prompt("Caption / alt text (optional):")||"";
        const ta=document.getElementById("blog-body");
        const snippet="\n\n!["+alt+"]("+url.trim()+")\n\n";
        const pos=(typeof ta.selectionStart==="number")?ta.selectionStart:ta.value.length;
        ta.value=ta.value.slice(0,pos)+snippet+ta.value.slice(pos);
        ta.focus();
    }
    function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""); }
    function newPost(){
        if(!isOwner)return;
        editingSlug=null;
        document.getElementById("blog-title").value="";
        document.getElementById("blog-body").value="";
        document.getElementById("blog-category").value="economics";
        document.getElementById("blog-modal").classList.remove("hidden");
    }
    function editPost(slug){
        if(!isOwner)return;
        const p=blog.find(function(x){return x.slug===slug;}); if(!p)return;
        editingSlug=slug;
        document.getElementById("blog-title").value=p.title;
        document.getElementById("blog-body").value=p.body;
        document.getElementById("blog-category").value=postCategory(p);
        document.getElementById("blog-modal").classList.remove("hidden");
    }
    function hideBlogModal(){ const m=document.getElementById("blog-modal"); if(m) m.classList.add("hidden"); }
    function saveBlogPost(){
        if(!isOwner) return;
        const title=document.getElementById("blog-title").value.trim(); if(!title)return;
        const body=document.getElementById("blog-body").value;
        const category=document.getElementById("blog-category").value==="notes"?"notes":"economics";
        if(editingSlug){ const p=blog.find(function(x){return x.slug===editingSlug;}); if(p){p.title=title;p.body=body;p.category=category;} }
        else {
            let slug=slugify(title)||("post-"+Date.now());
            if(blog.some(function(x){return x.slug===slug;})) slug=slug+"-"+Date.now().toString(36).slice(-4);
            blog.unshift({id:Date.now(),slug:slug,title:title,body:body,category:category,date:new Date().toISOString().slice(0,10)});
            editingSlug=slug;
        }
        saveDoc("public","blog",blog); hideBlogModal();
        location.hash="post/"+encodeURIComponent(editingSlug); renderBlogView();
    }
    function deletePost(slug){ if(!isOwner)return; if(!confirm("Delete this post?"))return; blog=blog.filter(function(x){return x.slug!==slug;}); saveDoc("public","blog",blog); closePost(); }

    /* Inline onclick handlers in the owner markup call these by name. */
    Object.assign(window, {
        showProjectModal:showProjectModal, hideProjectModal:hideProjectModal, saveProject:saveProject,
        moveProject:moveProject, deleteProject:deleteProject, toggleSelectMode:toggleSelectMode,
        toggleSelect:toggleSelect, selectAllProjects:selectAllProjects, deleteSelectedProjects:deleteSelectedProjects,
        sortPortfolioRecent:sortPortfolioRecent, importGithub:importGithub,
        toggleSummaryEdit:toggleSummaryEdit, openEntryModal:openEntryModal, hideEntryModal:hideEntryModal,
        saveEntry:saveEntry, deleteCvEntry:deleteCvEntry, addSkill:addSkill, deleteSkill:deleteSkill, importCv:importCv,
        insertBlogImage:insertBlogImage, newPost:newPost, editPost:editPost, hideBlogModal:hideBlogModal,
        saveBlogPost:saveBlogPost, deletePost:deletePost
    });
    window.OwnerUI = {
        sync:sync, renderPortfolio:renderOwnerPortfolio,
        cardParts:cardParts, cvCtrls:cvCtrls, skillDel:skillDel, postCtrls:postCtrls
    };
})();
