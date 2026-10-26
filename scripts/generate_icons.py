"""Export the geometric brand mark at favicon and home-screen sizes."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1] / 'public'
SCALE = 4

def logo(size, maskable=False):
    factor = size * SCALE / 64
    img = Image.new('RGBA', (size*SCALE, size*SCALE), (40,120,240,255) if maskable else (0,0,0,0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0,0,size*SCALE-1,size*SCALE-1), radius=18*factor, fill='#2878f0')
    def box(coords):
        if maskable: coords = tuple(6.4 + .8*x for x in coords)
        return tuple(round(x*factor) for x in coords)
    # Same f geometry as favicon.svg, with a rounded upper shoulder.
    d.rounded_rectangle(box((20,10,46,41)), radius=13*factor*(.8 if maskable else 1), fill='white')
    d.rectangle(box((20,25,32,52)), fill='white')
    d.rectangle(box((32,22,47,29)), fill='#2878f0')
    d.rectangle(box((32,41,47,53)), fill='#2878f0')
    d.rectangle(box((20,30,45,41)), fill='white')
    d.ellipse(box((40,40,54,54)), fill='#ffcb55')
    return img.resize((size,size), Image.Resampling.LANCZOS)

for size in [16,32,192,512]: logo(size).save(ROOT/f'icon-{size}.png')
apple = Image.new('RGB', (180,180), '#2878f0')
apple_icon = logo(180)
apple.paste(apple_icon, mask=apple_icon.getchannel('A'))
apple.save(ROOT/'apple-touch-icon.png')
logo(512,True).convert('RGB').save(ROOT/'icon-maskable-512.png')
logo(64).save(ROOT/'favicon.ico', sizes=[(16,16),(32,32),(48,48),(64,64)])
