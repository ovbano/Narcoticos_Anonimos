import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:amigos_tesoreria/treasury.dart';
import 'package:amigos_tesoreria/report_pdf.dart';
void main(){
  test('La aplicación no acepta claves administrativas',(){
    expect(isPublicKey('sb_secret_test'),false);
    expect(isPublicKey('sb_publishable_test'),true);
    String jwt(String role)=>'header.${base64Url.encode(utf8.encode(jsonEncode({'role':role})))}.signature';
    expect(isPublicKey(jwt('anon')),true);expect(isPublicKey(jwt('service_role')),false);
  });
  test('Los importes se convierten a centavos exactos sin redondeo binario',(){expect(cents('3,20'),320);expect(cents('247.90'),24790);expect(cents('0.01'),1);expect(cents('12'),1200);});
  test('Se rechazan valores negativos y fracciones de centavo',(){expect(()=>cents('-1'),throwsFormatException);expect(()=>cents('1.001'),throwsFormatException);expect(()=>cents('1000001'),throwsFormatException);});
  test('Un borrador puede tener importe pendiente',(){expect(cents('',optional:true),isNull);expect(()=>cents(''),throwsFormatException);});
  test('El período siempre usa el primer día del mes',(){expect(period(DateTime(2026,9,29)),'2026-09-01');});
  test('El informe con movimientos y sin fotos genera un PDF',()async{
    final data=await reportPdf({'month':'2026-09-01','funds':[{'fund':'general','opening':10000,'income':320,'expense':500,'closing':9820},{'fund':'rent','opening':0,'income':0,'expense':0,'closing':0}],'entries':[{'status':'posted','kind':'income','category':'seventh','entry_date':'2026-09-26','description':'Reunión del grupo','fund':'general','amount_cents':320}],'dues':[]});
    expect(String.fromCharCodes(data.take(5)),'%PDF-');expect(data.length,greaterThan(1000));
  });
}
