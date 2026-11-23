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
