import os
import sys
import zlib
import struct
import math


def create_png(width, height, rgba_data):
    def chunk(tag, data):
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png += chunk(b'IHDR', ihdr_data)

    raw_scanlines = bytearray()
    for y in range(height):
        raw_scanlines.append(0)
        row_start = y * width * 4
        raw_scanlines.extend(rgba_data[row_start : row_start + width * 4])

    idat_data = zlib.compress(bytes(raw_scanlines), level=9)
    png += chunk(b'IDAT', idat_data)
    png += chunk(b'IEND', b'')
    return png


def point_in_polygon(px, py, vertices):
    inside = False
    n = len(vertices)
    j = n - 1
    for i in range(n):
        xi, yi = vertices[i]
        xj, yj = vertices[j]
        if ((yi > py) != (yj > py)) and (
            px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi
        ):
            inside = not inside
        j = i
    return inside


def make_star_vertices(cx, cy, r_outer, r_inner, points=5):
    verts = []
    for i in range(points * 2):
        angle = -math.pi / 2.0 + i * (math.pi / points)
        r = r_outer if i % 2 == 0 else r_inner
        verts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return verts


def make_clock_hand_vertices(stroke):
    """
    Ponteiro central com cantos retos (como o "history" do Material Symbols): haste vertical
    em x = 12 descendo de y = 7 até o centro e dobrando a 45 graus até (13.8, 13.8),
    com espessura `stroke` e junção em esquadria (miter).
    """
    h = stroke / 2.0
    k = math.sqrt(2.0) - 1.0
    d = h / math.sqrt(2.0)
    ex, ey = 13.8, 13.8
    return [
        (12.0 - h, 7.0),
        (12.0 + h, 7.0),
        (12.0 + h, 12.0 - h * k),
        (ex + d, ey - d),
        (ex - d, ey + d),
        (12.0 - h, 12.0 + h * k),
    ]


# Estrela na mesma caixa (~7x7) que o X ocupa no "delete_history" do Material Symbols:
# x 15.2..22.8, y 13.6..20.8 (um pouco maior que o X para compensar as pontas finas), encostada no canto inferior direito do anel.
STAR_RADIUS = 4.0
STAR_VERTS = make_star_vertices(19.0, 17.6, r_outer=STAR_RADIUS, r_inner=STAR_RADIUS * 0.45, points=5)


def icon_part_at(gx, gy, stroke, hand_verts):
    """
    Retorna a parte do ícone no ponto (gx, gy) da grade 24x24 do Material Symbols:
    'base', 'star' ou None. As proporções seguem os ícones "history" / "delete_history":
    - Base: anel com centro (12, 12), raio 8 e traço 2, seta em L com pontas retas
      e ponteiro central chanfrado.
    - Estrelinha de 5 pontas no canto inferior-direito no lugar do X.
    `stroke` é a espessura dos traços em unidades da grade (2.0 no Material).
    """
    cx, cy = 12.0, 12.0
    h = stroke / 2.0
    r_in = 8.0 - h
    r_out = 8.0 + h

    dx = gx - cx
    dy = gy - cy
    dist = math.hypot(dx, dy)
    angle_deg = math.degrees(math.atan2(dy, dx))  # -180..180 (0 = direita, 90 = baixo, -90 = topo)

    # 1. Seta em L no canto superior-esquerdo, alinhada ao traço do anel (x = 4) e terminando em y = 9
    in_arrow_v = (4.0 - h <= gx <= 4.0 + h) and (4.0 <= gy <= 9.0 + h)
    in_arrow_h = (4.0 - h <= gx <= 9.0) and (9.0 - h <= gy <= 9.0 + h)
    if in_arrow_v or in_arrow_h:
        return 'base'

    if r_in <= dist <= r_out:
        # 2. Arco superior: nasce na haste da seta e vai até as 3 horas
        if -158.0 <= angle_deg <= 0.0 and gy <= 12.2:
            return 'base'
        # 3. Arco inferior-esquerdo: de y = 13 na esquerda até um pouco depois das 6 horas
        if gx <= 13.1 and gy >= 13.0 and 0.0 <= angle_deg <= 180.0:
            return 'base'

    # 4. Ponteiro do relógio no centro
    if point_in_polygon(gx, gy, hand_verts):
        return 'base'

    # 5. Estrelinha no canto inferior-direito
    if point_in_polygon(gx, gy, STAR_VERTS):
        return 'star'

    return None


# Janela da grade 24 usada nos PNGs: recorta o desenho (x 3..22.5, y 3..21.5) com folga mínima,
# para o ícone ocupar o mesmo espaço visual dos ícones nativos da barra de ferramentas.
VIEW_X0, VIEW_Y0, VIEW_SPAN = 2.75, 2.25, 20.0


# Cor única (azul Google): o Chrome não tinge ícones de extensão conforme o tema e não expõe
# a cor da barra, então usamos um tom médio legível em barras claras, escuras e coloridas.
ICON_RGB = (66, 133, 244)   # #4285F4

# Ajustes por tamanho:
# - stroke: traços mais grossos nos tamanhos pequenos para não "borrar" na barra de ferramentas
# - margin: área transparente em pixels (a Chrome Web Store pede 16px no ícone de 128)
# - sharpen: aumenta o contraste das bordas antialiased nos tamanhos pequenos
SIZE_SETTINGS = {
    16: {'stroke': 2.6, 'margin': 0, 'sharpen': 1.8},
    32: {'stroke': 2.3, 'margin': 0, 'sharpen': 1.3},
    48: {'stroke': 2.1, 'margin': 1, 'sharpen': 1.1},
    128: {'stroke': 2.0, 'margin': 16, 'sharpen': 1.0},
}


def render_icon(size, rgb, stroke=2.0, margin=0, sharpen=1.0, view=None):
    """
    Renderiza o ícone com superamostragem 6x6 por pixel para antialiasing nítido.
    """
    rgba = bytearray(size * size * 4)
    view_x0, view_y0, view_span = view or (VIEW_X0, VIEW_Y0, VIEW_SPAN)
    scale = view_span / (size - 2 * margin)
    hand_verts = make_clock_hand_vertices(stroke)
    samples = 6
    inv_samples2 = 1.0 / (samples * samples)

    for y in range(size):
        for x in range(size):
            hits = 0
            for sy in range(samples):
                gy = view_y0 + (y - margin + (sy + 0.5) / samples) * scale
                for sx in range(samples):
                    gx = view_x0 + (x - margin + (sx + 0.5) / samples) * scale
                    if icon_part_at(gx, gy, stroke, hand_verts):
                        hits += 1

            if hits == 0:
                continue

            alpha = hits * inv_samples2
            alpha = min(1.0, max(0.0, (alpha - 0.5) * sharpen + 0.5))
            if alpha <= 0.0:
                continue

            idx = (y * size + x) * 4
            rgba[idx : idx + 3] = bytes(rgb)
            rgba[idx + 3] = int(round(alpha * 255))

    return create_png(size, size, rgba)


if __name__ == '__main__':
    # Padrão: pasta icons/ na raiz do repositório (este script fica em tools/)
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
    os.makedirs(out_dir, exist_ok=True)
    # Remove variantes antigas por tema/estado caso existam
    for old_file in os.listdir(out_dir):
        if old_file.startswith(('icon-active-', 'icon-light-', 'icon-dark-')):
            os.remove(os.path.join(out_dir, old_file))

    for s, settings in SIZE_SETTINGS.items():
        data = render_icon(s, ICON_RGB, **settings)
        path = os.path.join(out_dir, f'icon-{s}.png')
        with open(path, 'wb') as f:
            f.write(data)
        print(f'Generated {path} ({len(data)} bytes)')
