"""Reproduce the full-character optimized font using fonttools==4.68.0 and brotli==1.2.1 (development tools only)."""
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.recordingPen import DecomposingRecordingPen

ROOT = Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / 'data/font-performance/manifest.json').read_text())
results = []
with TemporaryDirectory(prefix='worktops-fonts-') as folder:
    for item in manifest['fonts']:
        data = urlopen(item['sourceUrl']).read()
        if hashlib.sha256(data).hexdigest() != item['sourceSha256']:
            raise ValueError('Source font changed; review before regenerating: ' + item['name'])
        source = Path(folder) / (item['name'] + '.woff2')
        source.write_bytes(data)
        original = TTFont(source)
        input_file = source
        if item['name'] == 'fraunces':
            optical = instantiateVariableFont(TTFont(source, recalcTimestamp=False), {'SOFT': 0, 'WONK': 1})
            input_file = Path(folder) / 'optical.woff2'
            optical.save(input_file)
        output = ROOT / item['file']
        output.write_bytes(input_file.read_bytes())
        item['sha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
        item['bytes'] = output.stat().st_size
        reduced = TTFont(output)
        for table, fields in [('hhea', ['ascent', 'descent', 'lineGap']),
                              ('OS/2', ['sTypoAscender', 'sTypoDescender', 'sTypoLineGap', 'usWinAscent', 'usWinDescent'])]:
            for field in fields:
                assert getattr(original[table], field) == getattr(reduced[table], field)
        for font in [original, reduced]:
            axis = next(axis for axis in font['fvar'].axes if axis.axisTag == 'opsz')
            values = (axis.minValue, axis.defaultValue, axis.maxValue)
            if font is original:
                expected_axis = values
            else:
                assert values == expected_axis
        assert original.getBestCmap() == reduced.getBestCmap()
        max_point_delta = 0
        for size in ([9, 12, 36, 72, 144] if item['name'] == 'fraunces' else [9, 12, 24, 40]):
            left = original.getGlyphSet(location={'opsz': size})
            right = reduced.getGlyphSet(location={'opsz': size})
            for code, bn in reduced.getBestCmap().items():
                an = original.getBestCmap()[code]
                assert abs(left[an].width - right[bn].width) < .01
                pa, pb = DecomposingRecordingPen(left), DecomposingRecordingPen(right)
                left[an].draw(pa)
                right[bn].draw(pb)
                assert len(pa.value) == len(pb.value)
                for (oa, va), (ob, vb) in zip(pa.value, pb.value):
                    assert oa == ob and len(va) == len(vb)
                    for xa, xb in zip(va, vb):
                        max_point_delta = max(max_point_delta, *(abs(x-y) for x, y in zip(xa, xb)))
        assert max_point_delta <= .500001  # At most half a font unit from variable-font instancing rounding.
        results.append({'font': item['name'], 'glyphs': len(reduced.getBestCmap()), 'maxOutlineDeltaFontUnits': max_point_delta,
                        'advanceWidthsMatch': True, 'lineMetricsMatch': True, 'opticalAxisMatch': True, 'bytes': output.stat().st_size})
(ROOT / 'data/font-performance/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(ROOT / 'data/font-performance/verification.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
