import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'treasury.dart';
Future<Uint8List> reportPdf(Json report, {Map<String,Uint8List> evidence=const {}, bool includeEvidence=false}) async {
  final doc=pw.Document();
  final funds=rows(report['funds']);final entries=rows(report['entries']).where((e)=>e['status']=='posted').toList();
  final blue=PdfColor.fromHex('#102D50');
  pw.Widget table(List<String> headers,List<List<String>> data)=>pw.TableHelper.fromTextArray(headers:headers,data:data,headerStyle:pw.TextStyle(fontWeight:pw.FontWeight.bold,color:PdfColors.white),headerDecoration:pw.BoxDecoration(color:blue),cellStyle:const pw.TextStyle(fontSize:9),cellPadding:const pw.EdgeInsets.all(7),border:pw.TableBorder.all(color:PdfColors.grey300));
  doc.addPage(pw.MultiPage(pageFormat:PdfPageFormat.a4,margin:const pw.EdgeInsets.all(32),header:(c)=>pw.Column(crossAxisAlignment:pw.CrossAxisAlignment.start,children:[pw.Text('AMIGOS VERDADEROS',style:pw.TextStyle(fontWeight:pw.FontWeight.bold,color:blue,fontSize:20)),pw.Text('Narcóticos Anónimos · Informe de Tesorería'),pw.Divider(color:blue)]),footer:(c)=>pw.Text('Página ${c.pageNumber} de ${c.pagesCount} · Valores en USD',style:const pw.TextStyle(fontSize:9)),build:(c)=>[
    pw.SizedBox(height:16),pw.Text('Período: ${report['month'].toString().substring(0,7)}',style:pw.TextStyle(fontSize:17,fontWeight:pw.FontWeight.bold)),pw.SizedBox(height:12),
    table(['Fondo','Inicio','Ingresos','Egresos','Disponible'],funds.map((f)=>[f['fund']=='rent'?'Para el local':'General',money(f['opening']),money(f['income']),money(f['expense']),money(f['closing'])]).toList()),
    pw.SizedBox(height:10),pw.Text('El fondo general cubre gastos del grupo. El dinero para el local corresponde a aportes y pagos de arriendo. Las deudas pendientes y los borradores no son dinero disponible.',style:const pw.TextStyle(fontSize:10)),
    for(final kind in ['income','expense']) ...[
      pw.SizedBox(height:22),pw.Text(kind=='income'?'INGRESOS':'EGRESOS',style:pw.TextStyle(fontSize:14,color:blue,fontWeight:pw.FontWeight.bold)),pw.SizedBox(height:8),
      if(entries.where((e)=>e['kind']==kind).isEmpty) pw.Text('Sin movimientos confirmados.') else table(['Fecha','Detalle','Fondo','USD'],entries.where((e)=>e['kind']==kind).map((e)=>[e['entry_date'].toString(), '${categories[e['category']] ?? e['category']}\n${e['description'] ?? ''}${e['member_name']==null?'':'\n${e['member_name']}'}',e['fund']=='rent'?'Local':'General',money(e['amount_cents'])]).toList()),
    ],
    pw.SizedBox(height:22),pw.Text('APORTES INDIVIDUALES',style:pw.TextStyle(color:blue,fontWeight:pw.FontWeight.bold)),pw.SizedBox(height:8),
    table(['Compañero','Cuota','Recibido','Pendiente'],rows(report['dues']).map((d)=>[d['name'].toString(),money(d['expected']),money(d['paid']),money(((d['expected'] as num)-(d['paid'] as num)).clamp(0,100000000))]).toList()),
  ]));
  for(final e in entries.where((e)=>e['receipt_path']!=null)){
    if(!includeEvidence)break;
    final bytes=evidence[e['receipt_path']];
    doc.addPage(pw.Page(pageFormat:PdfPageFormat.a4,build:(c)=>pw.Column(crossAxisAlignment:pw.CrossAxisAlignment.start,children:[pw.Text('Comprobante · ${e['entry_date']} · ${money(e['amount_cents'])}',style:pw.TextStyle(fontWeight:pw.FontWeight.bold)),pw.Text(e['description']??''),pw.SizedBox(height:16),if(bytes!=null)pw.Expanded(child:pw.Center(child:pw.Image(pw.MemoryImage(bytes),fit:pw.BoxFit.contain)))else pw.Text('Comprobante no incluido. Consulta el original desde Tesorería.')])));
  }
  return doc.save();
}
