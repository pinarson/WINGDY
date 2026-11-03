// USB-only transfer. Node built-ins only; no install, network or firmware access.
import {readFile,writeFile,mkdir,access,realpath,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function main(){
  if(process.platform!=='win32')throw new Error('Ce transfert est prévu pour Windows.');
  const args=process.argv.slice(2),checkOnly=args.includes('--check');
  if(args.some(a=>a.startsWith('--')&&a!=='--check'))throw new Error('Option inconnue. Utilisation : transfer-kobo.mjs D: [--check]');
  if(args.filter(a=>!a.startsWith('--')).length>1)throw new Error('Indiquer une seule lettre de lecteur.');
  const drive=args.find(a=>!a.startsWith('--'))||'D:';
  if(!/^[A-Za-z]:\\?$/.test(drive))throw new Error('Indiquer uniquement une lettre de lecteur, par exemple D:.');
  const root=drive[0].toUpperCase()+':\\';
  const source=fileURLToPath(new URL('../output/meteo-wingfoil-tharon.png',import.meta.url));
  const destination=path.join(root,'.adds','kobo-screen','meteo-wingfoil.png');
  const bytes=await readFile(source);
  if(bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')throw new Error('Le fichier source n’est pas un PNG valide.');
  if(bytes.readUInt32BE(16)!==600||bytes.readUInt32BE(20)!==800||bytes[24]!==8||bytes[25]!==0||bytes[28]!==0)throw new Error('PNG attendu : 600 × 800, gris 8 bits, sans entrelacement. Aucun transfert.');
  const version=await readFile(path.join(root,'.kobo','version'),'utf8');
  if(!version.trim().startsWith('N905B'))throw new Error('Ce lecteur n’est pas identifié comme une Kobo Touch N905B. Aucun transfert.');
  const shell=path.join(root,'.adds','kobo-screen','afficher-meteo.sh');
  const menu=path.join(root,'.adds','nm','kobo-screen');
  const fbink=path.join(root,'.adds','hello-fbink','fbink');
  const library=path.join(root,'.adds','hello-fbink','libfbink.so.1');
  await Promise.all([access(shell),access(menu),access(fbink),access(library)]);
  const script=(await readFile(shell,'utf8')).replaceAll('\r\n','\n');
  const config=await readFile(menu,'utf8');
  if(!script.includes('APP=/mnt/onboard/.adds/kobo-screen')||!script.includes('TOOLS=/mnt/onboard/.adds/hello-fbink')||!script.includes('IMAGE="$APP/meteo-wingfoil.png"')||!script.includes('-V -c -f -w -W GC16')||!script.includes('file=$IMAGE'))throw new Error('Le script Kobo diffère du chemin attendu. Aucun transfert.');
  if(!config.includes('Afficher météo')||!config.includes('/bin/sh /mnt/onboard/.adds/kobo-screen/afficher-meteo.sh'))throw new Error('L’entrée NickelMenu attendue est absente. Aucun transfert.');
  const rootReal=await realpath(root),parentReal=await realpath(path.dirname(destination));
  const relative=path.relative(rootReal,parentReal);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Dossier cible hors du lecteur Kobo.');
  let previous=null;
  try{
    const info=await lstat(destination);
    if(!info.isFile()||info.isSymbolicLink())throw new Error('La destination n’est pas un fichier ordinaire.');
    previous=await readFile(destination);
  }catch(error){if(error.code!=='ENOENT')throw error;}
  const protectedFiles=[shell,menu,fbink,library];
  const helloMenu=path.join(root,'.adds','nm','hello-fbink');
  try{await access(helloMenu);protectedFiles.push(helloMenu);}catch{}
  const before=await Promise.all(protectedFiles.map(async file=>({file,hash:sha256(await readFile(file))})));
  console.log('Kobo Touch N905B identifiée. FBInk et entrée « Afficher météo » présents.');
  console.log('Source : '+source);
  console.log('Seule écriture prévue sur la Kobo : '+destination);
  console.log('PNG : 600 × 800, gris 8 bits. SHA256 : '+sha256(bytes));
  if(checkOnly){console.log('Vérification seule réussie. Aucun fichier copié ou modifié.');return;}
  if(previous){
    const folder=fileURLToPath(new URL('../output/kobo-transfer-backups/',import.meta.url));
    await mkdir(folder,{recursive:true});
    const backup=path.join(folder,'meteo-wingfoil-before-'+new Date().toISOString().replaceAll(':','-').replaceAll('.','-')+'.png');
    await writeFile(backup,previous,{flag:'wx',flush:true});
    if(sha256(await readFile(backup))!==sha256(previous))throw new Error('Sauvegarde PC non vérifiée ; transfert annulé.');
    console.log('Ancienne image sauvegardée sur le PC : '+backup);
  }
  await writeFile(destination,bytes,{flush:true});
  if(sha256(await readFile(destination))!==sha256(bytes))throw new Error('La vérification SHA256 de la copie a échoué. Ne pas éjecter avant vérification.');
  for(const entry of before)if(sha256(await readFile(entry.file))!==entry.hash)throw new Error('Un composant préexistant a changé pendant le transfert. Vérifier la liseuse.');
  console.log('Copie terminée et SHA256 vérifié. Scripts, menus et FBInk inchangés.');
  console.log('Éjectez maintenant la Kobo depuis Windows, puis ouvrez NickelMenu > Afficher météo.');
}
main().catch(error=>{console.error('Transfert interrompu : '+error.message);process.exitCode=1;});
