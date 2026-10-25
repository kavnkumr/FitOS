/* FitOS local IndexedDB layer. No record data is sent to a server. */
(function(){
  const DB_NAME="aesthetic-os-db"; // Kept stable so an existing starter install is not needlessly reset.
  const DB_VERSION=3;
  const STORES=["settings","foodLogs","measurements","workouts","recovery","customFoods","savedMeals","supplementLogs"];
  let dbPromise;
  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains("settings")) db.createObjectStore("settings",{keyPath:"key"});
        if(!db.objectStoreNames.contains("foodLogs")) { const s=db.createObjectStore("foodLogs",{keyPath:"id"}); s.createIndex("date","date",{unique:false}); }
        if(!db.objectStoreNames.contains("measurements")) { const s=db.createObjectStore("measurements",{keyPath:"id"}); s.createIndex("date","date",{unique:false}); }
        if(!db.objectStoreNames.contains("workouts")) { const s=db.createObjectStore("workouts",{keyPath:"id"}); s.createIndex("date","date",{unique:false}); }
        if(!db.objectStoreNames.contains("recovery")) { const s=db.createObjectStore("recovery",{keyPath:"id"}); s.createIndex("date","date",{unique:false}); }
        if(!db.objectStoreNames.contains("customFoods")) db.createObjectStore("customFoods",{keyPath:"id"});
        if(!db.objectStoreNames.contains("savedMeals")) db.createObjectStore("savedMeals",{keyPath:"id"});
        if(!db.objectStoreNames.contains("supplementLogs")) { const s=db.createObjectStore("supplementLogs",{keyPath:"id"}); s.createIndex("date","date",{unique:false}); }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>{dbPromise=null;reject(req.error);};
      req.onblocked=()=>reject(new Error("Please close other FitOS tabs and reopen the app."));
    });
    return dbPromise;
  }
  async function all(store){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store,"readonly").objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
  async function put(store,value){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store,"readwrite").objectStore(store).put(value);r.onsuccess=()=>resolve(value);r.onerror=()=>reject(r.error);});}
  async function remove(store,key){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store,"readwrite").objectStore(store).delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
  async function get(store,key){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store,"readonly").objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function clear(store){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(store,"readwrite").objectStore(store).clear();r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
  async function exportAll(){
    const result={app:"FitOS",schemaVersion:3,exportedAt:new Date().toISOString()};
    for(const store of STORES) result[store]=await all(store);
    return result;
  }
  async function restoreAll(data,mode="merge"){
    const oldFormat=data&&data.app==="Aesthetic OS"&&data.schemaVersion===1;
    const fitV2=data&&data.app==="FitOS"&&data.schemaVersion===2;
    const fitV3=data&&data.app==="FitOS"&&data.schemaVersion===3;
    if(!oldFormat&&!fitV2&&!fitV3) throw new Error("This does not look like a supported FitOS backup.");
    const inputStores=oldFormat?["settings","foodLogs","measurements","workouts","recovery"]:fitV2?STORES.filter(s=>s!=="supplementLogs"):STORES;
    for(const store of inputStores) if(data[store]!==undefined&&!Array.isArray(data[store])) throw new Error("Invalid backup: "+store+" must be a list.");
    // Validate the complete payload before any destructive replace or merge write.
    for(const store of inputStores){
      for(const item of (data[store]||[])){
        if(!item||!(store==="settings"?typeof item.key==="string":typeof item.id==="string")) throw new Error("Invalid record in "+store);
        if(store==="savedMeals"&&(!item.name||!Array.isArray(item.items))) throw new Error("Invalid saved meal record");
        if(store==="customFoods"&&(!item.name||!["kcal","protein","carbs","fat","fiber"].every(k=>Number.isFinite(Number(item[k]))&&Number(item[k])>=0))) throw new Error("Invalid custom food record");
        if(store==="supplementLogs"&&(!item.name||!item.date)) throw new Error("Invalid supplement log record");
      }
    }
    await openDB();
    if(mode==="replace") await Promise.all(STORES.map(s=>clear(s)));
    for(const store of inputStores) for(const item of (data[store]||[])) await put(store,item);
    return {legacy:oldFormat,mode};
  }
  window.AOS_DB={openDB,all,put,remove,get,exportAll,restoreAll,stores:STORES};
})();
