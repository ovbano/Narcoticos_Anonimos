"""Configure generated Android files without replacing existing app code."""
from pathlib import Path
import xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]
manifest=root/'android/app/src/main/AndroidManifest.xml'
ET.register_namespace('android','http://schemas.android.com/apk/res/android')
ns='{http://schemas.android.com/apk/res/android}'
tree=ET.parse(manifest);element=tree.getroot()
if not any(n.get(ns+'name')=='android.permission.INTERNET' for n in element.findall('uses-permission')):
    permission=ET.Element('uses-permission',{ns+'name':'android.permission.INTERNET'})
    element.insert(0,permission)
app=element.find('application');app.set(ns+'label','Tesorería · Amigos Verdaderos')
tree.write(manifest,encoding='utf-8',xml_declaration=True)
default_test=root/'test/widget_test.dart'
if default_test.exists() and 'MyApp' in default_test.read_text():default_test.unlink()
print('Android preparado: conexión a internet y nombre de la aplicación.')
