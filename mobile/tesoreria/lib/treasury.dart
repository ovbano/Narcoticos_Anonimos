import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

typedef Json = Map<String, dynamic>;
const categories = <String,String>{'seventh':'Séptima tradición','rent_contribution':'Aporte para el local','other_income':'Otro ingreso','rent':'Arriendo','supplies':'Café, azúcar e insumos','literature':'Literatura','service':'Servicio / área','event':'Actividad del grupo','other_expense':'Otro gasto'};
const incomeCategories = ['seventh','rent_contribution','other_income'];
String money(Object? value) => NumberFormat.currency(locale:'es_EC',symbol:r'$',decimalDigits:2).format((value is num ? value : 0)/100);
DateTime today() { final now=DateTime.now().toUtc().subtract(const Duration(hours:5));return DateTime(now.year,now.month,now.day); }
String iso(DateTime date) => DateFormat('yyyy-MM-dd').format(date);
String period(DateTime date) => iso(DateTime(date.year,date.month));
int? cents(String text,{bool optional=false}) {
  final normalized=text.trim().replaceAll(',','.');
  if(optional && normalized.isEmpty)return null;
  if(!RegExp(r'^\d{1,7}(\.\d{1,2})?$').hasMatch(normalized))throw const FormatException('Escribe un monto válido con hasta dos decimales.');
  final parts=normalized.split('.');final amount=int.parse(parts[0])*100+int.parse(parts.length==1?'00':parts[1].padRight(2,'0'));
  if(amount>100000000)throw const FormatException('El monto supera el límite permitido.');
  return amount;
}
List<Json> rows(dynamic value) => (value as List? ?? []).map((e)=>Json.from(e as Map)).toList();
String message(Object error) {
  if(error is AuthException)return 'No se pudo iniciar o actualizar la sesión. Revisa tus credenciales y conexión.';
  if(error is PostgrestException)return error.message;
  if(error is StorageException)return 'No se pudo guardar o abrir el comprobante. Revisa tu conexión y vuelve a intentar.';
  if(error is FormatException)return error.message;
  return 'No se pudo completar la operación. Comprueba tu conexión e intenta nuevamente.';
}
bool isPublicKey(String key) {
  if(key.startsWith('sb_publishable_'))return true;
  try { final pieces=key.split('.');if(pieces.length!=3)return false;final payload=jsonDecode(utf8.decode(base64Url.decode(base64Url.normalize(pieces[1]))));return payload is Map && payload['role']=='anon'; } catch(_) { return false; }
}
class TreasuryRepository {
  TreasuryRepository(this.client);
  final SupabaseClient client;
  Future<Json> profile() async {
    final user=await client.auth.getUser();
    final id=user.user?.id;if(id==null)throw const FormatException('Inicia sesión para continuar.');
    final p=await client.from('profiles').select('id,display_name,role,active').eq('id',id).maybeSingle();
    if(p==null || p['active']!=true || !['admin','treasurer','auditor'].contains(p['role']))throw const FormatException('Tu cuenta no tiene acceso activo a Tesorería. Contacta al administrador.');
    return p;
  }
  Future<Json?> settings() => client.from('treasury_settings').select().maybeSingle();
  Future<Json> report(DateTime month) async => Json.from(await client.rpc('treasury_report',params:{'p_month':period(month)}) as Map);
  Future<List<Json>> all(String table,{String? status}) async {
    final data=<Json>[];
    for(var offset=0;;offset+=500){
      var query=client.from(table).select();if(status!=null)query=query.eq('status',status);
      final page=await query.order('id').range(offset,offset+499);data.addAll(page);
      if(page.length<500)return data;
    }
  }
  Future<List<Json>> companions() async => rows(await client.rpc('treasury_companions'));
  Future<Json> command(String action,Json data) async => Json.from(await client.rpc('treasury_command',params:{'p_action':action,'p_data':data}) as Map);
}
