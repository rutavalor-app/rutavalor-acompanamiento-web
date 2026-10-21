
(function(){'use strict';
var api='https://rvsalufadckpcbgbgjrr.supabase.co/functions/v1/portal-compartir-jornada', authApi='https://rvsalufadckpcbgbgjrr.supabase.co/functions/v1/crear-comparticion-jornada';
var tokenMatch=location.hash.match(/^#t=([0-9a-f]{64})$/i);
var token=tokenMatch?tokenMatch[1].toLowerCase():(sessionStorage.getItem('rv_share_token')||'');
if(tokenMatch){sessionStorage.setItem('rv_share_token',token);history.replaceState(null,'',location.pathname)}
var proof=sessionStorage.getItem('rv_proof_'+token)||'', coord=null, timer=null, waiting=false;
function el(id){return document.getElementById(id)}
function visible(id,on){el(id).classList.toggle('hidden',!on)}
function info(t,error){el('status').textContent=t;el('status').className=error?'error':'status'}
function hide(){['sms','accept','data'].forEach(function(k){visible(k,false)})}
function date(t){var d=new Date(t);return isNaN(d.getTime())?'':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}
async function post(url,data){var response=await fetch(url,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return response.json()}
function display(d){
hide();if(!d.ok){info('Enlace no disponible o acceso vencido.',true);if(timer)clearInterval(timer);timer=null;return}
if(d.estado==='pendiente_validacion'){info('Pendiente de verificación SMS.');visible('sms',true);return}

if(d.estado==='pendiente_envio'){info('Invitación pendiente de aceptación.');visible('accept',true);return}
if(d.estado!=='activa'){info('Acceso no disponible.',true);return}
info('Información autorizada por el conductor.');
visible('data',true);
el('permission').textContent=d.permiso==='solo_estado'?'Solo estado':d.permiso==='ultima_ubicacion'?'Estado y última ubicación':'Seguimiento de ubicación';
el('expiry').textContent='El acceso vence: '+date(d.expira_at);
el('locationStatus').textContent=d.permiso==='solo_estado'
  ?'Este enlace muestra únicamente el estado de la jornada.'
  :d.ubicacion_autorizada===false
    ?'Ubicación no disponible para este enlace.'
    :d.ubicacion_disponible
      ?(d.ubicacion_reciente===true
        ?'Última ubicación registrada: '+date(d.capturada_at)+'.'
        :'Última ubicación conocida: '+date(d.capturada_at)+'. El celular no ha enviado una posición más reciente. El conductor podría haberse desplazado.')
      :'No hay ninguna ubicación registrada en esta jornada.';
coord=d.ubicacion_disponible?d.ubicacion:null;
visible('coords',!!coord);
if(coord){
  el('point').textContent=coord.latitud+', '+coord.longitud;
  el('map').textContent=d.ubicacion_reciente===true?'Ver ubicación en el mapa':'Ver última ubicación conocida en el mapa';
}
visible('receipt',d.confirmado_recibido!==true);
if(timer)clearInterval(timer);timer=d.permiso==='seguimiento'?setInterval(refresh,30000):null
}
async function refresh(){if(waiting)return;waiting=true;try{display(await post(api,{accion:'consultar',token:token,acceso:proof}))}catch(e){hide();info('Conexión no disponible. Intenta nuevamente.',true)}finally{waiting=false}}
async function action(name){if(waiting)return;waiting=true;try{var d=await post(api,{accion:name,token:token,acceso:proof});if(d.ok){display(await post(api,{accion:'consultar',token:token,acceso:proof}))}else{info('No pudimos realizar la acción. '+(d.codigo||''),true)}}catch(e){info('Error de conexión.',true)}finally{waiting=false}}
el('verify').onclick=async function(){if(waiting)return;var code=el('otp').value.trim();if(!/^\d{4,10}$/.test(code)){info('Escribe el código numérico.',true);return}waiting=true;try{var d=await post(authApi,{accion:'confirmar_sms',token:token,codigo:code});if(!d.ok||!d.sesion_visualizador){
  var message=d.codigo==='CODIGO_NO_COINCIDE'
    ?'Twilio no reconoció el código recibido. Puedes volver a intentarlo mientras siga vigente.'
    :d.codigo==='CODIGO_NO_VIGENTE' || d.codigo==='VALIDACION_NO_AUTORIZADA'
      ?'Este código o enlace ya no está vigente. Solicita una nueva invitación.'
      :d.codigo==='LIMITE_INTENTOS'
        ?'Se alcanzó el límite de intentos. Solicita una nueva verificación.'
        :d.codigo==='SERVICIO_VERIFICACION_NO_DISPONIBLE' || d.codigo==='CONFIGURACION_SMS_PENDIENTE'
          ?'El servicio de verificación no respondió correctamente. Intenta nuevamente más tarde.'
          :'No se pudo completar la verificación. El código no necesariamente ha vencido.';
  info(message,true);return
}proof=d.sesion_visualizador;sessionStorage.setItem('rv_proof_'+token,proof);el('otp').value='';display(await post(api,{accion:'consultar',token:token,acceso:proof}))}catch(e){info('No pudimos validar el SMS.',true)}finally{waiting=false}};
el('acceptBtn').onclick=function(){action('aceptar')};el('receipt').onclick=function(){action('confirmar_recibido')};el('refresh').onclick=refresh;
el('map').onclick=function(){if(coord)window.open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(coord.latitud+','+coord.longitud),'_blank','noopener,noreferrer')};
if(!/^[0-9a-f]{64}$/.test(token)){hide();info('Abre el enlace privado enviado por el conductor.',true);return}refresh()
})();
