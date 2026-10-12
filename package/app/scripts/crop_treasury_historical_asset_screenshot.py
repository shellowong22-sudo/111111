from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/screenshots/webdev-preview-yield_curve-1787676328668385833-2580.png')
target = Path('/home/ubuntu/screenshots/treasury-historical-asset-loaded-proof.png')

with Image.open(source) as image:
    crop = image.crop((0, 1950, image.width, image.height))
    crop.save(target)

print(target)
