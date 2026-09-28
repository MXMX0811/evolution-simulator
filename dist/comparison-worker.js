import {compareWorlds} from './comparison.js';
self.onmessage=({data})=>{
 try{
  const results=[];
  for(let repeat=0;repeat<3;repeat++){
   results.push(compareWorlds(data.snapshot,data.change,repeat));
   self.postMessage({type:'progress',completed:repeat+1});
  }
  self.postMessage({type:'complete',results});
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
