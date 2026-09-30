import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Three explicit counterfactuals for the v6 audit. Never edit the product model.
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const option=process.argv[2];
if(process.argv.length!==3||!option?.startsWith('--out=')||option.length===6)throw new Error('Use --out=new-experiment-directory');
const out=path.resolve(option.slice(6));
if(fs.existsSync(out))throw new Error('Choose a new output directory to preserve earlier experiments');
const source=path.join(project,'dist');
const variants=[
 {id:'open-tissue-gate',file:'biology.js',find:/("id":"tissue"[^\n]+"min":)0\.38/,description:'Only tissue acquisition minimum changes from 0.38 to 0.'},
 {id:'redox3',file:'ecology.js',find:'ri=supply*(.0008+f.vent*.027)*(f.land?.2:1)',replacement:'ri=3*supply*(.0008+f.vent*.027)*(f.land?.2:1)',description:'Only continuous external redox energy input is multiplied by three.'},
 {id:'nutrient3',file:'ecology.js',find:'ni=supply*(.00016+f.vent*.0012)*(f.land?.6:1)',replacement:'ni=3*supply*(.00016+f.vent*.0012)*(f.land?.6:1)',description:'Only continuous external dissolved nutrient input is multiplied by three.'},
];
for(const variant of variants){
 const original=fs.readFileSync(path.join(source,variant.file),'utf8');
 const matches=typeof variant.find==='string'?original.split(variant.find).length-1:[...original.matchAll(new RegExp(variant.find.source,'g'))].length;
 if(matches!==1)throw new Error(`Expected one v6 expression for ${variant.id}, found ${matches}`);
 variant.before=original;
 variant.after=typeof variant.find==='string'?original.replace(variant.find,variant.replacement):original.replace(variant.find,(_,prefix)=>prefix+'0');
}
for(const variant of variants){
 const folder=path.join(out,variant.id);
 fs.cpSync(source,path.join(folder,'dist'),{recursive:true});
 fs.writeFileSync(path.join(folder,'package.json'),'{"type":"module"}\n');
 fs.writeFileSync(path.join(folder,'dist',variant.file),variant.after);
 const before=variant.before.split('\n'),after=variant.after.split('\n');
 const changes=before.flatMap((line,i)=>line===after[i]?[]:[{line:i+1,before:line,after:after[i]}]);
 fs.writeFileSync(path.join(folder,'experiment.json'),JSON.stringify({modelVersion:6,id:variant.id,description:variant.description,file:variant.file,changes},null,2)+'\n');
 console.log(`${variant.id}: ${path.join(folder,'dist/engine.js')}`);
}
