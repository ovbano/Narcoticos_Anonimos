import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'treasury.dart';
import 'workspace.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url=String.fromEnvironment('SUPABASE_URL');const key=String.fromEnvironment('SUPABASE_ANON_KEY');
  if(url.isEmpty || !isPublicKey(key)){runApp(const MaterialApp(home:Scaffold(body:Center(child:Padding(padding:EdgeInsets.all(24),child:Text('Configura la URL y una clave pública de Supabase (anon o publishable). Nunca uses una clave administrativa. Sigue la guía del proyecto y ejecuta con --dart-define-from-file=config.local.json.'))))));return;}
  await Supabase.initialize(url:url,publishableKey:key);
  runApp(const TreasuryApp());
}
class TreasuryApp extends StatelessWidget {
  const TreasuryApp({super.key});
  @override Widget build(BuildContext context)=>MaterialApp(title:'Amigos Verdaderos · Tesorería',debugShowCheckedModeBanner:false,locale:const Locale('es','EC'),supportedLocales:const [Locale('es','EC')],localizationsDelegates:GlobalMaterialLocalizations.delegates,theme:ThemeData(useMaterial3:true,colorScheme:ColorScheme.fromSeed(seedColor:const Color(0xff102d50)),scaffoldBackgroundColor:const Color(0xfff0f4f8),inputDecorationTheme:InputDecorationTheme(filled:true,fillColor:Colors.white,border:OutlineInputBorder(borderRadius:BorderRadius.circular(14))),cardTheme:const CardThemeData(margin:EdgeInsets.symmetric(vertical:6),elevation:0),filledButtonTheme:FilledButtonThemeData(style:FilledButton.styleFrom(minimumSize:const Size(48,52)))),home:const AuthGate());
}
class AuthGate extends StatefulWidget { const AuthGate({super.key});@override State<AuthGate> createState()=>_AuthGateState(); }
class _AuthGateState extends State<AuthGate> {
  late final TreasuryRepository repo;StreamSubscription<AuthState>? subscription;Future<Json>? access;
  @override void initState(){super.initState();repo=TreasuryRepository(Supabase.instance.client);access=repo.client.auth.currentSession==null?null:repo.profile();subscription=repo.client.auth.onAuthStateChange.listen((event){if(!mounted)return;if(event.event==AuthChangeEvent.signedOut){setState(()=>access=null);}else if(event.event==AuthChangeEvent.signedIn || event.event==AuthChangeEvent.initialSession){setState(()=>access=repo.client.auth.currentSession==null?null:repo.profile());}});}
  @override void dispose(){subscription?.cancel();super.dispose();}
  @override Widget build(BuildContext context){if(access==null)return LoginScreen(repo:repo);return FutureBuilder<Json>(future:access,builder:(context,s){if(s.hasError)return Scaffold(appBar:AppBar(title:const Text('Acceso a Tesorería')),body:Padding(padding:const EdgeInsets.all(24),child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[Text(message(s.error!)),const SizedBox(height:20),FilledButton(onPressed:()=>setState(()=>access=repo.profile()),child:const Text('Reintentar')),TextButton(onPressed:()async{await repo.client.auth.signOut(scope:SignOutScope.local);},child:const Text('Volver al inicio de sesión'))])));if(!s.hasData)return const Scaffold(body:Center(child:CircularProgressIndicator()));return Workspace(key:ValueKey(s.data!['id']),repo:repo,profile:s.data!);});}
}
class LoginScreen extends StatefulWidget {const LoginScreen({super.key,required this.repo});final TreasuryRepository repo;@override State<LoginScreen> createState()=>_LoginState();}
class _LoginState extends State<LoginScreen> {
  final email=TextEditingController(),password=TextEditingController();final form=GlobalKey<FormState>();bool busy=false,visible=false;String? error;
  @override void dispose(){email.dispose();password.dispose();super.dispose();}
  Future<void> login()async{if(busy||!form.currentState!.validate())return;setState((){busy=true;error=null;});try{await widget.repo.client.auth.signInWithPassword(email:email.text.trim(),password:password.text);}catch(e){if(mounted)setState(()=>error=message(e));}finally{if(mounted)setState(()=>busy=false);}}
  @override Widget build(BuildContext context)=>Scaffold(body:SafeArea(child:Center(child:SingleChildScrollView(padding:const EdgeInsets.all(24),child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:440),child:Form(key:form,child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[const Icon(Icons.account_balance_wallet_rounded,size:68,color:Color(0xff102d50)),const SizedBox(height:20),const Text('Amigos Verdaderos',textAlign:TextAlign.center,style:TextStyle(fontSize:28,fontWeight:FontWeight.bold)),const Text('NARCÓTICOS ANÓNIMOS\nTesorería del grupo',textAlign:TextAlign.center),const SizedBox(height:32),TextFormField(controller:email,keyboardType:TextInputType.emailAddress,autofillHints:const [AutofillHints.username],decoration:const InputDecoration(labelText:'Correo electrónico',prefixIcon:Icon(Icons.mail_outline)),validator:(v)=>(v??'').contains('@')?null:'Escribe tu correo'),const SizedBox(height:16),TextFormField(controller:password,obscureText:!visible,autofillHints:const [AutofillHints.password],decoration:InputDecoration(labelText:'Contraseña',prefixIcon:const Icon(Icons.lock_outline),suffixIcon:IconButton(tooltip:visible?'Ocultar contraseña':'Mostrar contraseña',onPressed:()=>setState(()=>visible=!visible),icon:Icon(visible?Icons.visibility_off:Icons.visibility))),onFieldSubmitted:(_)=>login(),validator:(v)=>(v??'').isNotEmpty?null:'Escribe tu contraseña'),if(error!=null)Padding(padding:const EdgeInsets.symmetric(vertical:16),child:Text(error!,style:const TextStyle(color:Colors.red))),const SizedBox(height:24),FilledButton(onPressed:busy?null:login,child:Text(busy?'Ingresando…':'Iniciar sesión')),const SizedBox(height:18),const Text('Utiliza la misma cuenta que en la web. Si necesitas acceso, solicítalo al administrador.',textAlign:TextAlign.center)])))))));
}
