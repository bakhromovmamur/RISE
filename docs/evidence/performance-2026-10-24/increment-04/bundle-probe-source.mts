import { build } from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/node_modules/vite/dist/node/index.js';
import react from '/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker/node_modules/@vitejs/plugin-react/dist/index.js';
import { writeFileSync, realpathSync } from 'node:fs';
const root=realpathSync(process.env.RISE_BUNDLE_ROOT??'/Users/mamurbakhromov/Desktop/PROJECTS/habit tracker');
await build({ root, configFile:false, plugins:[react(),{ name:'read-only-bundle-probe', generateBundle(_options,bundle){
 const chunks=Object.values(bundle).filter(output=>output.type==='chunk').map(output=>({name:output.fileName,entry:output.isEntry,imports:output.imports,dynamicImports:output.dynamicImports,modules:Object.entries(output.modules).map(([name,row])=>({name:name.replace(root+'/',''),renderedLength:row.renderedLength})).sort((a,b)=>b.renderedLength-a.renderedLength)}));
 writeFileSync(process.env.RISE_BUNDLE_OUTPUT??'/tmp/rise-quality03-bundle-current.json',JSON.stringify({scope:'Read-only production graph; unminified module sizes, no assets written',chunks},null,2));
 }}],build:{write:false,minify:false},logLevel:'error'});
