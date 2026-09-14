import json,struct,math,io
import bpy, tempfile
from pathlib import Path
p=Path('/home/liveuser/Documents/ford-bronco-web-20260914/Ud.glb')
b=p.read_bytes(); jl=struct.unpack_from('<I',b,12)[0]; j=json.loads(b[20:20+jl]); data=bytearray(b[28+jl:])
def location(ai,k):
 a=j['accessors'][ai]; v=j['bufferViews'][a['bufferView']]
 return v.get('byteOffset',0)+a.get('byteOffset',0)+k*v.get('byteStride',{'VEC3':12,'VEC4':16}[a['type']])
fixed=0
for mesh in j['meshes']:
 for primitive in mesh['primitives']:
  attr=primitive['attributes']
  if 'TANGENT' not in attr:continue
  ta=attr['TANGENT']; na=attr['NORMAL']
  for k in range(j['accessors'][ta]['count']):
   off=location(ta,k); x,y,z,w=struct.unpack_from('<4f',data,off)
   if x*x+y*y+z*z<0.5:
    nx,ny,nz=struct.unpack_from('<3f',data,location(na,k))
    x,y,z=(0,nz,-ny) if abs(nx)<0.9 else (-nz,0,nx)
    length=math.sqrt(x*x+y*y+z*z)
    if length==0:x,y,z,length=1,0,0,1
    struct.pack_into('<4f',data,off,x/length,y/length,z/length,w);fixed+=1
images={im['bufferView']:im for im in j['images']}
new=bytearray()
for vi,v in enumerate(j['bufferViews']):
 chunk=bytes(data[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
 im=images.get(vi)
 if im and im['mimeType']=='image/png' and 'Normal' not in im.get('name',''):
  temp=Path('/tmp/ud-texture-'+str(vi)+'.png'); temp.write_bytes(chunk)
  img=bpy.data.images.load(str(temp)); img.colorspace_settings.name='Non-Color'; first=img.pixels[0]; img.file_format='JPEG'; img.filepath_raw=str(temp.with_suffix('.jpg')); img.save()
  compressed=temp.with_suffix('.jpg').read_bytes(); bpy.data.images.remove(img)
  if len(compressed)<len(chunk):chunk=compressed;im['mimeType']='image/jpeg'
 new.extend(b'\0'*((-len(new))%4));v['byteOffset']=len(new);v['byteLength']=len(chunk);new.extend(chunk)
j['buffers'][0]['byteLength']=len(new);new.extend(b'\0'*((-len(new))%4))
js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(js)+len(new))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(new),0x004e4942)+new)
print('Corrected tangents:',fixed,'Final bytes:',p.stat().st_size)
