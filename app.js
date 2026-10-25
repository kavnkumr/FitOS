(function(){
  const $=id=>document.getElementById(id);
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  let activeDate=today(), selectedFood=null, recipeSelectedFood=null, recipeDraft=[], parsedDraft=[], customFoodCache=[], savedMealsCache=[];
  const defaults={profile:{heightCm:174,startingWeightKg:70},targets:{calories:2100,protein:160,carbs:220,fat:60,fiber:30}};
  const nutrients=["kcal","protein","carbs","fat","fiber"];
  const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1});
  const uid=()=>crypto.randomUUID?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random().toString(16).slice(2);
  function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200);}
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function dateNow(){return activeDate;}
  async function getSettings(){return (await AOS_DB.get("settings","appSettings"))?.value||structuredClone(defaults);}
  async function saveSettings(v){await AOS_DB.put("settings",{key:"appSettings",value:v});}
  function totals(items){return items.reduce((a,x)=>{for(const n of nutrients)a[n]+=(Number(x[n])||0);return a;},{kcal:0,protein:0,carbs:0,fat:0,fiber:0});}
  function scaled(food,grams){const f=grams/100;return {kcal:food.kcal*f,protein:food.protein*f,carbs:food.carbs*f,fat:food.fat*f,fiber:food.fiber*f};}
  function nutrientsText(t){return `${fmt(t.kcal)} kcal · P ${fmt(t.protein)} g · C ${fmt(t.carbs)} g · F ${fmt(t.fat)} g · Fibre ${fmt(t.fiber)} g`;}
  function calculateRecipeNutrition(ingredients,finalWeight){if(!Number.isFinite(finalWeight)||finalWeight<=0)throw new Error("Final cooked weight must be positive.");const total=totals(ingredients.map(x=>scaled(x.food,x.grams)));const per100={};for(const k of nutrients)per100[k]=total[k]/finalWeight*100;return {total,per100};}
  async function logsForDate(date=dateNow()){return (await AOS_DB.all("foodLogs")).filter(x=>x.date===date).sort((a,b)=>a.createdAt-b.createdAt);}
  function groupLogs(logs){return logs.reduce((a,l)=>{(a[l.meal]||(a[l.meal]=[])).push(l);return a;},{});}
  async function renderDiary(){
    const logs=await logsForDate();const groups=groupLogs(logs);const html=Object.keys(groups).map(meal=>`<div class="meal-group"><div class="meal-group-title"><span>${esc(meal)}</span><span>${fmt(totals(groups[meal]).kcal)} kcal</span></div>${groups[meal].map(l=>`<div class="food-log-row"><div><strong>${esc(l.foodName)}</strong><small>${fmt(l.grams)} g · ${esc(l.state||"state not set")} · ${nutrientsText(l)}</small><small>${esc(l.confidence||"estimate")} · ${esc(l.source||"")}</small></div><div class="row-actions"><button class="delete-btn" data-delete-log="${esc(l.id)}" aria-label="Delete ${esc(l.foodName)}">×</button></div></div>`).join("")}</div>`).join("");
    const empty=logs.length===0?'<div class="empty-state">No foods logged for this date yet.</div>':html;
    $("diaryMeals").innerHTML=empty;$("homeMeals").innerHTML=empty;$("diaryDateLabel").textContent=date;
    document.querySelectorAll("[data-delete-log]").forEach(btn=>btn.addEventListener("click",async()=>{await AOS_DB.remove("foodLogs",btn.dataset.deleteLog);await refresh();toast("Food entry deleted");}));
    const t=totals(logs),s=await getSettings(),tar=s.targets;
    $("caloriesTotal").textContent=fmt(t.kcal);$("proteinTotal").textContent=fmt(t.protein);$("carbsTotal").textContent=fmt(t.carbs);$("fatTotal").textContent=fmt(t.fat);$("fiberTotal").textContent=fmt(t.fiber);
    $("calorieRemaining").textContent=`${fmt(tar.calories-t.kcal)} kcal remaining`;$("proteinRemaining").textContent=`${fmt(tar.protein-t.protein)} g remaining`;$("carbsRemaining").textContent=`${fmt(tar.carbs-t.carbs)} g remaining`;$("fatRemaining").textContent=`${fmt(tar.fat-t.fat)} g remaining`;$("fiberRemaining").textContent=`${fmt(tar.fiber-t.fiber)} g remaining`;
    $("calorieTargetLabel").textContent=`Target ${fmt(tar.calories)}`;$("proteinTargetLabel").textContent=`Target ${fmt(tar.protein)} g`;$("carbsTargetLabel").textContent=`Target ${fmt(tar.carbs)} g`;$("fatTargetLabel").textContent=`Target ${fmt(tar.fat)} g`;$("fiberTargetLabel").textContent=`Target ${fmt(tar.fiber)} g`;
    $("calorieProgress").style.width=Math.max(0,Math.min(100,tar.calories?100*t.kcal/tar.calories:0))+"%";
    const lines=[];
    lines.push(`<p><strong>Calories:</strong> ${fmt(t.kcal)} / ${fmt(tar.calories)} kcal (${fmt(tar.calories-t.kcal)} remaining).</p>`);
    lines.push(`<p><strong>Protein:</strong> ${fmt(t.protein)} / ${fmt(tar.protein)} g. ${t.protein>=tar.protein?"Selected target reached.":"Compare against the remaining target; consider protein-rich foods if appropriate."}</p>`);
    lines.push(`<p><strong>Carbohydrates:</strong> ${fmt(t.carbs)} / ${fmt(tar.carbs)} g. <strong>Fat:</strong> ${fmt(t.fat)} / ${fmt(tar.fat)} g.</p>`);
    lines.push(`<p><strong>Fibre:</strong> ${fmt(t.fiber)} / ${fmt(tar.fiber)} g. ${t.fiber<tar.fiber?"Fibre is below the selected target so far.":"Selected fibre target reached."}</p>`);
    if(logs.some(l=>l.confidence==="low"||l.confidence==="estimate"))lines.push(`<p class="muted">Some logged foods use estimated reference values. Restaurant recipes, oil and edible portions can change totals.</p>`);
    if(!logs.length)lines.push("<p>Log food to get a useful assessment. No intake is assumed for unlogged meals.</p>");
    $("coachAssessment").innerHTML=lines.join("");
  }
  function allFoods(){return [...window.AOS_FOODS,...customFoodCache];}
  function findFood(q){
    const query=String(q||"").toLowerCase().trim();if(!query)return [];
    return allFoods().map(f=>({f,score:(f.name.toLowerCase()===query?20:f.name.toLowerCase().includes(query)?6:0)+((f.aliases||[]).some(a=>a.toLowerCase()===query)?12:(f.aliases||[]).some(a=>a.toLowerCase().includes(query))?4:0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.f.name.localeCompare(b.f.name)).slice(0,18).map(x=>x.f);
  }
  function renderFoodResults(){
    const q=$("foodSearch").value;const foods=findFood(q);
    $("foodResults").innerHTML=foods.length?foods.map(f=>`<button class="food-result" data-food="${esc(f.id)}"><span><strong>${esc(f.name)}</strong><small>${esc(f.state)} · ${fmt(f.kcal)} kcal / 100 g · ${esc(f.confidence||"estimate")}</small><small>${esc(f.basis||"Per 100 g")}</small></span><span class="addmark">+</span></button>`).join(""):(q?'<div class="empty-state">No local match found. Use “Create food” below and enter the nutrition label, or add a clearly marked estimate.</div>':'<div class="empty-state">Search 100+ common Indian foods, including Tamil aliases, grains, pulses, vegetables, fruit and restaurant estimates.</div>');
    document.querySelectorAll("[data-food]").forEach(b=>b.addEventListener("click",()=>selectFood(b.dataset.food)));
  }
  function selectFood(id){selectedFood=allFoods().find(f=>f.id===id);if(!selectedFood)return;$("selectedFoodName").textContent=selectedFood.name;$("selectedFoodInfo").textContent=`${selectedFood.state}; ${selectedFood.basis||"values per 100 g"}. ${selectedFood.source} Data status: ${selectedFood.confidence||"estimate"}.`; $("foodGrams").value=100;$("selectedFoodForm").classList.remove("hidden");}
  async function addLog(food,grams,meal,date=dateNow()){
    if(!food||!Number.isFinite(grams)||grams<=0)throw new Error("Choose a food and enter a positive amount.");
    const t=scaled(food,grams);const record={id:uid(),date,createdAt:Date.now(),meal,foodId:food.id,foodName:food.name,grams:Number(grams),state:food.state,...t,source:food.source,confidence:food.confidence,originalEntry:null};
    await AOS_DB.put("foodLogs",record);return record;
  }
  function parseNatural(text){
    // Offline, review-before-save parser for casual meal notes. It favours clarification over silently inventing quantities.
    const source=String(text||"").replace(/[\n;]+/g,",").trim();
    const cleaned=source
      .replace(/\b(i\s+)?(ate|had|eaten|consumed|logged|for breakfast|for lunch|for dinner|as a snack|today i had)\b/ig," ")
      .replace(/\b(this morning|in the morning|at lunch|at dinner|for breakfast|for lunch|for dinner)\b/ig," ")
      .replace(/\s+/g," ").trim();
    const parts=cleaned.split(/,|\band\b|\bplus\b|\+|\bwith\b(?=\s*(?:\d|one\b|two\b|three\b|half\b))/i).map(x=>x.trim().replace(/^[.\s]+|[.\s]+$/g,"")).filter(Boolean);
    const out=[];
    const numberWords={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,half:0.5,quarter:0.25};
    const countMap=[
      [/^(?:boiled\s+)?eggs?$/i,50,"egg_whole_boiled"],[/^egg whites?$/i,33,"egg_white_cooked"],[/^idlis?$/i,50,"idli_plain"],[/^(?:plain\s+)?dosas?$/i,100,"dosa_plain"],
      [/^bananas?$/i,118,"banana_raw"],[/^oranges?$/i,130,"orange_raw"],[/^(?:medium\s+)?guavas?$/i,150,"guava_raw"],[/^apples?$/i,180,"apple_raw"],
      [/^(?:chapathis?|chapatis?|rotis?)$/i,40,"chapati_plain"],[/^appams?$/i,70,"appam_plain"],[/^idiyappams?$/i,50,"idiyappam_plain"],[/^slices?\s+(?:of\s+)?(?:wheat\s+)?bread$/i,25,"bread_whole_wheat"],
      [/^scoops?\s+(?:of\s+)?whey(?:\s+protein)?$/i,30,"whey_protein_powder"],[/^boiled potatoes?$/i,150,"potato_boiled"]
    ];
    function foodMatch(q){
      let query=q.trim().replace(/^(?:some|a bit of|a serving of|one serving of|the)\s+/i,"").replace(/\b(raw|uncooked|cooked|boiled|steamed|fried|grilled|roasted)\s+(?:weight of\s+)?/i,m=>m.toLowerCase());
      let found=findFood(query)[0];
      if(found)return found;
      // Try progressively removing casual preparation words only if there is a unique food result.
      const variants=[query.replace(/\b(raw|uncooked|cooked|boiled|steamed|fried|grilled|roasted|homemade|home[- ]?made|restaurant)\b/ig," ").replace(/\s+/g," ").trim(),query.replace(/\b(?:small|medium|large|fresh|plain)\b/ig," ").replace(/\s+/g," ").trim()];
      for(const v of variants){const hits=findFood(v);if(hits.length===1)return hits[0];if(hits.length>1){const exact=hits.find(f=>f.name.toLowerCase()===v.toLowerCase()||(f.aliases||[]).some(a=>a.toLowerCase()===v.toLowerCase()));if(exact)return exact;}}
      return null;
    }
    for(let part of parts){
      part=part.replace(/^(?:then|also|plus)\s+/i,"").replace(/\s+(?:for breakfast|for lunch|for dinner|as snack)$/i,"").trim();
      if(!part)continue;
      // Quantity may be digits or common number words; units are normalised to grams for database calculations.
      const qtyRe=/^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\s*(?:(kg|kilograms?|g|grams?|ml|millilit(?:er|re)s?|cups?|tbsp|tablespoons?|tsp|teaspoons?|pieces?|pcs?|slices?|servings?|scoops?)\b\s*)?(?:of\s+)?(.+)$/i;
      const m=part.match(qtyRe);
      if(!m){out.push({food:null,grams:null,original:part,matchType:"I couldn't identify the amount; add a quantity like 150 g or 2 pieces."});continue;}
      const qword=m[1].toLowerCase(),count=/^\d/.test(qword)?Number(qword):(numberWords[qword]??null),unit=(m[2]||"").toLowerCase(),foodQuery=m[3].trim();
      if(count===null){out.push({food:null,grams:null,original:part,matchType:"Quantity needs clarification."});continue;}
      let grams=null,unitKind="";
      if(["g","gram","grams"].includes(unit)) {grams=count;unitKind="weight";}
      else if(["kg","kilogram","kilograms"].includes(unit)){grams=count*1000;unitKind="weight";}
      else if(["ml","milliliter","milliliters","millilitre","millilitres"].includes(unit)){grams=count;unitKind="volume estimate";}
      else if(["cup","cups"].includes(unit)){grams=count*240;unitKind="cup estimate";}
      else if(["tbsp","tablespoon","tablespoons"].includes(unit)){grams=count*15;unitKind="spoon estimate";}
      else if(["tsp","teaspoon","teaspoons"].includes(unit)){grams=count*5;unitKind="spoon estimate";}
      else if(["piece","pieces","pc","pcs","slice","slices","serving","servings","scoop","scoops"].includes(unit)){
        const f=foodMatch(foodQuery);const cm=countMap.find(x=>x[0].test(foodQuery));
        const each=cm?.[1]||(unit.startsWith("slice")?25:unit.startsWith("scoop")?30:null);
        if(f&&each){out.push({food:f,grams:count*each,original:part,matchType:`${unitKind||"count estimate"}; approximate edible weight`});continue;}
        if(f&&unit.startsWith("serving")){out.push({food:f,grams:count*100,original:part,matchType:"serving estimated as 100 g; please check"});continue;}
        out.push({food:null,grams:null,original:part,matchType:"I found a count but need the food/serving size clarified."});continue;
      } else {
        const cm=countMap.find(x=>x[0].test(foodQuery));
        if(cm){const f=allFoods().find(f=>f.id===cm[2]);out.push({food:f||null,grams:count*cm[1],original:part,matchType:"piece count estimate; review edible weight"});continue;}
        // No unit and not a known piece-count food: do not assume it means grams.
        out.push({food:null,grams:null,original:part,matchType:"Please add a unit (e.g. 200 g) or clarify the number of pieces."});continue;
      }
      let food=foodMatch(foodQuery);
      const needsState=/\b(rice|chicken|fish|mutton|lamb|beef|pork|prawn|shrimp|potato|yam|cassava)\b/i.test(foodQuery);
      const hasState=/\b(raw|uncooked|dry|dried|cooked|boiled|steamed|fried|grilled|roasted|baked|tandoori|smoked|powder|flour|uncooked|ready[- ]to[- ]eat)\b/i.test(foodQuery);
      if(food&&needsState&&!hasState){out.push({food:null,grams,original:part,matchType:`Food matched (${food.name}), but raw/cooked/preparation state is unclear. Search and choose the correct version.`});continue;}
      out.push({food,grams,original:part,matchType:food?`${unitKind||"quantity"}; review preparation and amount`:"Food not found in the local database; search and match it or create a custom food."});
    }
    return out;
  }
  function renderParsed(){
    $("parseResults").classList.remove("hidden");
    $("parseResults").innerHTML=parsedDraft.map((x,i)=>`<div class="parse-item"><div><strong>${esc(x.original)}</strong><div class="muted">${x.food?`${esc(x.food.name)} · ${fmt(x.grams)} g · ${x.matchType}`:esc(x.matchType)}</div>${!x.food?`<input data-parse-query="${i}" placeholder="Search food name">`:''}</div><div>${x.food?`<button class="secondary small" data-remove-parse="${i}">Remove</button>`:`<button class="secondary small" data-find-parse="${i}">Match</button>`}</div></div>`).join("")+`<button id="confirmParsed" class="primary" ${parsedDraft.some(x=>!x.food||!x.grams)?"disabled":""}>Add confirmed foods</button><p class="muted">Counts use approximate edible weights. All matches are shown for review; nothing is logged until you confirm.</p>`;
    document.querySelectorAll("[data-remove-parse]").forEach(b=>b.addEventListener("click",()=>{parsedDraft.splice(Number(b.dataset.removeParse),1);renderParsed();}));
    document.querySelectorAll("[data-find-parse]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.findParse),q=$(`[data-parse-query="${i}"]`).value;const f=findFood(q)[0];if(f){parsedDraft[i].food=f;parsedDraft[i].matchType="user-confirmed match";renderParsed();}else toast("No local match found");}));
    $("confirmParsed")?.addEventListener("click",async()=>{try{for(const x of parsedDraft){if(!x.food||!x.grams)throw new Error("Resolve all ambiguous items first.");await addLog({...x.food,source:x.food.source+"; parsed from: "+x.original},x.grams,$("quickMeal").value);} $("naturalEntry").value="";parsedDraft=[];$("parseResults").classList.add("hidden");await refresh();toast("Confirmed foods added");}catch(e){toast(e.message);}});
  }
  async function refresh(){customFoodCache=await AOS_DB.all("customFoods");savedMealsCache=await AOS_DB.all("savedMeals");await renderDiary();await renderWorkouts();await renderMeasurements();await renderRecovery();await renderSupplements();await renderSavedMeals();await fillSettings();if($("foodSearch").value)renderFoodResults();}
  async function fillSettings(){const s=await getSettings();$("profileHeight").value=s.profile.heightCm;$("profileWeight").value=s.profile.startingWeightKg;$("targetCalories").value=s.targets.calories;$("targetProtein").value=s.targets.protein;$("targetCarbs").value=s.targets.carbs;$("targetFat").value=s.targets.fat;$("targetFiber").value=s.targets.fiber;}
  async function renderWorkouts(){const arr=(await AOS_DB.all("workouts")).filter(x=>x.date===dateNow()).sort((a,b)=>a.createdAt-b.createdAt);$("workoutHistory").innerHTML=arr.length?arr.map(w=>`<div class="food-log-row"><div><strong>${esc(w.exercise)}</strong><small>${esc(w.name)} · ${w.sets} sets × ${w.reps} reps × ${fmt(w.weight)} kg</small><small>${esc(w.notes||"")}</small></div><button class="delete-btn" data-delete-workout="${esc(w.id)}">×</button></div>`).join(""):'<div class="empty-state">No workouts logged for this date.</div>';document.querySelectorAll("[data-delete-workout]").forEach(b=>b.addEventListener("click",async()=>{await AOS_DB.remove("workouts",b.dataset.deleteWorkout);await renderWorkouts();toast("Workout entry deleted");}));}
  async function renderMeasurements(){
    const arr=(await AOS_DB.all("measurements")).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
    $("measurementHistory").innerHTML=arr.length?arr.slice(0,30).map(m=>{const metrics=[m.weightKg!=null?`Weight ${fmt(m.weightKg)} kg`:"",m.waistCm!=null?`Waist ${fmt(m.waistCm)} cm`:"",m.chestCm!=null?`Chest ${fmt(m.chestCm)} cm`:"",m.armCm!=null?`Arm ${fmt(m.armCm)} cm`:"",m.hipsCm!=null?`Hips ${fmt(m.hipsCm)} cm`:"",m.steps!=null?`${fmt(m.steps)} steps`:"",m.waterMl!=null?`${fmt(m.waterMl)} ml water`:""].filter(Boolean).join(" · ");return `<div class="food-log-row"><div><strong>${esc(m.date)}</strong><small>${metrics||"Check-in saved"}</small><small>${esc(m.notes||"")}</small></div><button class="delete-btn" data-delete-measure="${esc(m.id)}" aria-label="Delete measurement">×</button></div>`}).join(""):'<div class="empty-state">No measurements or activity check-ins logged yet.</div>';
    document.querySelectorAll("[data-delete-measure]").forEach(b=>b.addEventListener("click",async()=>{await AOS_DB.remove("measurements",b.dataset.deleteMeasure);await renderMeasurements();toast("Measurement deleted");}));
    const chronological=arr.slice().reverse();
    const spark=(key,label,unit)=>{const pts=chronological.filter(m=>Number.isFinite(Number(m[key]))&&m[key]!==null).slice(-12);if(pts.length<2)return `<div class="trend-card"><strong>${label}</strong><div class="muted">Log at least two values on different check-ins to see this trend.</div></div>`;const vals=pts.map(m=>Number(m[key])),min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;const xy=vals.map((v,i)=>({x:12+i*276/(vals.length-1),y:62-(v-min)/span*42,v,date:pts[i].date}));return `<div class="trend-card"><div class="trend-card-head"><strong>${label}</strong><span>${fmt(vals[vals.length-1])} ${unit}</span></div><svg class="sparkline" viewBox="0 0 300 82" role="img" aria-label="${label} trend"><line x1="8" y1="64" x2="292" y2="64" stroke="#42434a" stroke-width="1"/><polyline points="${xy.map(p=>`${p.x},${p.y}`).join(" ")}" fill="none" stroke="#f4f4f5" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${xy.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="#f4f4f5"/>`).join("")}</svg><div class="trend-dates"><span>${esc(pts[0].date)}</span><span>${esc(pts[pts.length-1].date)}</span></div></div>`;};
    $("progressTrends").innerHTML=spark("weightKg","Weight","kg")+spark("waistCm","Waist","cm");
  }
  async function renderRecovery(){
    const arr=(await AOS_DB.all("recovery")).filter(x=>x.date===dateNow()).sort((a,b)=>b.createdAt-a.createdAt);
    $("recoveryHistory").innerHTML=arr.length?arr.map(r=>`<div class="saved-meal-row"><div class="saved-meal-copy"><strong>${esc(r.date)}</strong><small>${r.sleepHours!=null?`Sleep ${fmt(r.sleepHours)} h · `:""}${r.energy!=null?`Energy ${r.energy}/5 · `:""}${r.soreness!=null?`Soreness ${r.soreness}/5 · `:""}${r.stress!=null?`Stress ${r.stress}/5`:""}</small></div><button class="delete-btn" data-delete-recovery="${esc(r.id)}" aria-label="Delete recovery log">×</button></div>`).join(""):'<div class="empty-state">No recovery check-ins logged for this selected date.</div>';
    document.querySelectorAll("[data-delete-recovery]").forEach(b=>b.addEventListener("click",async()=>{await AOS_DB.remove("recovery",b.dataset.deleteRecovery);await renderRecovery();toast("Recovery entry deleted");}));
  }
  async function renderSupplements(){
    const arr=(await AOS_DB.all("supplementLogs")).filter(x=>x.date===dateNow()).sort((a,b)=>b.createdAt-a.createdAt);
    $("supplementHistory").innerHTML=arr.length?arr.map(r=>`<div class="saved-meal-row"><div class="saved-meal-copy"><strong>${esc(r.name)}${r.dose!=null&&r.dose!==""?` · ${fmt(r.dose)} ${esc(r.unit)}`:""}</strong><small>${esc(r.timing||"Timing not set")}${r.notes?` · ${esc(r.notes)}`:""}</small></div><button class="delete-btn" data-delete-supplement="${esc(r.id)}" aria-label="Delete supplement log">×</button></div>`).join(""):'<div class="empty-state">No supplement or medication entries logged for this selected date.</div>';
    document.querySelectorAll("[data-delete-supplement]").forEach(b=>b.addEventListener("click",async()=>{await AOS_DB.remove("supplementLogs",b.dataset.deleteSupplement);await renderSupplements();toast("Log entry deleted");}));
  }
  function renderRecipeSearch(){
    const q=$("recipeIngredientSearch").value;const foods=findFood(q);
    $("recipeIngredientResults").innerHTML=foods.length?foods.map(f=>`<button class="food-result" data-recipe-food="${esc(f.id)}"><span><strong>${esc(f.name)}</strong><small>${esc(f.state)} · ${fmt(f.kcal)} kcal / 100 g · ${esc(f.confidence||"estimate")}</small></span><span class="addmark">+</span></button>`).join(""):(q?'<div class="empty-state">No ingredient match. Add it as a custom food first.</div>':'<div class="empty-state">Search for the foods you weighed into this recipe.</div>');
    document.querySelectorAll("[data-recipe-food]").forEach(b=>b.addEventListener("click",()=>{recipeSelectedFood=allFoods().find(f=>f.id===b.dataset.recipeFood)||null;if(!recipeSelectedFood)return;$("recipeIngredientName").textContent=recipeSelectedFood.name;$("recipeIngredientInfo").textContent=`${recipeSelectedFood.state}; ${recipeSelectedFood.source} · ${recipeSelectedFood.confidence}`;$("recipeIngredientGrams").value=100;$("recipeIngredientSelected").classList.remove("hidden");}));
  }
  function renderRecipeDraft(){
    const ingredients=recipeDraft.map((item,i)=>{const n=scaled(item.food,item.grams);return `<div class="recipe-item"><div><strong>${esc(item.food.name)}</strong><small>${fmt(item.grams)} g · ${esc(item.food.state)} · ${fmt(n.kcal)} kcal · P ${fmt(n.protein)} g</small></div><button class="delete-btn" data-remove-recipe-item="${i}" aria-label="Remove ingredient">×</button></div>`;}).join("");
    if(!recipeDraft.length){$("recipeDraftList").innerHTML='<div class="empty-state">Add ingredients to start a recipe.</div>';return;}
    const t=totals(recipeDraft.map(x=>scaled(x.food,x.grams))),sumWeight=recipeDraft.reduce((a,x)=>a+x.grams,0);
    $("recipeDraftList").innerHTML=ingredients+`<div class="recipe-total"><strong>Ingredients total</strong><span>${fmt(sumWeight)} g input · ${fmt(t.kcal)} kcal · P ${fmt(t.protein)} g · C ${fmt(t.carbs)} g · F ${fmt(t.fat)} g · Fibre ${fmt(t.fiber)} g</span></div>`;
    document.querySelectorAll("[data-remove-recipe-item]").forEach(b=>b.addEventListener("click",()=>{recipeDraft.splice(Number(b.dataset.removeRecipeItem),1);renderRecipeDraft();}));
  }
  async function saveRecipe(e){
    e.preventDefault();if(!recipeDraft.length){toast("Add at least one recipe ingredient");return;}
    const name=$("recipeName").value.trim(),finalWeight=Number($("recipeFinalWeight").value);
    if(!name||!Number.isFinite(finalWeight)||finalWeight<=0){toast("Enter recipe name and final cooked weight");return;}
    const ingredientWeight=recipeDraft.reduce((a,x)=>a+x.grams,0);
    if(finalWeight<ingredientWeight*0.35||finalWeight>ingredientWeight*3){if(!confirm("The final cooked weight differs a lot from the entered ingredient weight. Check the yield weight; save anyway?"))return;}
    const {per100}=calculateRecipeNutrition(recipeDraft,finalWeight);
    const id="recipe_"+uid();
    const recipe={id,name,aliases:[],category:"Recipes",state:"prepared",basis:"per 100 g finished recipe",...per100,source:"Calculated from user-entered ingredient quantities and final cooked yield; values inherit ingredient uncertainty",confidence:"recipe estimate",custom:true,recipe:true,createdAt:Date.now(),finalCookedWeightG:finalWeight,recipeIngredients:recipeDraft.map(x=>({foodId:x.food.id,foodName:x.food.name,grams:x.grams,state:x.food.state,source:x.food.source,confidence:x.food.confidence,...scaled(x.food,x.grams)}))};
    await AOS_DB.put("customFoods",recipe);customFoodCache=await AOS_DB.all("customFoods");recipeDraft=[];recipeSelectedFood=null;e.target.reset();$("recipeIngredientSelected").classList.add("hidden");$("recipeIngredientSearch").value="";renderRecipeSearch();renderRecipeDraft();await refresh();$("foodSearch").value=name;renderFoodResults();toast("Recipe calculated and saved as a food");
  }
  async function renderSavedMeals(){
    const items=(await AOS_DB.all("savedMeals")).sort((a,b)=>b.createdAt-a.createdAt);
    savedMealsCache=items;
    $("savedMealsList").innerHTML=items.length?items.map(m=>`<div class="saved-meal-row"><div class="saved-meal-copy"><strong>${esc(m.name)}</strong><small>${m.items.length} foods · saved from ${esc(m.sourceDate||"unknown date")} · ${fmt(m.totalKcal||0)} kcal total</small></div><div class="row-actions"><button class="secondary small" data-add-template="${esc(m.id)}">Add</button><button class="delete-btn" data-delete-template="${esc(m.id)}" aria-label="Delete saved meal">×</button></div></div>`).join(""):'<div class="empty-state">No saved templates yet. Log your foods, then save the selected day as a reusable template.</div>';
    document.querySelectorAll("[data-add-template]").forEach(b=>b.addEventListener("click",async()=>{const m=(await AOS_DB.all("savedMeals")).find(x=>x.id===b.dataset.addTemplate);if(!m)return;for(const item of m.items){await AOS_DB.put("foodLogs",{...item,id:uid(),date:dateNow(),createdAt:Date.now(),originalEntry:`Copied from saved meal: ${m.name}`});}await refresh();toast(`Added ${m.name} to ${dateNow()}`);}));
    document.querySelectorAll("[data-delete-template]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this saved meal template? Existing food logs will not be affected."))return;await AOS_DB.remove("savedMeals",b.dataset.deleteTemplate);await renderSavedMeals();toast("Saved meal deleted");}));
  }
  async function saveCurrentDayAsTemplate(){
    const logs=await logsForDate();if(!logs.length){toast("Log some foods on the selected day first");return;}
    const name=prompt("Give this saved meal/day a name:",`My meal plan ${dateNow()}`);if(!name||!name.trim())return;
    const clean=logs.map(({id,date,createdAt,...rest})=>({...rest,createdAt:Date.now()}));
    const t=totals(logs);const record={id:uid(),name:name.trim(),sourceDate:dateNow(),createdAt:Date.now(),items:clean,totalKcal:t.kcal,totalProtein:t.protein,totalCarbs:t.carbs,totalFat:t.fat,totalFiber:t.fiber};
    await AOS_DB.put("savedMeals",record);await renderSavedMeals();toast("Meal template saved");
  }
  function openCustomFoodForm(){const form=$("customFoodForm");form.classList.toggle("hidden");if(!form.classList.contains("hidden"))$("customFoodName").focus();}
  async function createCustomFood(e){
    e.preventDefault();
    const name=$("customFoodName").value.trim();if(!name){toast("Enter a food name");return;}
    const values={kcal:Number($("customKcal").value),protein:Number($("customProtein").value),carbs:Number($("customCarbs").value),fat:Number($("customFat").value),fiber:Number($("customFiber").value)};
    if(Object.values(values).some(v=>!Number.isFinite(v)||v<0)){toast("Nutrition values must be zero or higher");return;}
    if(values.protein>100||values.carbs>100||values.fat>100||values.fiber>100){toast("Each nutrient per 100 g must be 100 g or less");return;}
    const dataSource=$("customFoodSource").value;
    const record={id:"custom_"+uid(),name,aliases:$("customFoodAliases").value.split(",").map(x=>x.trim()).filter(Boolean),category:$("customFoodCategory").value,state:$("customFoodState").value,basis:"per 100 g (user-entered)",...values,source:dataSource==="Manual estimate"?"User-entered estimate; not independently verified":dataSource==="Recipe calculation"?"User-entered recipe calculation":"User-entered package nutrition label",confidence:dataSource==="Package nutrition label"?"user label":dataSource==="Recipe calculation"?"recipe estimate":"user estimate",createdAt:Date.now(),custom:true};
    await AOS_DB.put("customFoods",record);customFoodCache=await AOS_DB.all("customFoods");e.target.reset();$("customFiber").value="0";e.target.classList.add("hidden");$("foodSearch").value=name;renderFoodResults();selectFood(record.id);toast("Custom food saved");
  }
  function download(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function csv(rows){if(!rows.length)return "";const cols=[...new Set(rows.flatMap(x=>Object.keys(x)))];const cell=v=>{if(v&&typeof v==="object")v=JSON.stringify(v);return '"'+String(v??"").replace(/"/g,'""')+'"';};return [cols.map(cell).join(","),...rows.map(r=>cols.map(c=>cell(r[c])).join(","))].join("\r\n");}
  async function init(){
    $("activeDate").value=activeDate;$("activeDate").addEventListener("change",async()=>{activeDate=$("activeDate").value||today();await refresh();});
    document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.screen)));
    document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
    $("foodSearch").addEventListener("input",renderFoodResults);
    $("addFood").addEventListener("click",async()=>{try{await addLog(selectedFood,Number($("foodGrams").value),$("selectedMeal").value);$("selectedFoodForm").classList.add("hidden");await refresh();toast("Food added to diary");}catch(e){toast(e.message);}});
    $("parseEntry").addEventListener("click",()=>{parsedDraft=parseNatural($("naturalEntry").value);if(!parsedDraft.length){toast("Enter a food description first");return;}renderParsed();});
    $("settingsForm").addEventListener("submit",async e=>{e.preventDefault();const s=await getSettings();s.profile={heightCm:Number($("profileHeight").value),startingWeightKg:Number($("profileWeight").value)};s.targets={calories:Number($("targetCalories").value),protein:Number($("targetProtein").value),carbs:Number($("targetCarbs").value),fat:Number($("targetFat").value),fiber:Number($("targetFiber").value)};await saveSettings(s);await refresh();toast("Targets saved");});
    $("workoutForm").addEventListener("submit",async e=>{e.preventDefault();await AOS_DB.put("workouts",{id:uid(),date:dateNow(),createdAt:Date.now(),name:$("workoutName").value.trim(),exercise:$("exerciseName").value.trim(),sets:Number($("exerciseSets").value),reps:Number($("exerciseReps").value),weight:Number($("exerciseWeight").value),notes:$("workoutNotes").value.trim()});$("exerciseName").value="";$("workoutNotes").value="";await renderWorkouts();toast("Exercise saved");});
    $("measurementForm").addEventListener("submit",async e=>{e.preventDefault();const val=id=>$(id).value.trim()===""?null:Number($(id).value);const m={id:uid(),date:dateNow(),createdAt:Date.now(),weightKg:val("measureWeight"),waistCm:val("measureWaist"),chestCm:val("measureChest"),armCm:val("measureArm"),hipsCm:val("measureHips"),notes:$("measureNotes").value.trim()};if(![m.weightKg,m.waistCm,m.chestCm,m.armCm,m.hipsCm].some(v=>typeof v==="number"&&Number.isFinite(v))){toast("Enter at least one measurement");return;}await AOS_DB.put("measurements",m);e.target.reset();await renderMeasurements();toast("Measurements saved");});
    $("recoveryForm").addEventListener("submit",async e=>{e.preventDefault();const r={id:uid(),date:dateNow(),createdAt:Date.now(),sleepHours:$("sleepHours").value===""?null:Number($("sleepHours").value),energy:$("energyLevel").value===""?null:Number($("energyLevel").value),soreness:$("sorenessLevel").value===""?null:Number($("sorenessLevel").value),stress:$("stressLevel").value===""?null:Number($("stressLevel").value)};if(r.sleepHours===null&&r.energy===null&&r.soreness===null&&r.stress===null){toast("Enter at least one recovery value");return;}await AOS_DB.put("recovery",r);await renderRecovery();toast("Recovery check-in saved");});
    $("supplementForm").addEventListener("submit",async e=>{e.preventDefault();const dose=$("supplementDose").value.trim();const row={id:uid(),date:dateNow(),createdAt:Date.now(),name:$("supplementName").value.trim(),dose:dose===""?null:Number(dose),unit:$("supplementUnit").value,timing:$("supplementTiming").value,notes:$("supplementNotes").value.trim()};if(!row.name){toast("Enter the name first");return;}if(row.dose!==null&&(!Number.isFinite(row.dose)||row.dose<0)){toast("Dose must be zero or higher");return;}await AOS_DB.put("supplementLogs",row);e.target.reset();await renderSupplements();toast("Personal log saved");});
    $("saveCheckin").addEventListener("click",async()=>{const m={id:uid(),date:dateNow(),createdAt:Date.now(),weightKg:$("weightInput").value===""?null:Number($("weightInput").value),steps:$("stepsInput").value===""?null:Number($("stepsInput").value),waterMl:$("waterInput").value===""?null:Number($("waterInput").value)};if(![m.weightKg,m.steps,m.waterMl].some(v=>typeof v==="number"&&Number.isFinite(v))){toast("Enter at least one value");return;}await AOS_DB.put("measurements",m);$("weightInput").value="";$("stepsInput").value="";$("waterInput").value="";await renderMeasurements();toast("Check-in saved");});
    $("recipeIngredientSearch").addEventListener("input",renderRecipeSearch);
    $("addRecipeIngredient").addEventListener("click",()=>{const grams=Number($("recipeIngredientGrams").value);if(!recipeSelectedFood||!Number.isFinite(grams)||grams<=0){toast("Select an ingredient and enter a positive amount");return;}recipeDraft.push({food:recipeSelectedFood,grams});recipeSelectedFood=null;$("recipeIngredientSelected").classList.add("hidden");$("recipeIngredientSearch").value="";renderRecipeSearch();renderRecipeDraft();});
    $("recipeSaveForm").addEventListener("submit",saveRecipe);
    $("toggleCustomFood").addEventListener("click",openCustomFoodForm);
    $("customFoodForm").addEventListener("submit",createCustomFood);
    $("saveMealTemplate").addEventListener("click",saveCurrentDayAsTemplate);
    $("exportJson").addEventListener("click",async()=>{download("fitos-backup-"+dateNow()+".json",JSON.stringify(await AOS_DB.exportAll(),null,2),"application/json");$("backupStatus").textContent="JSON backup generated. Keep it somewhere safe.";});
    $("exportCsv").addEventListener("click",async()=>{download("fitos-food-logs-"+dateNow()+".csv",csv(await AOS_DB.all("foodLogs")),"text/csv;charset=utf-8");$("backupStatus").textContent="Food log CSV generated.";});
    $("exportAllCsv").addEventListener("click",async()=>{const d=await AOS_DB.exportAll();const rows=[];for(const key of AOS_DB.stores)for(const item of d[key])rows.push({recordType:key,...item});download("fitos-all-records-"+dateNow()+".csv",csv(rows),"text/csv;charset=utf-8");$("backupStatus").textContent="All-records CSV generated.";});
    $("importJson").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());const choice=prompt("Type MERGE to combine this backup with current records, REPLACE to erase current FitOS records and restore only this backup, or CANCEL to do nothing.","MERGE");if(!choice||! ["MERGE","REPLACE"].includes(choice.trim().toUpperCase())){$("backupStatus").textContent="Restore cancelled.";return;}const mode=choice.trim().toUpperCase()==="REPLACE"?"replace":"merge";if(mode==="replace"&&!confirm("Final check: this will erase current local records before restoring the selected backup. Continue?"))return;const result=await AOS_DB.restoreAll(data,mode);await refresh();$("backupStatus").textContent=`Backup ${mode} completed${result.legacy?" (older Aesthetic OS backup supported)":""}.`;toast("Backup restored");}catch(err){$("backupStatus").textContent="Restore failed: "+err.message;toast("Restore failed");}finally{e.target.value="";}});
    customFoodCache=await AOS_DB.all("customFoods");savedMealsCache=await AOS_DB.all("savedMeals");
    await fillSettings();await refresh();renderFoodResults();renderRecipeSearch();renderRecipeDraft();
    if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost"))navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
    let installPrompt=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installBtn").classList.remove("hidden");});$("installBtn").addEventListener("click",async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").classList.add("hidden");}else toast("Use your browser menu and choose Install app or Add to Home screen.");});
  }
  function navigate(screen){document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===screen));document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.screen===screen));window.scrollTo({top:0,behavior:"smooth"});}
  window.AOS_TEST={scaled,totals,parseNatural,findFood,allFoods,calculateRecipeNutrition};
  if(document.getElementById("activeDate")) document.addEventListener("DOMContentLoaded",()=>init().catch(e=>{console.error(e);toast("App initialization failed: "+e.message);}));
})();