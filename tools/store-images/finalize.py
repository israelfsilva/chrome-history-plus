# Reduz de @2x para o tamanho exigido pela loja e remove o canal alfa (PNG 24 bits)
import sys, os, zlib, struct, subprocess, shutil, tempfile
def read_png(path):
    d = open(path, 'rb').read(); pos = 8; idat = b''
    while pos < len(d):
        l, = struct.unpack('>I', d[pos:pos+4]); t = d[pos+4:pos+8]; c = d[pos+8:pos+8+l]; pos += 12 + l
        if t == b'IHDR': w, h, bd, ct = struct.unpack('>IIBB', c[:10])
        elif t == b'IDAT': idat += c
    assert bd == 8 and ct in (2, 6), (bd, ct)
    bpp = 4 if ct == 6 else 3; raw = zlib.decompress(idat); stride = w * bpp
    out = bytearray(h * stride); prev = bytearray(stride); i = 0
    for y in range(h):
        f = raw[i]; i += 1; line = bytearray(raw[i:i+stride]); i += stride
        if f == 1:
            for x in range(bpp, stride): line[x] = (line[x] + line[x-bpp]) & 255
        elif f == 2:
            for x in range(stride): line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride): line[x] = (line[x] + (((line[x-bpp] if x >= bpp else 0) + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x-bpp] if x >= bpp else 0; b = prev[x]; c = prev[x-bpp] if x >= bpp else 0
                p = a + b - c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out[y*stride:(y+1)*stride] = line; prev = line
    return w, h, bpp, out
def write_rgb(path, w, h, bpp, px):
    rows = bytearray()
    for y in range(h):
        rows.append(0); row = px[y*w*bpp:(y+1)*w*bpp]
        rows.extend(row if bpp == 3 else bytes(b for i, b in enumerate(row) if i % 4 != 3))
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(bytes(rows), 9)) + ch(b'IEND', b''))
src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.endswith('@2x.png'): continue
    out = os.path.join(dst, name.replace('@2x', ''))
    tmp = tempfile.mktemp(suffix='.png')
    w2, h2 = struct.unpack('>II', open(os.path.join(src, name), 'rb').read()[16:24])
    subprocess.run(['sips', '-z', str(h2 // 2), str(w2 // 2), os.path.join(src, name), '--out', tmp], check=True, capture_output=True)
    w, h, bpp, px = read_png(tmp); os.remove(tmp)
    write_rgb(out, w, h, bpp, px); print(out.split('/')[-1], w, 'x', h)
