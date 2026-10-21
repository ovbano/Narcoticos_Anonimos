import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';
import 'treasury.dart';

class EntryEditor extends StatefulWidget {
  const EntryEditor({super.key,required this.repo,required this.month,required this.settings,required this.members,required this.companions,this.entry});
  final TreasuryRepository repo;final DateTime month;final Json settings;final List<Json> members,companions;final Json? entry;
  @override State<EntryEditor> createState()=>_EntryEditorState();
}
class _EntryEditorState extends State<EntryEditor> {
  final amount=TextEditingController(),description=TextEditingController(),noReceipt=TextEditingController(),reason=TextEditingController();
  late String id,kind,category,fund;late int version;late DateTime date,due;String? memberId,receiptPath,error;XFile? photo;bool busy=false,dirty=false;
  bool get correcting=>widget.entry?['status']=='posted';bool get rent=>category=='rent_contribution';
  @override void initState(){super.initState();final e=widget.entry??{};id=e['id']??const Uuid().v4();version=e['version']??0;kind=e['kind']??'income';category=e['category']??'seventh';fund=e['fund']??'general';date=DateTime.parse(e['entry_date']??iso(today()));due=DateTime.parse(e['due_month']??period(widget.month));memberId=e['member_id'];receiptPath=e['receipt_path'];amount.text=e['amount_cents']==null?'':((e['amount_cents'] as num)/100).toStringAsFixed(2);description.text=e['description']??'';noReceipt.text=e['no_receipt_reason']??'';for(final c in [amount,description,noReceipt,reason]){c.addListener(()=>dirty=true);}}
  @override void dispose(){for(final c in [amount,description,noReceipt,reason]){c.dispose();}super.dispose();}
  void changed(VoidCallback update){setState((){update();dirty=true;});}
  Future<void> pick(ImageSource source) async {try{final result=await ImagePicker().pickImage(source:source,maxWidth:1600,maxHeight:1600,imageQuality:78);if(result!=null)changed(()=>photo=result);}catch(e){if(mounted)setState(()=>error='No se pudo abrir la cámara o galería. Revisa los permisos.');}}
  Future<bool> leave()async {if(busy)return false;if(!dirty)return true;return await showDialog<bool>(context:context,builder:(c)=>AlertDialog(title:const Text('¿Salir sin guardar?'),content:const Text('Los datos que has escrito se perderán. Puedes volver y guardarlos como borrador.'),actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Seguir editando')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Salir'))]))??false;}
  Future<void> chooseMember() async {
    final choices=<Json>[...widget.members.map((m)=>{'value':m['id'],'name':m['name']}),...widget.companions.where((c)=>!widget.members.any((m)=>m['source_anniversary_id']==c['id'])).map((c)=>{'value':'source:${c['id']}','name':c['name']})];
    final selected=await showModalBottomSheet<String>(context:context,isScrollControlled:true,useSafeArea:true,builder:(context){var query='';return StatefulBuilder(builder:(context,set)=>Padding(padding:EdgeInsets.fromLTRB(20,20,20,MediaQuery.viewInsetsOf(context).bottom+20),child:SizedBox(height:MediaQuery.sizeOf(context).height*.65,child:Column(children:[TextField(autofocus:true,decoration:const InputDecoration(labelText:'Buscar compañero',prefixIcon:Icon(Icons.search)),onChanged:(v)=>set(()=>query=v.toLowerCase())),const SizedBox(height:12),Expanded(child:ListView(children:choices.where((c)=>c['name'].toString().toLowerCase().contains(query)).map((c)=>ListTile(leading:const Icon(Icons.person_outline),title:Text(c['name']),onTap:()=>Navigator.pop(context,c['value']))).toList()))]))));});
    if(selected!=null)changed(()=>memberId=selected);
  }
  Future<void> save(bool posted) async {
    if(busy)return;
    try {
      final value=cents(amount.text,optional:!posted);if(value!=null&&value<=0)throw const FormatException('Indica un monto mayor que cero.');
      if(posted&&description.text.trim().length<3)throw const FormatException('Describe el movimiento.');
      if(posted&&rent&&memberId==null)throw const FormatException('Selecciona al compañero del aporte.');
      if(posted&&kind=='expense'&&receiptPath==null&&photo==null&&noReceipt.text.trim().length<5)throw const FormatException('Adjunta un comprobante o explica por qué no existe.');
      if(correcting&&reason.text.trim().length<5)throw const FormatException('Indica el motivo de la corrección.');
      setState((){busy=true;error=null;});
      // Confirm active role immediately before every write; the RPC validates it again.
      await widget.repo.profile();
      if(photo!=null){final bytes=await photo!.readAsBytes();if(bytes.length>10485760)throw const FormatException('La fotografía supera 10 MB. Selecciona otra.');final png=bytes.length>8&&bytes[0]==137&&bytes[1]==80&&bytes[2]==78&&bytes[3]==71;final jpeg=bytes.length>3&&bytes[0]==255&&bytes[1]==216;final webp=bytes.length>12&&String.fromCharCodes(bytes.take(4))=='RIFF'&&String.fromCharCodes(bytes.sublist(8,12))=='WEBP';if(!png&&!jpeg&&!webp)throw const FormatException('Selecciona una fotografía JPG, PNG o WEBP.');final ext=png?'png':webp?'webp':'jpg';final path='$id/${const Uuid().v4()}.$ext';await widget.repo.client.storage.from('treasury-receipts').uploadBinary(path,bytes,fileOptions:FileOptions(contentType:'image/${png?'png':webp?'webp':'jpeg'}'));receiptPath=path;photo=null;}
      final payload=<String,dynamic>{'id':id,'version':version,'status':posted?'posted':'draft','entry_date':iso(date),'kind':kind,'category':category,'fund':fund,'amount_cents':value,'description':description.text.trim(),'member_id':rent&&memberId?.startsWith('source:')!=true?memberId:null,'due_month':rent?period(due):null,'receipt_path':receiptPath,'no_receipt_reason':noReceipt.text.trim(),if(rent&&memberId?.startsWith('source:')==true)'source_anniversary_id':memberId!.substring(7),if(correcting)'reason':reason.text.trim()};
      await widget.repo.command(correcting?'correct':'save',payload);
      dirty=false;if(mounted)Navigator.pop(context,true);
    }catch(e){if(mounted)setState(()=>error=message(e));}finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> pickDate(bool month)async{final initial=month?due:date;final start=DateTime.parse(widget.settings['start_month']);final picked=await showDatePicker(context:context,initialDate:initial,firstDate:month?DateTime(start.year,start.month):start,lastDate:month?DateTime(today().year+2,12,31):today(),helpText:month?'Elige cualquier día del mes del aporte':'Fecha del movimiento');if(picked!=null)changed(()=>month?due=DateTime(picked.year,picked.month):date=picked);}
  @override Widget build(BuildContext context){
    final selected=[...widget.members.map((m)=>{'value':m['id'],'name':m['name']}),...widget.companions.map((c)=>{'value':'source:${c['id']}','name':c['name']})].where((c)=>c['value']==memberId).firstOrNull;
    return PopScope(canPop:!dirty&&!busy,onPopInvokedWithResult:(didPop,result)async{if(!didPop&&await leave()&&mounted){setState(()=>dirty=false);if(context.mounted)Navigator.pop(context);}},child:Scaffold(appBar:AppBar(title:Text(correcting?'Corregir movimiento':widget.entry==null?'Nuevo movimiento':'Completar borrador')),body:AbsorbPointer(absorbing:busy,child:ListView(padding:const EdgeInsets.all(20),children:[
      SegmentedButton<String>(segments:const [ButtonSegment(value:'income',label:Text('Ingreso'),icon:Icon(Icons.south_west)),ButtonSegment(value:'expense',label:Text('Egreso'),icon:Icon(Icons.north_east))],selected:{kind},onSelectionChanged:(v)=>changed((){kind=v.first;category=kind=='income'?'seventh':'supplies';fund='general';})),const SizedBox(height:20),
      DropdownButtonFormField<String>(initialValue:category,key:ValueKey(category),isExpanded:true,decoration:const InputDecoration(labelText:'Categoría'),items:categories.entries.where((e)=>incomeCategories.contains(e.key)==(kind=='income')).map((e)=>DropdownMenuItem(value:e.key,child:Text(e.value))).toList(),onChanged:(v)=>changed((){category=v!;if(category=='rent'||rent)fund='rent';if(category=='seventh')fund='general';})),const SizedBox(height:16),
      DropdownButtonFormField<String>(initialValue:fund,key:ValueKey(fund),decoration:const InputDecoration(labelText:'Fondo que recibe o paga'),items:const [DropdownMenuItem(value:'general',child:Text('Dinero para gastos del grupo')),DropdownMenuItem(value:'rent',child:Text('Dinero para el local'))],onChanged:['rent','rent_contribution','seventh'].contains(category)?null:(v)=>changed(()=>fund=v!)),const SizedBox(height:16),
      OutlinedButton.icon(onPressed:()=>pickDate(false),icon:const Icon(Icons.calendar_month),label:Text('Fecha: ${iso(date)}')),const SizedBox(height:16),
      TextField(controller:amount,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Monto · USD',hintText:'Ejemplo: 12,50')),const SizedBox(height:16),TextField(controller:description,decoration:const InputDecoration(labelText:'Detalle del movimiento'),maxLines:2),
      if(rent)...[const SizedBox(height:16),OutlinedButton.icon(onPressed:chooseMember,icon:const Icon(Icons.person_search),label:Text(selected?['name']??'Elegir compañero')),OutlinedButton.icon(onPressed:()=>pickDate(true),icon:const Icon(Icons.date_range),label:Text('Mes del aporte: ${period(due).substring(0,7)}'))],
      const SizedBox(height:22),const Text('COMPROBANTE',style:TextStyle(fontWeight:FontWeight.bold)),const SizedBox(height:10),Wrap(spacing:10,children:[OutlinedButton.icon(onPressed:()=>pick(ImageSource.camera),icon:const Icon(Icons.camera_alt_outlined),label:const Text('Tomar foto')),OutlinedButton.icon(onPressed:()=>pick(ImageSource.gallery),icon:const Icon(Icons.photo_library_outlined),label:const Text('Galería'))]),
      if(photo!=null)Padding(padding:const EdgeInsets.symmetric(vertical:12),child:ClipRRect(borderRadius:BorderRadius.circular(16),child:FutureBuilder<Uint8List>(future:photo!.readAsBytes(),builder:(context,s)=>s.hasData?Image.memory(s.data!,height:180,fit:BoxFit.contain):const SizedBox(height:180,child:Center(child:CircularProgressIndicator()))))),if(receiptPath!=null)const ListTile(leading:Icon(Icons.check_circle_outline),title:Text('Comprobante adjunto')),
      if(kind=='expense')...[const SizedBox(height:16),TextField(controller:noReceipt,decoration:const InputDecoration(labelText:'Si no hay comprobante, explica el motivo'),maxLines:2)],
      if(correcting)...[const SizedBox(height:16),TextField(controller:reason,decoration:const InputDecoration(labelText:'Motivo de la corrección'),maxLines:2)],if(error!=null)Padding(padding:const EdgeInsets.only(top:16),child:Text(error!,style:const TextStyle(color:Colors.red))),const SizedBox(height:100),
    ])),bottomNavigationBar:SafeArea(child:Padding(padding:const EdgeInsets.all(16),child:Row(children:[if(!correcting)Expanded(child:OutlinedButton(onPressed:busy?null:()=>save(false),child:const Text('Borrador'))),if(!correcting)const SizedBox(width:12),Expanded(child:FilledButton(onPressed:busy?null:()=>save(true),child:Text(busy?'Guardando…':correcting?'Guardar corrección':'Confirmar')))])))));
  }
}
