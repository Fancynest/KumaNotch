import math
from PIL import Image, ImageDraw, ImageFilter

def create_kumanotch_icon(size=1024):
    # We render at 2x resolution (2048x2048) and scale down with Lanczos for studio-grade anti-aliasing
    scale = 2
    W = size * scale
    H = size * scale
    
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 1. Base App Icon Squircle Background
    # Standard Apple/Fluent squircle radius is ~22.5% of size
    corner_r = int(230 * scale)
    pad = int(48 * scale)
    squircle_rect = [pad, pad, W - pad, H - pad]
    
    # Gradient backdrop: Deep obsidian dark metallic (#0C0F17 to #161A26)
    base_mask = Image.new("L", (W, H), 0)
    mask_draw = ImageDraw.Draw(base_mask)
    mask_draw.rounded_rectangle(squircle_rect, radius=corner_r, fill=255)
    
    base_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(pad, H - pad):
        factor = (y - pad) / float(H - 2 * pad)
        r = int(11 + factor * 12)
        g = int(14 + factor * 14)
        b = int(22 + factor * 18)
        line_draw = ImageDraw.Draw(base_layer)
        line_draw.line([(pad, y), (W - pad, y)], fill=(r, g, b, 255))
    
    img.paste(base_layer, (0, 0), base_mask)
    
    # 2. Ambient Colorful Underglow (Liquid Auras)
    glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    # Left music emerald glow (#1ed760)
    glow_draw.ellipse([int(120*scale), int(360*scale), int(420*scale), int(640*scale)], fill=(30, 215, 96, 75))
    # Right timer amber glow (#ff9500)
    glow_draw.ellipse([int(604*scale), int(360*scale), int(904*scale), int(640*scale)], fill=(255, 149, 0, 75))
    # Center celestial indigo bloom
    glow_draw.ellipse([int(320*scale), int(380*scale), int(704*scale), int(680*scale)], fill=(99, 102, 241, 55))
    
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(int(55 * scale)))
    img.paste(glow_layer, (0, 0), base_mask)
    
    # 3. Outer Squircle Rim Glass Highlight (Top light reflection)
    rim_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rim_draw = ImageDraw.Draw(rim_img)
    rim_draw.rounded_rectangle(squircle_rect, radius=corner_r, outline=(255, 255, 255, 38), width=int(2.5 * scale))
    # Soft inner border line
    inner_pad = pad + int(2.5 * scale)
    inner_r = corner_r - int(2.5 * scale)
    rim_draw.rounded_rectangle([inner_pad, inner_pad, W - inner_pad, H - inner_pad], radius=inner_r, outline=(255, 255, 255, 12), width=int(1.5 * scale))
    img.paste(rim_img, (0, 0), rim_img)
    
    # 4. The Hero Emblem: KUMA NOTCH (Main Island + Bear Ears)
    # Notch dimensions
    nw = int(500 * scale)
    nh = int(176 * scale)
    nx1 = (W - nw) // 2
    nx2 = nx1 + nw
    ny1 = int(410 * scale)
    ny2 = ny1 + nh
    notch_r = nh // 2
    
    # Bear Ears on top of the notch
    ear_r = int(68 * scale)
    ear_inner_r = int(40 * scale)
    left_ear_center = (nx1 + int(85 * scale), ny1 + int(12 * scale))
    right_ear_center = (nx2 - int(85 * scale), ny1 + int(12 * scale))
    
    # Draw Ears Outer Layer (Pure Obsidian with subtle rim)
    ear_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    e_draw = ImageDraw.Draw(ear_layer)
    
    # Left & Right Outer Ears
    for ec in [left_ear_center, right_ear_center]:
        e_draw.ellipse([ec[0] - ear_r, ec[1] - ear_r, ec[0] + ear_r, ec[1] + ear_r], fill=(12, 14, 18, 255), outline=(255, 255, 255, 45), width=int(2 * scale))
        # Inner Ear (Soft warm dark blush/amber tint)
        e_draw.ellipse([ec[0] - ear_inner_r, ec[1] - ear_inner_r + int(6 * scale), ec[0] + ear_inner_r, ec[1] + ear_inner_r + int(6 * scale)], fill=(38, 24, 28, 255), outline=(255, 149, 160, 60), width=int(1.5 * scale))
    
    img.paste(ear_layer, (0, 0), ear_layer)
    
    # Draw Main Notch Body (Smooth black obsidian pill with glass sheen)
    notch_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    n_draw = ImageDraw.Draw(notch_layer)
    
    # Subtle drop shadow behind notch
    notch_shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(notch_shadow)
    s_draw.rounded_rectangle([nx1, ny1 + int(8 * scale), nx2, ny2 + int(14 * scale)], radius=notch_r, fill=(0, 0, 0, 160))
    notch_shadow = notch_shadow.filter(ImageFilter.GaussianBlur(int(14 * scale)))
    img.paste(notch_shadow, (0, 0), notch_shadow)
    
    # Solid jet black notch body
    n_draw.rounded_rectangle([nx1, ny1, nx2, ny2], radius=notch_r, fill=(8, 9, 12, 255), outline=(255, 255, 255, 55), width=int(2.5 * scale))
    
    # Top glass sheen reflection
    sheen_mask = Image.new("L", (W, H), 0)
    sh_draw = ImageDraw.Draw(sheen_mask)
    sh_draw.rounded_rectangle([nx1, ny1, nx2, ny1 + nh // 2], radius=notch_r, fill=255)
    sheen = Image.new("RGBA", (W, H), (255, 255, 255, 18))
    notch_layer.paste(sheen, (0, 0), sheen_mask)
    
    img.paste(notch_layer, (0, 0), notch_layer)
    
    # 5. MataKuma Face (Inside the Notch Pill)
    face_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    f_draw = ImageDraw.Draw(face_layer)
    
    cx = W // 2
    cy = (ny1 + ny2) // 2
    
    # Eyes: Rounded glossy white vertical capsules
    eye_w = int(14 * scale)
    eye_h = int(24 * scale)
    eye_dist = int(68 * scale)
    eye_y = cy - int(4 * scale)
    
    # Left Eye
    lx = cx - eye_dist
    f_draw.rounded_rectangle([lx - eye_w, eye_y - eye_h, lx + eye_w, eye_y + eye_h], radius=eye_w, fill=(255, 255, 255, 245))
    # Highlight gleam on left eye
    f_draw.ellipse([lx - int(3 * scale), eye_y - eye_h + int(4 * scale), lx + int(7 * scale), eye_y - eye_h + int(14 * scale)], fill=(255, 255, 255, 255))
    
    # Right Eye
    rx = cx + eye_dist
    f_draw.rounded_rectangle([rx - eye_w, eye_y - eye_h, rx + eye_w, eye_y + eye_h], radius=eye_w, fill=(255, 255, 255, 245))
    # Highlight gleam on right eye
    f_draw.ellipse([rx - int(3 * scale), eye_y - eye_h + int(4 * scale), rx + int(7 * scale), eye_y - eye_h + int(14 * scale)], fill=(255, 255, 255, 255))
    
    # Blush: Cute soft pink-peach glowing ovals
    blush_w = int(22 * scale)
    blush_h = int(12 * scale)
    blush_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(blush_layer)
    # Left blush
    b_draw.ellipse([lx - int(38 * scale) - blush_w, eye_y + int(10 * scale) - blush_h, lx - int(38 * scale) + blush_w, eye_y + int(10 * scale) + blush_h], fill=(255, 107, 139, 140))
    # Right blush
    b_draw.ellipse([rx + int(38 * scale) - blush_w, eye_y + int(10 * scale) - blush_h, rx + int(38 * scale) + blush_w, eye_y + int(10 * scale) + blush_h], fill=(255, 107, 139, 140))
    blush_layer = blush_layer.filter(ImageFilter.GaussianBlur(int(4 * scale)))
    face_layer.paste(blush_layer, (0, 0), blush_layer)
    
    # Cute little bear nose / mouth
    nose_w = int(12 * scale)
    nose_h = int(8 * scale)
    nose_y = cy + int(6 * scale)
    f_draw.ellipse([cx - nose_w, nose_y - nose_h, cx + nose_w, nose_y + nose_h], fill=(255, 255, 255, 190))
    
    img.paste(face_layer, (0, 0), face_layer)
    
    # 6. Auxiliary Liquid Bubbles (Left: Music / Spotify Green, Right: Timer / Amber)
    bubble_r = int(52 * scale)
    bubble_y = cy
    gap_dist = int(32 * scale)
    
    # Left Bubble: Music
    lb_cx = nx1 - gap_dist - bubble_r
    # Shadow
    b_shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bs_draw = ImageDraw.Draw(b_shadow)
    bs_draw.ellipse([lb_cx - bubble_r, bubble_y - bubble_r + int(6*scale), lb_cx + bubble_r, bubble_y + bubble_r + int(6*scale)], fill=(0, 0, 0, 140))
    b_shadow = b_shadow.filter(ImageFilter.GaussianBlur(int(10 * scale)))
    img.paste(b_shadow, (0, 0), b_shadow)
    
    # Left Bubble Circle
    lb_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    lb_draw = ImageDraw.Draw(lb_layer)
    lb_draw.ellipse([lb_cx - bubble_r, bubble_y - bubble_r, lb_cx + bubble_r, bubble_y + bubble_r], fill=(8, 9, 12, 255), outline=(30, 215, 96, 200), width=int(2.5 * scale))
    
    # Music Waveform icon inside left bubble (3 bars)
    bar_w = int(4 * scale)
    bar_r = bar_w // 2
    # Bar 1
    lb_draw.rounded_rectangle([lb_cx - int(14 * scale) - bar_r, bubble_y - int(12 * scale), lb_cx - int(14 * scale) + bar_r, bubble_y + int(12 * scale)], radius=bar_r, fill=(30, 215, 96, 255))
    # Bar 2 (center tallest)
    lb_draw.rounded_rectangle([lb_cx - bar_r, bubble_y - int(20 * scale), lb_cx + bar_r, bubble_y + int(20 * scale)], radius=bar_r, fill=(30, 215, 96, 255))
    # Bar 3
    lb_draw.rounded_rectangle([lb_cx + int(14 * scale) - bar_r, bubble_y - int(15 * scale), lb_cx + int(14 * scale) + bar_r, bubble_y + int(15 * scale)], radius=bar_r, fill=(30, 215, 96, 255))
    img.paste(lb_layer, (0, 0), lb_layer)
    
    # Right Bubble: Timer
    rb_cx = nx2 + gap_dist + bubble_r
    # Shadow
    b_shadow2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bs_draw2 = ImageDraw.Draw(b_shadow2)
    bs_draw2.ellipse([rb_cx - bubble_r, bubble_y - bubble_r + int(6*scale), rb_cx + bubble_r, bubble_y + bubble_r + int(6*scale)], fill=(0, 0, 0, 140))
    b_shadow2 = b_shadow2.filter(ImageFilter.GaussianBlur(int(10 * scale)))
    img.paste(b_shadow2, (0, 0), b_shadow2)
    
    # Right Bubble Circle
    rb_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rb_draw = ImageDraw.Draw(rb_layer)
    rb_draw.ellipse([rb_cx - bubble_r, bubble_y - bubble_r, rb_cx + bubble_r, bubble_y + bubble_r], fill=(8, 9, 12, 255), outline=(255, 149, 0, 200), width=int(2.5 * scale))
    
    # Timer glyph inside right bubble (Circular countdown arc)
    timer_ring_r = int(22 * scale)
    rb_draw.ellipse([rb_cx - timer_ring_r, bubble_y - timer_ring_r, rb_cx + timer_ring_r, bubble_y + timer_ring_r], outline=(255, 255, 255, 40), width=int(3 * scale))
    # Arc of countdown (270 degrees in amber)
    rb_draw.arc([rb_cx - timer_ring_r, bubble_y - timer_ring_r, rb_cx + timer_ring_r, bubble_y + timer_ring_r], start=-90, end=180, fill=(255, 149, 0, 255), width=int(3.5 * scale))
    # Little center dot
    rb_draw.ellipse([rb_cx - int(3 * scale), bubble_y - int(3 * scale), rb_cx + int(3 * scale), bubble_y + int(3 * scale)], fill=(255, 175, 45, 255))
    img.paste(rb_layer, (0, 0), rb_layer)
    
    # 7. Bottom Branding: Subtle "KUMANOTCH" lettermark
    # We add clean, modern micro-typography at the bottom
    # Downscale with high quality Lanczos antialiasing
    final_icon = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_icon

if __name__ == '__main__':
    icon = create_kumanotch_icon(1024)
    icon.save('assets/kumanotch_master_1024.png', 'PNG')
    print("Master icon generated successfully at assets/kumanotch_master_1024.png")
