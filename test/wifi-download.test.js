import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';

const shell=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/sh';
test('Kobo pull replaces only verified PNGs and preserves the image on transfer/hash/header failures',
 {skip:!existsSync(shell)},async()=>{
  const root=await mkdtemp(join(tmpdir(),'wing-wifi-'));
  const posix=p=>p.replaceAll('\\','/');
  try{
    const target=join(root,'screen');await mkdir(target);
    const script=(await readFile('kobo/download-dashboard.sh','utf8'))
      .replace('dir=/mnt/onboard/.adds/kobo-screen',`dir='${posix(target)}'`);
    await writeFile(join(root,'download.sh'),script);
    const mock=join(root,'curl-mock.sh');
    await writeFile(mock,`#!/bin/sh
set -eu
test "$1" = '--fail'
case " $* " in *" --proto =https --tlsv1.2 "*) ;; *) exit 90;; esac
test "$WING_TEST_MODE" != 'http-error' || exit 22
dest=''
while test "$#" -gt 0; do
  case "$1" in --output) dest=$2; shift 2;; *) url=$1; shift;; esac
done
case "$url" in
  *.sha256) cp "$WING_TEST_ROOT/expected.sha256" "$dest";;
  *.png) cp "$WING_TEST_ROOT/source.png" "$dest";;
  *) exit 91;;
esac
`,{mode:0o700});
    const png=new PNG({width:600,height:800});png.data.fill(255);
    const valid=PNG.sync.write(png,{colorType:0,inputColorType:6,bitDepth:8});
    const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
    for(const mode of ['success','http-error','hash-error','wrong-size']){
      const bytes=mode==='wrong-size'?Buffer.from('not a PNG'):valid;
      await writeFile(join(root,'source.png'),bytes);
      await writeFile(join(root,'expected.sha256'),`${mode==='hash-error'?'0'.repeat(64):digest(bytes)}  tharon.png\n`);
      const destination=join(target,'meteo-wingfoil.png');
      await writeFile(destination,'previous image');
      const result=spawnSync(shell,[posix(join(root,'download.sh')),'https://example.github.io/wing-dashboard','tharon'],
        {encoding:'utf8',env:{...process.env,WING_CURL:posix(mock),WING_TEST_ROOT:posix(root),WING_TEST_MODE:mode}});
      assert.ifError(result.error);
      if(mode==='success'){
        assert.equal(result.status,0,result.stderr);
        assert.deepEqual(await readFile(destination),valid);
      }else{
        assert.notEqual(result.status,0,mode);
        assert.equal(await readFile(destination,'utf8'),'previous image',mode);
      }
      assert.equal(existsSync(join(target,'.download-lock')),false);
    }
  }finally{await rm(root,{recursive:true,force:true});}
 });
