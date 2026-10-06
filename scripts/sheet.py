import sys,glob
from PIL import Image
d,pat,out,cols=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4])
fs=sorted(glob.glob(f'{d}/{pat}'))
w=260
ims=[Image.open(f).convert('RGB') for f in fs]
h=int(w*ims[0].height/ims[0].width)
rows=(len(ims)+cols-1)//cols
s=Image.new('RGB',(cols*w,rows*h),'white')
for i,im in enumerate(ims): s.paste(im.resize((w,h)),((i%cols)*w,(i//cols)*h))
s.save(out);print(len(ims),s.size)
