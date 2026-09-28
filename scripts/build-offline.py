"""Build a self-contained release using an existing esbuild executable."""
from pathlib import Path
import subprocess, tempfile, shutil, json, sys, re
root=Path(__file__).resolve().parents[1]
output=Path(sys.argv[1]).resolve()
esbuild=sys.argv[2]
with tempfile.TemporaryDirectory(prefix='origin-v5-build-') as folder:
    temp=Path(folder)
    shutil.copytree(root/'dist',temp/'dist')
    worker=temp/'comparison.js'
    subprocess.run([esbuild,str(temp/'dist/comparison-worker.js'),'--bundle','--format=iife','--target=es2022','--minify',f'--outfile={worker}'],check=True)
    app=temp/'dist/app.js'
    source=app.read_text()
    original="new URL('./comparison-worker.js',import.meta.url)"
    assert source.count(original)==1
    source=source.replace(original,'__originWorkerURL')
    app.write_text(source)
    bundle=temp/'app.js'
    subprocess.run([esbuild,str(app),'--bundle','--format=iife','--target=es2022','--minify','--legal-comments=inline',f'--outfile={bundle}'],check=True)
    worker_url='const __originWorkerURL=URL.createObjectURL(new Blob(['+json.dumps(worker.read_text())+'],{type:"text/javascript"}));\n'
    script=(worker_url+bundle.read_text()).replace('</script','<\\/script')
    css=re.sub(r"@import url\([^;]+;",'',(root/'dist/style.css').read_text())
    html=(root/'dist/index.html').read_text().replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
    html=html.replace('<script type="module" src="./app.js"></script>','<script>'+script+'</script>')
    output.write_text(html)
    print(f'{output.name}: {output.stat().st_size:,} bytes')
