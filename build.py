# Builds the published app:
#   index.html  = template.html with gen.js and the vendored abcjs inlined (one self-contained page)
#   sw.js       = service worker; its cache name carries a hash of the files, so installed copies update
from pathlib import Path
import hashlib

d = Path(__file__).resolve().parent
s = (d / 'template.html').read_text()
for ph in ('/*GEN_JS*/', '/*ABCJS*/'):
    assert ph in s, ph
s = s.replace('/*GEN_JS*/', (d / 'gen.js').read_text())
s = s.replace('/*ABCJS*/', (d / 'vendor' / 'abcjs-basic-min.js').read_text())
(d / 'index.html').write_text(s)

ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'] + \
    sorted('fonts/' + f.name for f in (d / 'fonts').glob('*.woff2'))
h = hashlib.sha256()
for a in ASSETS[1:]:
    h.update((d / a).read_bytes())
version = h.hexdigest()[:10]
sw = (d / 'sw.template.js').read_text()
sw = sw.replace('__VERSION__', version).replace('__ASSETS__', repr(ASSETS).replace("'", '"'))
(d / 'sw.js').write_text(sw)
print('built index.html + sw.js (version ' + version + ')')

# --site: also run the generator tests and collect ONLY the published app files in _site/ (used by Cloudflare Pages and CI)
import sys, shutil, subprocess, re
if '--site' in sys.argv:
    out = subprocess.run(['node', str(d / 'tests' / 'test_generators.js')], capture_output=True, text=True)
    bad = out.returncode != 0 or re.search(r'\b[1-9]\d* (failures|choice problems|non-existent)', out.stdout)
    if bad:
        print(out.stdout[-3000:], out.stderr[-3000:])
        sys.exit('generator tests failed: not publishing')
    site = d / '_site'
    shutil.rmtree(site, ignore_errors=True)
    site.mkdir()
    for f in ('index.html', 'sw.js', 'manifest.webmanifest'):
        shutil.copy(d / f, site / f)
    shutil.copytree(d / 'icons', site / 'icons')
    (site / 'fonts').mkdir()
    for f in list((d / 'fonts').glob('*.woff2')) + list((d / 'fonts').glob('*-OFL.txt')):
        shutil.copy(f, site / 'fonts' / f.name)
    print('tests passed; site files collected in _site/')
